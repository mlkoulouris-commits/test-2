"use server";

import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export interface PaymentLineItem {
  articleName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discountPercent: number;
  discountAmount: number;
  voidType: "transfer" | "pure_void" | null;
}

export interface PaymentTransaction {
  id: string;
  accountNumber: string;
  openDate: string;
  closeDate: string;
  totalAmount: number;
  totalDiscount: number;
  placeName: string;
  userName: string;
  clientName: string | null;
  paymentName: string | null;
  lineItems: PaymentLineItem[];
}

export type PaymentType = "cash" | "card" | "no_payment";

// Fiscal cutoff time is 6:45 AM
// Sales before this time are reported on the previous day
const FISCAL_CUTOFF_HOUR = 6;
const FISCAL_CUTOFF_MINUTE = 45;

// Bulgarian VAT rate is 20%
const VAT_RATE = 0.2;

const removeVat = (amount: number): number => {
  return amount / (1 + VAT_RATE);
};

const parseDiscountPercent = (raw: unknown): number => {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.abs(raw);
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
  }
  return 0;
};

const getFiscalDate = (closeDate: string): string => {
  // closeDate format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  let datePart: string;
  let timePart: string;

  if (closeDate.includes(" ")) {
    [datePart, timePart] = closeDate.split(" ");
  } else if (closeDate.includes("T")) {
    [datePart, timePart] = closeDate.split("T");
  } else {
    return closeDate; // No time component, return as-is
  }

  if (!timePart) return datePart;

  const [hours, minutes] = timePart.split(":").map(Number);

  // If time is before 6:45 AM, assign to previous day
  if (
    hours < FISCAL_CUTOFF_HOUR ||
    (hours === FISCAL_CUTOFF_HOUR && minutes < FISCAL_CUTOFF_MINUTE)
  ) {
    const date = new Date(datePart);
    date.setDate(date.getDate() - 1);
    return format(date, "yyyy-MM-dd");
  }

  return datePart;
};

const getPaymentFilter = (paymentType: PaymentType) => {
  switch (paymentType) {
    case "cash":
      return (paymentName: string) =>
        paymentName.includes("брой") ||
        paymentName.includes("каса") ||
        paymentName.includes("cash");
    case "card":
      return (paymentName: string) =>
        paymentName.includes("карта") ||
        paymentName.includes("card") ||
        paymentName.includes("pos") ||
        paymentName.includes("терминал");
    case "no_payment":
      return (paymentName: string, paymethodName: string = "") => {
        const hasNoPayment = !paymentName && !paymethodName;
        const isCash =
          paymentName.includes("брой") ||
          paymentName.includes("каса") ||
          paymentName.includes("cash");
        const isCard =
          paymentName.includes("карта") ||
          paymentName.includes("card") ||
          paymentName.includes("pos") ||
          paymentName.includes("терминал");
        const isInvoice =
          paymentName.includes("фактура") || paymentName.includes("invoice");
        const isWallet =
          paymentName.includes("изход") || paymentName.includes("кд");
        return hasNoPayment || (!isCash && !isCard && !isInvoice && !isWallet);
      };
    default:
      return () => false;
  }
};

export const getPaymentTransactions = async (
  date: string,
  paymentType: PaymentType,
  locationId?: string,
  useFiscalDate: boolean = false,
  excludeVat: boolean = false,
  excludeNoPayment: boolean = false
) => {
  const supabase = await createClient();

  // When using fiscal date, we need to query a wider range:
  // - Transactions from 6:45 AM on the target date until 6:44:59 AM on the next day
  let startDateTime: string;
  let endDateTime: string;

  if (useFiscalDate) {
    // For fiscal date X, include:
    // - From date X at 06:45:00 to date X+1 at 06:44:59
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = format(nextDate, "yyyy-MM-dd");

    startDateTime = `${date} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`;
    endDateTime = `${nextDateStr} 0${FISCAL_CUTOFF_HOUR}:${
      FISCAL_CUTOFF_MINUTE - 1
    }:59`;
  } else {
    startDateTime = date + " 00:00:00";
    endDateTime = date + " 23:59:59";
  }

  // Fetch all accounts for the date
  let query = supabase
    .from("barsy_accounts")
    .select(
      "id, barsy_account_id, account_number, open_date, close_date, total_amount, raw_data, location_id, client_id"
    )
    .gt("total_amount", 0)
    .not("close_date", "is", null)
    .gte("close_date", startDateTime)
    .lte("close_date", endDateTime)
    .order("close_date", { ascending: true });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data: accounts, error } = await query;

  if (error) {
    return { error: error.message };
  }

  if (!accounts || accounts.length === 0) {
    return { data: [] };
  }

  // Filter by payment type
  const paymentFilter = getPaymentFilter(paymentType);
  const filteredAccounts = accounts.filter((account) => {
    const rawData = account.raw_data as Record<string, unknown>;
    const paymentName =
      ((rawData?.payment_name as string) || "").toLowerCase() || "";
    const paymethodName =
      ((rawData?.paymethod_name as string) || "").toLowerCase() || "";
    return paymentFilter(paymentName, paymethodName);
  });

  if (filteredAccounts.length === 0) {
    return { data: [] };
  }

  // Fetch all clients for this location to look up client names
  const clientIds = filteredAccounts
    .map((acc) => {
      const rawData = acc.raw_data as Record<string, unknown>;
      return acc.client_id || (rawData?.client_id as number);
    })
    .filter((id): id is number => id !== null && id !== undefined && id !== 0);

  let clientsMap = new Map<number, string>();

  if (clientIds.length > 0) {
    let clientsQuery = supabase
      .from("barsy_clients")
      .select("barsy_client_id, client_name")
      .in("barsy_client_id", clientIds);

    if (locationId) {
      clientsQuery = clientsQuery.eq("location_id", locationId);
    }

    const { data: clients } = await clientsQuery;

    if (clients) {
      for (const client of clients) {
        clientsMap.set(client.barsy_client_id, client.client_name);
      }
    }
  }

  // Get all account IDs for batch order fetching
  const accountBarsyIds = filteredAccounts
    .map((acc) => acc.barsy_account_id?.toString())
    .filter(Boolean) as string[];

  // Fetch all orders for these accounts in one query
  let allOrdersForAccounts: Array<{
    barsy_order_id: number;
    barsy_article_id: number;
    article_name: string;
    actual_price: number;
    amount: number;
    order_date: string;
    raw_data: Record<string, unknown>;
  }> = [];

  if (accountBarsyIds.length > 0) {
    // Fetch orders for all accounts
    const { data: ordersData } = await supabase
      .from("barsy_orders")
      .select(
        "barsy_order_id, barsy_article_id, article_name, actual_price, amount, order_date, raw_data"
      )
      .in("raw_data->>account_id", accountBarsyIds)
      .order("order_date", { ascending: true });

    allOrdersForAccounts = (ordersData || []) as typeof allOrdersForAccounts;
  }

  // Build transfer detection set
  const transferOrderIds = new Set<number>();
  const negativeOrders = allOrdersForAccounts.filter(
    (o) => Number(o.amount) < 0
  );
  const positiveOrders = allOrdersForAccounts.filter(
    (o) => Number(o.amount) > 0
  );

  for (const negOrder of negativeOrders) {
    const negAccountId = (
      negOrder.raw_data as Record<string, unknown>
    )?.account_id?.toString();
    const negAmount = Math.abs(Number(negOrder.amount));
    const negArticleId = negOrder.barsy_article_id;
    const negDate = negOrder.order_date;

    // Check if there's a matching positive order on a different account
    const hasMatchingTransfer = positiveOrders.some((posOrder) => {
      const posAccountId = (
        posOrder.raw_data as Record<string, unknown>
      )?.account_id?.toString();
      return (
        posOrder.barsy_article_id === negArticleId &&
        Number(posOrder.amount) === negAmount &&
        posAccountId !== negAccountId &&
        posOrder.order_date === negDate
      );
    });

    if (hasMatchingTransfer) {
      transferOrderIds.add(negOrder.barsy_order_id);
    }
  }

  // Group orders by account_id
  const ordersByAccount = new Map<string, typeof allOrdersForAccounts>();
  for (const order of allOrdersForAccounts) {
    const accountId = (
      order.raw_data as Record<string, unknown>
    )?.account_id?.toString();
    if (accountId) {
      if (!ordersByAccount.has(accountId)) {
        ordersByAccount.set(accountId, []);
      }
      ordersByAccount.get(accountId)!.push(order);
    }
  }

  // Fetch line items for each account
  const transactions: PaymentTransaction[] = await Promise.all(
    filteredAccounts.map(async (account) => {
      const rawData = account.raw_data as Record<string, unknown>;
      const accountOrders =
        ordersByAccount.get(account.barsy_account_id?.toString() || "") || [];

      const lineItems: PaymentLineItem[] = accountOrders.map((order) => {
        const amount = Number(order.amount) || 0;
        let voidType: "transfer" | "pure_void" | null = null;

        if (amount < 0) {
          voidType = transferOrderIds.has(order.barsy_order_id)
            ? "transfer"
            : "pure_void";
        }

        const orderRawData = order.raw_data as Record<string, unknown> | null;
        const discountPercent = parseDiscountPercent(orderRawData?.discount);
        const unitPrice = Number(order.actual_price) || 0;
        const lineTotal = unitPrice * amount;
        const discountAmount =
          amount > 0 && discountPercent > 0
            ? (Math.abs(lineTotal) * discountPercent) / 100
            : 0;

        return {
          articleName: order.article_name || "Unknown",
          quantity: amount,
          unitPrice,
          total: lineTotal,
          discountPercent,
          discountAmount,
          voidType,
        };
      });

      // Get client name from clients map or fall back to raw_data
      const clientIdToLookup =
        account.client_id || (rawData?.client_id as number);
      const clientNameFromDb = clientIdToLookup
        ? clientsMap.get(clientIdToLookup)
        : null;

      // Use client name from DB, or raw_data.client_name (skip if it's "Anonymous")
      const rawClientName = rawData?.client_name as string;
      const clientName =
        clientNameFromDb ||
        (rawClientName &&
        rawClientName.toLowerCase() !== "anonymous" &&
        rawClientName.toLowerCase() !== "аноним"
          ? rawClientName
          : null);

      const rawAmount = Number(account.total_amount) || 0;
      const totalAmount = excludeVat ? removeVat(rawAmount) : rawAmount;

      // Apply VAT exclusion to line items as well
      const adjustedLineItems = excludeVat
        ? lineItems.map((item) => ({
            ...item,
            unitPrice: removeVat(item.unitPrice),
            total: removeVat(item.total),
            discountAmount: removeVat(item.discountAmount),
            voidType: item.voidType,
          }))
        : lineItems;

      const totalDiscount = adjustedLineItems.reduce(
        (sum, item) =>
          sum +
          (Number.isFinite(item.discountAmount) ? item.discountAmount : 0),
        0
      );

      return {
        id: account.id,
        accountNumber:
          account.account_number ||
          account.barsy_account_id?.toString() ||
          "N/A",
        openDate: account.open_date || "",
        closeDate: account.close_date || "",
        totalAmount,
        totalDiscount,
        placeName: rawData?.place_num
          ? `${(rawData.salon_name as string) || ""} ${
              rawData.place_num
            }`.trim()
          : "N/A",
        userName: (rawData?.user_name as string) || "N/A",
        clientName: clientName,
        paymentName: (rawData?.payment_name as string) || null,
        lineItems: adjustedLineItems,
      };
    })
  );

  return { data: transactions };
};
