"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const parseFiniteNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const parseBoolean = (value: unknown): boolean => value === true;

export interface Bill {
  id: number;
  source: "barsy" | "manual";
  location_id: number;
  vendor_id: number;
  doc_num: string | null;
  doc_date: string | null;
  due_date: string | null;
  total_amount: number;
  total_paid: number;
  balance: number;
  status: "approved" | "partially_paid" | "paid" | "voided";
  description: string | null;
  vendor_name: string | null;
  location_name: string | null;
  created_at: string;
  attachment_count?: number;
  has_vat?: boolean;
  vat_rate?: number | null;
  vat_amount?: number | null;
  /**
   * Total VAT for the bill. Uses bill-level VAT if present; otherwise falls back
   * to sum of item VAT amounts.
   */
  vat_amount_total?: number;
  /**
   * Display total (subtotal + VAT). Does not change payment/status logic, which
   * is still based on `total_amount`.
   */
  total_amount_including_vat?: number;
}

export interface BillStats {
  totalUnpaid: number;
  partiallyPaid: number;
  outstanding: number;
  overdue: number;
  dueThisMonth: number;
}

export const getBills = async (filters?: {
  status?: string;
  locationId?: number | string;
  vendorId?: number;
  showVoided?: boolean;
  source?: "barsy" | "manual";
}) => {
  const supabase = await createClient();

  let query = supabase
    .from("bills")
    .select(
      `
      *,
      locations!bills_location_id_fkey (name),
      vendors!bills_vendor_id_fkey (name)
    `
    )
    .order("doc_date", { ascending: false });

  if (filters?.locationId) {
    const locationId =
      typeof filters.locationId === "string"
        ? parseInt(filters.locationId)
        : filters.locationId;
    query = query.eq("location_id", locationId);
  }

  if (filters?.vendorId) {
    query = query.eq("vendor_id", filters.vendorId);
  }

  if (filters?.source) {
    query = query.eq("source", filters.source);
  }

  if (!filters?.showVoided) {
    query = query.neq("status", "voided");
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  const billIds = data.map((bill) => bill.id);

  // Fetch item-level VAT totals for bills that don't have bill-level VAT populated.
  // This supports both VAT modes: "bill" (bills.vat_amount) and "items" (bill_items.vat_amount).
  const itemVatTotalByBillId = new Map<number, number>();
  const candidateBillIdsForItemVat = data
    .filter((bill) => {
      const hasVat = parseBoolean((bill as { has_vat?: unknown }).has_vat);
      if (!hasVat) return false;
      const billVatAmount = parseFiniteNumber(
        (bill as { vat_amount?: unknown }).vat_amount
      );
      return !(billVatAmount > 0);
    })
    .map((bill) => bill.id);

  if (candidateBillIdsForItemVat.length > 0) {
    const { data: billItemsVat } = await supabase
      .from("bill_items")
      .select("bill_id, vat_amount")
      .in("bill_id", candidateBillIdsForItemVat);

    if (billItemsVat) {
      billItemsVat.forEach((row) => {
        const billId = Number((row as { bill_id?: unknown }).bill_id);
        const vatAmount = parseFiniteNumber(
          (row as { vat_amount?: unknown }).vat_amount
        );
        if (!Number.isFinite(billId) || billId <= 0) return;
        if (!Number.isFinite(vatAmount)) return;
        itemVatTotalByBillId.set(
          billId,
          (itemVatTotalByBillId.get(billId) || 0) + vatAmount
        );
      });
    }
  }

  // Fetch attachment counts for all bills
  const { data: attachmentCounts } =
    billIds.length > 0
      ? await supabase
          .from("attachments")
          .select("entity_id")
          .eq("entity_type", "bill")
          .in("entity_id", billIds)
      : { data: [] as Array<{ entity_id: unknown }> };

  const attachmentCountMap = new Map<number, number>();
  if (attachmentCounts) {
    attachmentCounts.forEach((att) => {
      const entityId = Number(att.entity_id);
      attachmentCountMap.set(
        entityId,
        (attachmentCountMap.get(entityId) || 0) + 1
      );
    });
  }

  const bills: Bill[] = data.map((bill) => {
    const totalAmount = parseFiniteNumber(bill.total_amount);
    const totalPaid = parseFiniteNumber(bill.total_paid);
    const hasVat = parseBoolean((bill as { has_vat?: unknown }).has_vat);
    const billVatAmount = parseFiniteNumber(
      (bill as { vat_amount?: unknown }).vat_amount
    );
    const itemsVatTotal = itemVatTotalByBillId.get(bill.id) || 0;
    const vatTotal = billVatAmount > 0 ? billVatAmount : itemsVatTotal;
    const totalAmountIncludingVat = totalAmount + (hasVat ? vatTotal : 0);
    const balance = totalAmountIncludingVat - totalPaid;
    const computedStatus =
      bill.status === "voided"
        ? "voided"
        : balance <= 0.01
        ? "paid"
        : totalPaid > 0.01
        ? "partially_paid"
        : "approved";

    return {
      id: bill.id,
      source: bill.source,
      location_id: bill.location_id,
      vendor_id: bill.vendor_id,
      doc_num: bill.doc_num,
      doc_date: bill.doc_date,
      due_date: bill.due_date,
      total_amount: totalAmount,
      total_paid: totalPaid,
      balance,
      status: computedStatus,
      description: bill.description,
      vendor_name: bill.vendors?.name || null,
      location_name: bill.locations?.name || null,
      created_at: bill.created_at,
      attachment_count: attachmentCountMap.get(bill.id) || 0,
      has_vat: hasVat,
      vat_rate:
        (bill as { vat_rate?: unknown }).vat_rate === null ||
        (bill as { vat_rate?: unknown }).vat_rate === undefined
          ? null
          : parseFiniteNumber((bill as { vat_rate?: unknown }).vat_rate),
      vat_amount:
        (bill as { vat_amount?: unknown }).vat_amount === null ||
        (bill as { vat_amount?: unknown }).vat_amount === undefined
          ? null
          : parseFiniteNumber((bill as { vat_amount?: unknown }).vat_amount),
      vat_amount_total: hasVat ? vatTotal : 0,
      total_amount_including_vat: totalAmountIncludingVat,
    };
  });

  // Apply status filter
  let filteredBills = bills;
  if (filters?.status) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    filteredBills = bills.filter((bill) => {
      const dueDate = bill.due_date ? new Date(bill.due_date) : null;
      const isOverdue = dueDate && dueDate < today && bill.balance > 0;

      switch (filters.status) {
        case "approved":
          return bill.status === "approved";
        case "partially_paid":
          return bill.status === "partially_paid";
        case "paid":
          return bill.status === "paid";
        case "overdue":
          return isOverdue;
        case "outstanding":
          return (
            bill.balance > 0 &&
            (bill.status === "approved" || bill.status === "partially_paid")
          );
        case "due_this_month":
          return (
            dueDate &&
            dueDate >= today &&
            dueDate <= endOfMonth &&
            bill.balance > 0
          );
        default:
          return true;
      }
    });
  }

  return { data: filteredBills };
};

export const getBillStats = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bills")
    .select("id, total_amount, total_paid, due_date, status, has_vat, vat_amount")
    .neq("status", "voided");

  if (error) {
    return { error: error.message };
  }

  const candidateBillIdsForItemVat = data
    .filter((bill) => {
      const hasVat = parseBoolean((bill as { has_vat?: unknown }).has_vat);
      if (!hasVat) return false;
      const billVatAmount = parseFiniteNumber(
        (bill as { vat_amount?: unknown }).vat_amount
      );
      return !(billVatAmount > 0);
    })
    .map((bill) => bill.id);

  const itemVatTotalByBillId = new Map<number, number>();
  if (candidateBillIdsForItemVat.length > 0) {
    const { data: billItemsVat } = await supabase
      .from("bill_items")
      .select("bill_id, vat_amount")
      .in("bill_id", candidateBillIdsForItemVat);

    if (billItemsVat) {
      billItemsVat.forEach((row) => {
        const billId = parseFiniteNumber((row as { bill_id?: unknown }).bill_id);
        const vatAmount = parseFiniteNumber(
          (row as { vat_amount?: unknown }).vat_amount
        );
        if (!Number.isFinite(billId) || billId <= 0) return;
        if (!Number.isFinite(vatAmount)) return;
        itemVatTotalByBillId.set(
          billId,
          (itemVatTotalByBillId.get(billId) || 0) + vatAmount
        );
      });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  let totalUnpaid = 0;
  let partiallyPaid = 0;
  let outstanding = 0;
  let overdue = 0;
  let dueThisMonth = 0;

  data.forEach((bill) => {
    const totalAmount = parseFiniteNumber(bill.total_amount);
    const totalPaid = parseFiniteNumber(bill.total_paid);
    const hasVat = parseBoolean((bill as { has_vat?: unknown }).has_vat);
    const billVatAmount = parseFiniteNumber(
      (bill as { vat_amount?: unknown }).vat_amount
    );
    const itemsVatTotal = itemVatTotalByBillId.get(bill.id) || 0;
    const vatTotal = billVatAmount > 0 ? billVatAmount : itemsVatTotal;
    const totalDue = totalAmount + (hasVat ? vatTotal : 0);
    const balance = totalDue - totalPaid;

    if (balance > 0) {
      totalUnpaid++;
      outstanding += balance;

      if (totalPaid > 0.01) {
        partiallyPaid++;
      }

      if (bill.due_date) {
        const dueDate = new Date(bill.due_date);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate < today) {
          overdue += balance;
        }

        if (dueDate >= today && dueDate <= endOfMonth) {
          dueThisMonth += balance;
        }
      }
    }
  });

  return {
    data: {
      totalUnpaid,
      partiallyPaid,
      outstanding,
      overdue,
      dueThisMonth,
    },
  };
};

export const getBillVendors = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return { data };
};

export const getBillLocations = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return { data };
};

export interface BillPaymentApplication {
  billId: number;
  amountApplied: number;
}

export interface PaymentRecord {
  id: number;
  payment_number: string;
  payment_date: string;
  total_amount: number;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export const recordBillPayment = async (
  paymentDate: string,
  totalAmount: number,
  applications: BillPaymentApplication[],
  locationId: number | string,
  bankAccountId: number,
  paymentMethod?: string,
  referenceNumber?: string,
  notes?: string
) => {
  const supabase = await createClient();

  // Convert locationId to number if it's a string
  const actualLocationId =
    typeof locationId === "string" ? parseInt(locationId) : locationId;

  // Validate applications sum matches total amount
  const applicationsSum = applications.reduce(
    (sum, app) => sum + app.amountApplied,
    0
  );
  if (Math.abs(applicationsSum - totalAmount) > 0.01) {
    return { error: "Payment applications must sum to total payment amount" };
  }

  // Validate all bills are from the same location and are approved
  if (applications.length > 0) {
    const { data: bills, error: billsError } = await supabase
      .from("bills")
      .select("id, location_id, status")
      .in(
        "id",
        applications.map((app) => app.billId)
      );

    if (billsError) {
      return { error: billsError.message };
    }

    const differentLocation = bills?.find(
      (bill) => bill.location_id !== actualLocationId
    );
    if (differentLocation) {
      return {
        error: "All bills must be from the same location as the payment",
      };
    }

    const unapprovedBill = bills?.find((bill) => bill.status === "voided");
    if (unapprovedBill) {
      return { error: "Cannot record payment for voided bills." };
    }
  }

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user profile for full name
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user?.id)
    .single();

  const createdByName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : user?.email;

  // Generate payment number
  const { data: paymentNumberResult, error: numberError } = await supabase.rpc(
    "generate_payment_number"
  );

  if (numberError) {
    return { error: numberError.message };
  }

  // Create payment record
  const { data: payment, error: paymentError } = await supabase
    .from("bill_payments")
    .insert({
      payment_number: paymentNumberResult,
      payment_date: paymentDate,
      total_amount: totalAmount,
      location_id: actualLocationId,
      bank_account_id: bankAccountId,
      payment_method: paymentMethod,
      reference_number: referenceNumber,
      notes: notes,
      created_by: createdByName,
    })
    .select()
    .single();

  if (paymentError) {
    return { error: paymentError.message };
  }

  // Create payment applications (use new_bill_id column)
  const paymentApplications = applications.map((app) => ({
    payment_id: payment.id,
    new_bill_id: app.billId,
    amount_applied: app.amountApplied,
  }));

  const { error: applicationsError } = await supabase
    .from("bill_payment_applications")
    .insert(paymentApplications);

  if (applicationsError) {
    // Rollback payment if applications fail
    await supabase.from("bill_payments").delete().eq("id", payment.id);
    return { error: applicationsError.message };
  }

  revalidatePath("/admin/bills");
  return {
    success: true,
    paymentId: payment.id,
    paymentNumber: payment.payment_number,
  };
};

export const voidBill = async (billId: number) => {
  const supabase = await createClient();

  const { error } = await supabase
    .from("bills")
    .update({
      status: "voided",
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/bills");
  return { success: true };
};

export interface BillItem {
  id: number;
  barsy_article_id: number | null;
  article_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  amount_type: string | null;
  notes: string | null;
  account_id: number | null;
  account_code?: string | null;
  account_name?: string | null;
  vat_rate?: number | null;
  vat_amount?: number | null;
}

export const getBillDetails = async (billId: number) => {
  const supabase = await createClient();

  const { data: bill, error: billError } = await supabase
    .from("bills")
    .select(
      `
      *,
      locations!bills_location_id_fkey (name),
      vendors!bills_vendor_id_fkey (
        name,
        default_account_id,
        chart_of_accounts!vendors_default_account_id_fkey (
          code,
          name,
          name_bg
        )
      ),
      chart_of_accounts!bills_account_id_fkey (id, code, name, name_bg)
    `
    )
    .eq("id", billId)
    .single();

  if (billError) {
    return { error: billError.message };
  }

  const hasVat = parseBoolean((bill as { has_vat?: unknown }).has_vat);
  const billVatAmount = parseFiniteNumber((bill as { vat_amount?: unknown }).vat_amount);
  let vatTotal = billVatAmount;

  if (hasVat && !(billVatAmount > 0)) {
    const { data: billItemsVat } = await supabase
      .from("bill_items")
      .select("vat_amount")
      .eq("bill_id", billId);

    if (billItemsVat) {
      vatTotal = billItemsVat.reduce(
        (sum, row) => sum + parseFiniteNumber((row as { vat_amount?: unknown }).vat_amount),
        0
      );
    }
  }

  const totalAmount = parseFiniteNumber((bill as { total_amount?: unknown }).total_amount);
  const totalPaid = parseFiniteNumber((bill as { total_paid?: unknown }).total_paid);
  const totalDue = totalAmount + (hasVat ? vatTotal : 0);

  return {
    data: {
      ...bill,
      location_name: bill.locations?.name || null,
      vendor_name: bill.vendors?.name || null,
      vendor_default_account_id: bill.vendors?.default_account_id || null,
      vendor_default_account_code: bill.vendors?.chart_of_accounts?.code || null,
      vendor_default_account_name: bill.vendors?.chart_of_accounts?.name || null,
      vat_amount_total: hasVat ? vatTotal : 0,
      total_amount_including_vat: totalDue,
      balance: totalDue - totalPaid,
      account_code: bill.chart_of_accounts?.code || null,
      account_name: bill.chart_of_accounts?.name || null,
    },
  };
};

export const getBillItems = async (billId: number) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bill_items")
    .select(
      `
      *,
      chart_of_accounts!bill_items_account_id_fkey (
        code,
        name,
        name_bg
      )
    `
    )
    .eq("bill_id", billId)
    .order("id", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  const items: BillItem[] = data.map((item: any) => ({
    id: item.id,
    barsy_article_id: item.barsy_article_id,
    article_name: item.article_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    amount_type: item.amount_type,
    notes: item.notes,
    account_id: item.account_id,
    account_code: item.chart_of_accounts?.code || null,
    account_name: item.chart_of_accounts?.name || null,
    vat_rate: item.vat_rate ? Number(item.vat_rate) : null,
    vat_amount: item.vat_amount ? Number(item.vat_amount) : null,
  }));

  return { data: items };
};

export const getBillPaymentHistory = async (billId: number) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bill_payment_applications")
    .select(
      `
      id,
      amount_applied,
      created_at,
      bill_payments (
        id,
        payment_number,
        payment_date,
        total_amount,
        payment_method,
        reference_number,
        notes,
        created_by
      )
    `
    )
    .eq("new_bill_id", billId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data };
};

export const getUnpaidBillsByLocation = async (
  locationId: number | string,
  vendorId?: number
) => {
  const actualLocationId =
    typeof locationId === "string" ? parseInt(locationId) : locationId;
  const supabase = await createClient();

  let query = supabase
    .from("bills")
    .select(
      `
      *,
      locations!bills_location_id_fkey (name),
      vendors!bills_vendor_id_fkey (name)
    `
    )
    .eq("location_id", actualLocationId)
    .neq("status", "voided")
    .order("doc_date", { ascending: true });

  if (vendorId) {
    query = query.eq("vendor_id", vendorId);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  const candidateBillIdsForItemVat = data
    .filter((bill) => {
      const hasVat = parseBoolean((bill as { has_vat?: unknown }).has_vat);
      if (!hasVat) return false;
      const billVatAmount = parseFiniteNumber(
        (bill as { vat_amount?: unknown }).vat_amount
      );
      return !(billVatAmount > 0);
    })
    .map((bill) => bill.id);

  const itemVatTotalByBillId = new Map<number, number>();
  if (candidateBillIdsForItemVat.length > 0) {
    const { data: billItemsVat } = await supabase
      .from("bill_items")
      .select("bill_id, vat_amount")
      .in("bill_id", candidateBillIdsForItemVat);

    if (billItemsVat) {
      billItemsVat.forEach((row) => {
        const billId = parseFiniteNumber((row as { bill_id?: unknown }).bill_id);
        const vatAmount = parseFiniteNumber(
          (row as { vat_amount?: unknown }).vat_amount
        );
        if (!Number.isFinite(billId) || billId <= 0) return;
        if (!Number.isFinite(vatAmount)) return;
        itemVatTotalByBillId.set(
          billId,
          (itemVatTotalByBillId.get(billId) || 0) + vatAmount
        );
      });
    }
  }

  // Only bills with outstanding VAT-inclusive balance
  const unpaidBills = data
    .map((bill) => {
      const totalAmount = parseFiniteNumber(bill.total_amount);
      const totalPaid = parseFiniteNumber(bill.total_paid);
      const hasVat = parseBoolean((bill as { has_vat?: unknown }).has_vat);
      const billVatAmount = parseFiniteNumber(
        (bill as { vat_amount?: unknown }).vat_amount
      );
      const itemsVatTotal = itemVatTotalByBillId.get(bill.id) || 0;
      const vatTotal = billVatAmount > 0 ? billVatAmount : itemsVatTotal;
      const totalDue = totalAmount + (hasVat ? vatTotal : 0);
      const balance = totalDue - totalPaid;

      return {
        id: bill.id,
        location_id: bill.location_id,
        vendor_id: bill.vendor_id,
        doc_num: bill.doc_num,
        doc_date: bill.doc_date,
        vendor_name: bill.vendors?.name || null,
        location_name: bill.locations?.name || null,
        total_amount: totalAmount,
        total_amount_including_vat: totalDue,
        total_paid: totalPaid,
        balance,
      };
    })
    .filter((bill) => bill.balance > 0.01);

  return { data: unpaidBills };
};

// Create manual bill
export const createManualBill = async (
  locationId: string,
  vendorId: number,
  docNum: string,
  docDate: string,
  dueDate: string | null,
  totalAmount: number,
  description: string | null,
  items: Array<{
    articleName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    accountId?: number | null;
    vatRate?: number | null;
    vatAmount?: number | null;
  }>,
  periodStart?: string | null,
  periodEnd?: string | null,
  accountId?: number | null,
  hasVat?: boolean,
  billVatRate?: number | null,
  billVatAmount?: number | null
) => {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user profile for full name
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user?.id)
    .single();

  const approvedByName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : user?.email;

  // Create bill
  const { data: bill, error: billError } = await supabase
    .from("bills")
    .insert({
      source: "manual",
      location_id: locationId,
      vendor_id: vendorId,
      doc_num: docNum,
      doc_date: docDate,
      due_date: dueDate,
      total_amount: totalAmount,
      total_paid: 0,
      status: "approved",
      description: description,
      period_start: periodStart,
      period_end: periodEnd,
      account_id: accountId,
      has_vat: hasVat || false,
      vat_rate: billVatRate || null,
      vat_amount: billVatAmount || null,
      created_by: approvedByName,
      approved_by: approvedByName,
      approved_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (billError) {
    return { error: billError.message };
  }

  // Create bill items
  if (items.length > 0) {
    const billItems = items.map((item) => ({
      bill_id: bill.id,
      article_name: item.articleName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      notes: item.notes,
      account_id: item.accountId,
      vat_rate: item.vatRate || null,
      vat_amount: item.vatAmount || null,
    }));

    const { error: itemsError } = await supabase
      .from("bill_items")
      .insert(billItems);

    if (itemsError) {
      // Rollback bill if items fail
      await supabase.from("bills").delete().eq("id", bill.id);
      return { error: itemsError.message };
    }
  }

  revalidatePath("/admin/bills");
  return { success: true, billId: bill.id };
};

// Update manual bill
export const updateManualBill = async (
  billId: number,
  vendorId: number,
  docNum: string,
  docDate: string,
  dueDate: string | null,
  totalAmount: number,
  description: string | null,
  items: Array<{
    id?: number;
    articleName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    accountId?: number | null;
    vatRate?: number | null;
    vatAmount?: number | null;
  }>,
  periodStart?: string | null,
  periodEnd?: string | null,
  accountId?: number | null,
  hasVat?: boolean,
  billVatRate?: number | null,
  billVatAmount?: number | null
) => {
  const supabase = await createClient();

  // Check bill exists and can be edited
  const { data: existingBill, error: checkError } = await supabase
    .from("bills")
    .select("id, status, source, total_paid")
    .eq("id", billId)
    .single();

  if (checkError) {
    return { error: checkError.message };
  }

  if (!existingBill) {
    return { error: "Bill not found" };
  }

  if (existingBill.source !== "manual") {
    return { error: "Only manual bills can be edited" };
  }

  if (existingBill.status === "paid" || existingBill.status === "voided") {
    return { error: "Cannot edit paid or voided bills" };
  }

  // Update bill
  const { error: billError } = await supabase
    .from("bills")
    .update({
      vendor_id: vendorId,
      doc_num: docNum,
      doc_date: docDate,
      due_date: dueDate,
      total_amount: totalAmount,
      description: description,
      period_start: periodStart,
      period_end: periodEnd,
      account_id: accountId,
      has_vat: hasVat || false,
      vat_rate: billVatRate || null,
      vat_amount: billVatAmount || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId);

  if (billError) {
    return { error: billError.message };
  }

  // Delete existing items
  const { error: deleteItemsError } = await supabase
    .from("bill_items")
    .delete()
    .eq("bill_id", billId);

  if (deleteItemsError) {
    return { error: deleteItemsError.message };
  }

  // Create new items
  if (items.length > 0) {
    const billItems = items.map((item) => ({
      bill_id: billId,
      article_name: item.articleName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      notes: item.notes,
      account_id: item.accountId,
      vat_rate: item.vatRate || null,
      vat_amount: item.vatAmount || null,
    }));

    const { error: itemsError } = await supabase
      .from("bill_items")
      .insert(billItems);

    if (itemsError) {
      return { error: itemsError.message };
    }
  }

  revalidatePath("/admin/bills");
  return { success: true };
};

// ============================================================================
// BILL PAYMENTS QUERIES
// ============================================================================

export interface BillPaymentWithDetails {
  id: number;
  payment_number: string;
  payment_date: string;
  total_amount: number;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  bank_account_id: number | null;
  location_id: number | null;
  applied_to_bills_count: number;
  bank_account_name?: string;
  location_name?: string;
}

export const getBillPayments = async (filters?: {
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  locationId?: number | string;
  bankAccountId?: number;
}) => {
  let actualLocationId: number | undefined = undefined;
  if (filters?.locationId) {
    const parsed =
      typeof filters.locationId === "string"
        ? parseInt(filters.locationId)
        : filters.locationId;
    actualLocationId = !isNaN(parsed) ? parsed : undefined;
  }

  const supabase = await createClient();

  let query = supabase
    .from("bill_payments")
    .select(
      `
      *,
      bank_accounts!bill_payments_bank_account_id_fkey (account_name),
      locations!bill_payments_location_id_fkey (name),
      bill_payment_applications (id)
    `
    )
    .order("payment_date", { ascending: false })
    .order("id", { ascending: false });

  if (filters?.startDate) {
    query = query.gte("payment_date", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("payment_date", filters.endDate);
  }

  if (filters?.paymentMethod) {
    query = query.eq("payment_method", filters.paymentMethod);
  }

  if (actualLocationId !== undefined) {
    query = query.eq("location_id", actualLocationId);
  }

  if (filters?.bankAccountId) {
    query = query.eq("bank_account_id", filters.bankAccountId);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  const payments: BillPaymentWithDetails[] = data.map((payment: any) => ({
    id: payment.id,
    payment_number: payment.payment_number,
    payment_date: payment.payment_date,
    total_amount: Number(payment.total_amount),
    payment_method: payment.payment_method,
    reference_number: payment.reference_number,
    notes: payment.notes,
    created_by: payment.created_by,
    created_at: payment.created_at,
    bank_account_id: payment.bank_account_id,
    location_id: payment.location_id,
    applied_to_bills_count: payment.bill_payment_applications?.length || 0,
    bank_account_name: payment.bank_accounts?.account_name,
    location_name: payment.locations?.name,
  }));

  return { data: payments };
};

export interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  byMethod: Record<string, { count: number; amount: number }>;
}

export const getPaymentStats = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bill_payments")
    .select("total_amount, payment_method");

  if (error) {
    return {
      data: {
        totalPayments: 0,
        totalAmount: 0,
        byMethod: {},
      },
    };
  }

  const totalPayments = data.length;
  const totalAmount = data.reduce((sum, p) => sum + Number(p.total_amount), 0);

  const byMethod: Record<string, { count: number; amount: number }> = {};
  data.forEach((payment) => {
    const method = payment.payment_method || "unspecified";
    if (!byMethod[method]) {
      byMethod[method] = { count: 0, amount: 0 };
    }
    byMethod[method].count++;
    byMethod[method].amount += Number(payment.total_amount);
  });

  return {
    data: {
      totalPayments,
      totalAmount,
      byMethod,
    },
  };
};

export const getBankAccounts = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_accounts")
    .select(
      `
      *,
      location:locations!bank_accounts_location_id_fkey (id, name)
    `
    )
    .order("account_name");

  if (error) {
    return { error: error.message };
  }

  return { data };
};

export interface PaymentApplicationDetail {
  id: number;
  amount_applied: number;
  bill: {
    id: number;
    doc_num: string | null;
    doc_date: string | null;
    total_amount: number;
    vendor_name: string | null;
  };
}

export interface BillPaymentDetails extends BillPaymentWithDetails {
  applications: PaymentApplicationDetail[];
}

export const getBillPaymentDetails = async (paymentId: number) => {
  const supabase = await createClient();

  const { data: payment, error: paymentError } = await supabase
    .from("bill_payments")
    .select(
      `
      *,
      bank_accounts!bill_payments_bank_account_id_fkey (account_name, account_number, bank_name),
      locations!bill_payments_location_id_fkey (name)
    `
    )
    .eq("id", paymentId)
    .single();

  if (paymentError) {
    return { error: paymentError.message };
  }

  const { data: applications, error: appsError } = await supabase
    .from("bill_payment_applications")
    .select(
      `
      id,
      amount_applied,
      bills!bill_payment_applications_new_bill_id_fkey (
        id,
        doc_num,
        doc_date,
        total_amount,
        vendors!bills_vendor_id_fkey (name)
      )
    `
    )
    .eq("payment_id", paymentId)
    .order("id", { ascending: true });

  if (appsError) {
    return { error: appsError.message };
  }

  const paymentDetails: BillPaymentDetails = {
    id: payment.id,
    payment_number: payment.payment_number,
    payment_date: payment.payment_date,
    total_amount: Number(payment.total_amount),
    payment_method: payment.payment_method,
    reference_number: payment.reference_number,
    notes: payment.notes,
    created_by: payment.created_by,
    created_at: payment.created_at,
    bank_account_id: payment.bank_account_id,
    location_id: payment.location_id,
    applied_to_bills_count: applications.length,
    bank_account_name: payment.bank_accounts?.account_name,
    location_name: payment.locations?.name,
    applications: applications.map((app: any) => ({
      id: app.id,
      amount_applied: Number(app.amount_applied),
      bill: {
        id: app.bills.id,
        doc_num: app.bills.doc_num,
        doc_date: app.bills.doc_date,
        total_amount: Number(app.bills.total_amount),
        vendor_name: app.bills.vendors?.name || null,
      },
    })),
  };

  return { data: paymentDetails };
};

// ============================================================================
// BILL ACCOUNT CATEGORIZATION
// ============================================================================

export interface UpdateBillAccountsData {
  accountId?: number | null;
  items?: Array<{
    id: number;
    accountId: number | null;
  }>;
}

// Update bill account assignments (works for both manual and Barsy bills)
export const updateBillAccounts = async (
  billId: number,
  data: UpdateBillAccountsData
) => {
  const supabase = await createClient();

  // Check bill exists and is not voided
  const { data: existingBill, error: checkError } = await supabase
    .from("bills")
    .select("id, status")
    .eq("id", billId)
    .single();

  if (checkError) {
    return { error: checkError.message };
  }

  if (!existingBill) {
    return { error: "Bill not found" };
  }

  if (existingBill.status === "voided") {
    return { error: "Cannot update voided bills" };
  }

  // Update bill-level account if provided
  if (data.accountId !== undefined) {
    const { error: billError } = await supabase
      .from("bills")
      .update({
        account_id: data.accountId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", billId);

    if (billError) {
      return { error: billError.message };
    }
  }

  // Update item-level accounts if provided
  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const { error: itemError } = await supabase
        .from("bill_items")
        .update({ account_id: item.accountId })
        .eq("id", item.id)
        .eq("bill_id", billId); // Safety check

      if (itemError) {
        return { error: itemError.message };
      }
    }
  }

  revalidatePath("/admin/bills");
  return { success: true };
};

// Get vendors with their default account info
export const getVendorsWithAccounts = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vendors")
    .select(
      `
      id,
      name,
      default_account_id,
      chart_of_accounts!vendors_default_account_id_fkey (
        id,
        code,
        name,
        name_bg
      )
    `
    )
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return {
    data: data.map((v: any) => ({
      id: v.id,
      name: v.name,
      default_account_id: v.default_account_id,
      default_account_code: v.chart_of_accounts?.code || null,
      default_account_name: v.chart_of_accounts?.name || null,
    })),
  };
};
