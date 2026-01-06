"use server";

import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export interface LineItem {
  articleName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  voidType: "transfer" | "pure_void" | null;
}

export interface ZeroAmountTransaction {
  id: string;
  accountNumber: string;
  openDate: string;
  closeDate: string;
  stornoAmount: number;
  placeName: string;
  userName: string;
  paymentName: string | null;
  lineItems: LineItem[];
}

// Fiscal cutoff time is 6:45 AM
// Sales before this time are reported on the previous day
const FISCAL_CUTOFF_HOUR = 6;
const FISCAL_CUTOFF_MINUTE = 45;

// Bulgarian VAT rate is 20%
const VAT_RATE = 0.2;

const removeVat = (amount: number): number => {
  return amount / (1 + VAT_RATE);
};

export const getZeroAmountTransactions = async (
  date: string,
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
    endDateTime = `${nextDateStr} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE - 1}:59`;
  } else {
    startDateTime = date + " 00:00:00";
    endDateTime = date + " 23:59:59";
  }

  // Fetch all zero-amount accounts for the date
  let query = supabase
    .from("barsy_accounts")
    .select(
      "id, barsy_account_id, account_number, open_date, close_date, total_amount, raw_data, location_id"
    )
    .eq("total_amount", 0)
    .not("close_date", "is", null)
    .gte("close_date", startDateTime)
    .lte("close_date", endDateTime)
    .order("close_date", { ascending: true });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data: zeroAccounts, error } = await query;

  if (error) {
    return { error: error.message };
  }

  if (!zeroAccounts || zeroAccounts.length === 0) {
    return { data: [] };
  }

  // Get account IDs to fetch their orders
  const accountBarsyIds = zeroAccounts
    .map((acc) => acc.barsy_account_id?.toString())
    .filter(Boolean) as string[];

  if (accountBarsyIds.length === 0) {
    return { data: [] };
  }

  // Step 1: Fetch orders for our specific accounts (to get their actual order dates)
  const accountOrdersPromises = accountBarsyIds.map(async (accountId) => {
    let query = supabase
      .from("barsy_orders")
      .select(
        "barsy_order_id, barsy_article_id, amount, actual_price, order_date, raw_data, location_id, article_name"
      )
      .eq("raw_data->>account_id", accountId);

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data } = await query;
    return data || [];
  });

  const accountOrdersArrays = await Promise.all(accountOrdersPromises);
  const accountOrders = accountOrdersArrays.flat();

  // Step 2: Get unique order_dates from our accounts' orders
  const orderDates = new Set<string>();
  for (const order of accountOrders) {
    if (order.order_date) {
      orderDates.add(order.order_date);
    }
  }

  // Step 3: Fetch ALL orders for those dates (to find transfer matches on OTHER accounts)
  let allDateOrders: typeof accountOrders = [];
  if (orderDates.size > 0) {
    const dateOrdersPromises = Array.from(orderDates).map(async (orderDate) => {
      let query = supabase
        .from("barsy_orders")
        .select(
          "barsy_order_id, barsy_article_id, amount, actual_price, order_date, raw_data, location_id, article_name"
        )
        .eq("order_date", orderDate);

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { data } = await query;
      return data || [];
    });

    const dateOrdersArrays = await Promise.all(dateOrdersPromises);
    allDateOrders = dateOrdersArrays.flat();
  }

  // Combine all orders and deduplicate by barsy_order_id
  const allOrdersMap = new Map<number, (typeof accountOrders)[0]>();
  for (const order of [...accountOrders, ...allDateOrders]) {
    if (!allOrdersMap.has(order.barsy_order_id)) {
      allOrdersMap.set(order.barsy_order_id, order);
    }
  }
  const allOrders = Array.from(allOrdersMap.values());

  // Build a set of transfer order IDs (negative orders that have matching positive orders on different accounts)
  const transferOrderIds = new Set<number>();

  if (allOrders.length > 0) {
    const negativeOrders = allOrders.filter((o) => Number(o.amount) < 0);
    const positiveOrders = allOrders.filter((o) => Number(o.amount) > 0);

    for (const negOrder of negativeOrders) {
      const negAccountId = negOrder.raw_data?.account_id?.toString();
      const negAmount = Math.abs(Number(negOrder.amount));
      const negArticleId = negOrder.barsy_article_id;
      const negDate = negOrder.order_date;

      // Check if there's a matching positive order on a different account
      const hasMatchingTransfer = positiveOrders.some((posOrder) => {
        const posAccountId = posOrder.raw_data?.account_id?.toString();
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
  }

  // Group orders by account_id
  const ordersByAccount = new Map<string, typeof allOrders>();
  for (const order of allOrders) {
    const accountId = order.raw_data?.account_id?.toString();
    if (accountId) {
      if (!ordersByAccount.has(accountId)) {
        ordersByAccount.set(accountId, []);
      }
      ordersByAccount.get(accountId)!.push(order);
    }
  }

  // Filter for accounts with pure voids (not transfers)
  const accounts = [];
  for (const account of zeroAccounts) {
    const accountOrdersList = ordersByAccount.get(
      account.barsy_account_id?.toString() || ""
    );

    if (accountOrdersList && accountOrdersList.length > 0) {
      const hasPositive = accountOrdersList.some((o) => Number(o.amount) > 0);
      const negativeOrders = accountOrdersList.filter(
        (o) => Number(o.amount) < 0
      );

      // Check if there are any pure voids (negative orders that are NOT transfers)
      const pureVoidOrders = negativeOrders.filter(
        (o) => !transferOrderIds.has(o.barsy_order_id)
      );

      // Include only if has positive orders AND has pure voids (not just transfers)
      if (hasPositive && pureVoidOrders.length > 0) {
        accounts.push(account);
      }
    }
  }

  // Build transactions from accounts using already-fetched orders
  const transactions: ZeroAmountTransaction[] = accounts.map((account) => {
    const rawData = account.raw_data as any;
    const accountOrdersList =
      ordersByAccount.get(account.barsy_account_id?.toString() || "") || [];

    // Sort orders by order_date
    const sortedOrders = [...accountOrdersList].sort((a, b) =>
      (a.order_date || "").localeCompare(b.order_date || "")
    );

    const lineItems: LineItem[] = sortedOrders.map((order) => {
      const amount = Number(order.amount) || 0;
      let voidType: "transfer" | "pure_void" | null = null;

      if (amount < 0) {
        voidType = transferOrderIds.has(order.barsy_order_id) ? "transfer" : "pure_void";
      }

      return {
        articleName: order.article_name || "Unknown",
        quantity: amount,
        unitPrice: Number(order.actual_price) || 0,
        total: (Number(order.actual_price) || 0) * amount,
        voidType,
      };
    });

    // Calculate storno amount (sum of positive orders - what was voided)
    const rawStornoAmount = sortedOrders
      .filter((o) => Number(o.amount) > 0)
      .reduce((sum, o) => sum + Number(o.amount) * Number(o.actual_price), 0);
    const stornoAmount = excludeVat ? removeVat(rawStornoAmount) : rawStornoAmount;

    // Apply VAT exclusion to line items as well
    const adjustedLineItems = excludeVat
      ? lineItems.map((item) => ({
          ...item,
          unitPrice: removeVat(item.unitPrice),
          total: removeVat(item.total),
          voidType: item.voidType,
        }))
      : lineItems;

    return {
      id: account.id,
      accountNumber:
        account.account_number || account.barsy_account_id?.toString() || "N/A",
      openDate: account.open_date || "",
      closeDate: account.close_date || "",
      stornoAmount: stornoAmount,
      placeName: rawData?.place_num
        ? `${rawData.salon_name || ""} ${rawData.place_num}`.trim()
        : "N/A",
      userName: rawData?.user_name || "N/A",
      paymentName: rawData?.payment_name || null,
      lineItems: adjustedLineItems,
    };
  });

  return { data: transactions };
};
