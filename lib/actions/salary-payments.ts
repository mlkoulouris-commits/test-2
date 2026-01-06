"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================================
// TYPES
// ============================================================================

export interface SalaryPayment {
  id: number;
  payment_number: string;
  payment_date: string;
  total_amount: number;
  bank_account_id: number | null;
  location_id: number;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  bank_account_name?: string | null;
  location_name?: string | null;
}

export interface SalaryPaymentApplication {
  laborCostId: number;
  amountApplied: number;
}

export interface SalaryPaymentHistoryItem {
  id: number;
  amount_applied: number;
  created_at: string;
  payment: {
    id: number;
    payment_number: string;
    payment_date: string;
    total_amount: number;
    reference_number: string | null;
    notes: string | null;
    created_by: string | null;
    bank_account_name: string | null;
  };
}

export interface UnpaidLaborCost {
  id: number;
  location_id: number;
  profile_id: number | null;
  description: string | null;
  cost_type: string;
  amount: number;
  total_paid: number;
  balance: number;
  period_start: string;
  period_end: string;
  status: string;
  profile_name: string | null;
  location_name: string | null;
}

// ============================================================================
// RECORD SALARY PAYMENT
// ============================================================================

export const recordSalaryPayment = async (
  paymentDate: string,
  totalAmount: number,
  applications: SalaryPaymentApplication[],
  locationId: number,
  bankAccountId: number,
  referenceNumber?: string,
  notes?: string
) => {
  const supabase = await createClient();

  // Validate applications sum matches total amount
  const applicationsSum = applications.reduce(
    (sum, app) => sum + app.amountApplied,
    0
  );
  if (Math.abs(applicationsSum - totalAmount) > 0.01) {
    return { error: "Payment applications must sum to total payment amount" };
  }

  // Validate all labor costs exist and are from the correct location
  if (applications.length > 0) {
    const { data: laborCosts, error: laborCostsError } = await supabase
      .from("labor_costs")
      .select("id, location_id, amount, total_paid, status")
      .in(
        "id",
        applications.map((app) => app.laborCostId)
      );

    if (laborCostsError) {
      return { error: laborCostsError.message };
    }

    // Check location matches
    const differentLocation = laborCosts?.find(
      (lc) => lc.location_id !== locationId
    );
    if (differentLocation) {
      return {
        error: "All salary entries must be from the same location as the payment",
      };
    }

    // Check already paid
    const alreadyPaid = laborCosts?.find((lc) => lc.status === "paid");
    if (alreadyPaid) {
      return { error: "Cannot record payment for already fully paid salary entries." };
    }

    // Validate payment amounts don't exceed balance
    for (const app of applications) {
      const laborCost = laborCosts?.find((lc) => lc.id === app.laborCostId);
      if (laborCost) {
        const balance = Number(laborCost.amount) - Number(laborCost.total_paid);
        if (app.amountApplied > balance + 0.01) {
          return {
            error: `Payment amount (${app.amountApplied}) exceeds remaining balance (${balance}) for salary entry #${app.laborCostId}`,
          };
        }
      }
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
    .eq("user_id", user?.id)
    .single();

  const createdByName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : user?.email;

  // Generate payment number
  const { data: paymentNumberResult, error: numberError } = await supabase.rpc(
    "generate_salary_payment_number"
  );

  if (numberError) {
    return { error: numberError.message };
  }

  // Create payment record
  const { data: payment, error: paymentError } = await supabase
    .from("salary_payments")
    .insert({
      payment_number: paymentNumberResult,
      payment_date: paymentDate,
      total_amount: totalAmount,
      location_id: locationId,
      bank_account_id: bankAccountId,
      reference_number: referenceNumber || null,
      notes: notes || null,
      created_by: createdByName,
    })
    .select()
    .single();

  if (paymentError) {
    return { error: paymentError.message };
  }

  // Create payment applications
  const paymentApplications = applications.map((app) => ({
    payment_id: payment.id,
    labor_cost_id: app.laborCostId,
    amount_applied: app.amountApplied,
  }));

  const { error: applicationsError } = await supabase
    .from("salary_payment_applications")
    .insert(paymentApplications);

  if (applicationsError) {
    // Rollback payment if applications fail
    await supabase.from("salary_payments").delete().eq("id", payment.id);
    return { error: applicationsError.message };
  }

  revalidatePath("/admin/labor-costs");
  return {
    success: true,
    paymentId: payment.id,
    paymentNumber: payment.payment_number,
  };
};

// ============================================================================
// GET SALARY PAYMENT HISTORY FOR A LABOR COST
// ============================================================================

export const getSalaryPaymentHistory = async (
  laborCostId: number
): Promise<{ data?: SalaryPaymentHistoryItem[]; error?: string }> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("salary_payment_applications")
    .select(
      `
      id,
      amount_applied,
      created_at,
      salary_payments (
        id,
        payment_number,
        payment_date,
        total_amount,
        reference_number,
        notes,
        created_by,
        bank_accounts (
          account_name
        )
      )
    `
    )
    .eq("labor_cost_id", laborCostId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  const history: SalaryPaymentHistoryItem[] = data.map((row: any) => ({
    id: row.id,
    amount_applied: Number(row.amount_applied),
    created_at: row.created_at,
    payment: {
      id: row.salary_payments?.id,
      payment_number: row.salary_payments?.payment_number,
      payment_date: row.salary_payments?.payment_date,
      total_amount: Number(row.salary_payments?.total_amount),
      reference_number: row.salary_payments?.reference_number,
      notes: row.salary_payments?.notes,
      created_by: row.salary_payments?.created_by,
      bank_account_name: row.salary_payments?.bank_accounts?.account_name || null,
    },
  }));

  return { data: history };
};

// ============================================================================
// GET UNPAID LABOR COSTS
// ============================================================================

export const getUnpaidLaborCosts = async (
  locationId?: number
): Promise<{ data?: UnpaidLaborCost[]; error?: string }> => {
  const supabase = await createClient();

  let query = supabase
    .from("labor_costs")
    .select(
      `
      id,
      location_id,
      profile_id,
      description,
      cost_type,
      amount,
      total_paid,
      period_start,
      period_end,
      status,
      locations!labor_costs_location_id_fkey (name),
      profiles!labor_costs_profile_id_fkey (first_name, last_name)
    `
    )
    .neq("status", "paid")
    .order("period_start", { ascending: false });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  const unpaidCosts: UnpaidLaborCost[] = data.map((row: any) => ({
    id: row.id,
    location_id: row.location_id,
    profile_id: row.profile_id,
    description: row.description,
    cost_type: row.cost_type,
    amount: Number(row.amount),
    total_paid: Number(row.total_paid) || 0,
    balance: Number(row.amount) - (Number(row.total_paid) || 0),
    period_start: row.period_start,
    period_end: row.period_end,
    status: row.status || "pending",
    profile_name: row.profiles
      ? `${row.profiles.first_name} ${row.profiles.last_name}`.trim()
      : null,
    location_name: row.locations?.name || null,
  }));

  return { data: unpaidCosts };
};

// ============================================================================
// GET BANK ACCOUNTS FOR LOCATION
// ============================================================================

export const getBankAccountsForLocation = async (
  locationId: number
): Promise<{
  data?: Array<{
    id: number;
    account_name: string;
    account_number: string | null;
    bank_name: string | null;
    account_type: string;
    current_balance: number;
  }>;
  error?: string;
}> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, account_name, account_number, bank_name, account_type, current_balance")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("account_name");

  if (error) {
    return { error: error.message };
  }

  return {
    data: data.map((acc) => ({
      id: acc.id,
      account_name: acc.account_name,
      account_number: acc.account_number,
      bank_name: acc.bank_name,
      account_type: acc.account_type || "bank",
      current_balance: Number(acc.current_balance) || 0,
    })),
  };
};

// ============================================================================
// GET ALL SALARY PAYMENTS
// ============================================================================

export const getSalaryPayments = async (options?: {
  locationId?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ data?: SalaryPayment[]; total?: number; error?: string }> => {
  const supabase = await createClient();
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;

  let query = supabase
    .from("salary_payments")
    .select(
      `
      *,
      bank_accounts (account_name),
      locations (name)
    `,
      { count: "exact" }
    )
    .order("payment_date", { ascending: false });

  if (options?.locationId) {
    query = query.eq("location_id", options.locationId);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return { error: error.message };
  }

  const payments: SalaryPayment[] = data.map((row: any) => ({
    id: row.id,
    payment_number: row.payment_number,
    payment_date: row.payment_date,
    total_amount: Number(row.total_amount),
    bank_account_id: row.bank_account_id,
    location_id: row.location_id,
    reference_number: row.reference_number,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    bank_account_name: row.bank_accounts?.account_name || null,
    location_name: row.locations?.name || null,
  }));

  return { data: payments, total: count || 0 };
};

// ============================================================================
// GET PAYMENT DETAILS WITH APPLICATIONS
// ============================================================================

export const getSalaryPaymentDetails = async (paymentId: number) => {
  const supabase = await createClient();

  const { data: payment, error: paymentError } = await supabase
    .from("salary_payments")
    .select(
      `
      *,
      bank_accounts (account_name),
      locations (name)
    `
    )
    .eq("id", paymentId)
    .single();

  if (paymentError) {
    return { error: paymentError.message };
  }

  const { data: applications, error: appsError } = await supabase
    .from("salary_payment_applications")
    .select(
      `
      id,
      amount_applied,
      labor_cost_id,
      labor_costs (
        description,
        cost_type,
        period_start,
        period_end,
        profiles!labor_costs_profile_id_fkey (first_name, last_name)
      )
    `
    )
    .eq("payment_id", paymentId);

  if (appsError) {
    return { error: appsError.message };
  }

  return {
    data: {
      payment: {
        ...payment,
        bank_account_name: (payment as any).bank_accounts?.account_name || null,
        location_name: (payment as any).locations?.name || null,
      },
      applications: applications.map((app: any) => ({
        id: app.id,
        amount_applied: Number(app.amount_applied),
        labor_cost_id: app.labor_cost_id,
        description: app.labor_costs?.description,
        cost_type: app.labor_costs?.cost_type,
        period_start: app.labor_costs?.period_start,
        period_end: app.labor_costs?.period_end,
        profile_name: app.labor_costs?.profiles
          ? `${app.labor_costs.profiles.first_name} ${app.labor_costs.profiles.last_name}`.trim()
          : null,
      })),
    },
  };
};
