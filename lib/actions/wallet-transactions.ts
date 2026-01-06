"use server";

import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export interface WalletLineItem {
  articleName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  voidType: "transfer" | "pure_void" | null;
}

export interface WalletTransaction {
  id: string;
  accountNumber: string;
  openDate: string;
  closeDate: string;
  totalAmount: number;
  placeName: string;
  userName: string;
  clientName: string | null;
  paymentName: string | null;
  lineItems: WalletLineItem[];
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

export const getWalletTransactions = async (
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

  // Fetch all wallet accounts for the date
  // Wallet is detected by: payment_name contains 'изход', payment_short_name contains 'кд', or paymethod_id = '3'
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

  // Filter for wallet payment method accounts
  const walletAccounts = accounts.filter((account) => {
    const rawData = account.raw_data as any;
    const paymentName = rawData?.payment_name?.toLowerCase() || "";
    const paymentShortName = rawData?.payment_short_name?.toLowerCase() || "";
    const paymethodId = rawData?.paymethod_id?.toString() || "";

    return (
      paymentName.includes("изход") ||
      paymentShortName.includes("кд") ||
      paymethodId === "3"
    );
  });

  if (walletAccounts.length === 0) {
    return { data: [] };
  }

  // Fetch all clients for this location to look up client names
  // Check both client_id column and raw_data.client_id
  const clientIds = walletAccounts
    .map((acc) => {
      const rawData = acc.raw_data as any;
      return acc.client_id || rawData?.client_id;
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
  const accountBarsyIds = walletAccounts
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
      .select("barsy_order_id, barsy_article_id, article_name, actual_price, amount, order_date, raw_data")
      .in("raw_data->>account_id", accountBarsyIds)
      .order("order_date", { ascending: true });

    allOrdersForAccounts = (ordersData || []) as typeof allOrdersForAccounts;
  }

  // Build transfer detection set
  const transferOrderIds = new Set<number>();
  const negativeOrders = allOrdersForAccounts.filter((o) => Number(o.amount) < 0);
  const positiveOrders = allOrdersForAccounts.filter((o) => Number(o.amount) > 0);

  for (const negOrder of negativeOrders) {
    const negAccountId = (negOrder.raw_data as Record<string, unknown>)?.account_id?.toString();
    const negAmount = Math.abs(Number(negOrder.amount));
    const negArticleId = negOrder.barsy_article_id;
    const negDate = negOrder.order_date;

    // Check if there's a matching positive order on a different account
    const hasMatchingTransfer = positiveOrders.some((posOrder) => {
      const posAccountId = (posOrder.raw_data as Record<string, unknown>)?.account_id?.toString();
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
    const accountId = (order.raw_data as Record<string, unknown>)?.account_id?.toString();
    if (accountId) {
      if (!ordersByAccount.has(accountId)) {
        ordersByAccount.set(accountId, []);
      }
      ordersByAccount.get(accountId)!.push(order);
    }
  }

  // Fetch line items for each account
  const transactions: WalletTransaction[] = await Promise.all(
    walletAccounts.map(async (account) => {
      const rawData = account.raw_data as any;
      const accountOrders = ordersByAccount.get(account.barsy_account_id?.toString() || "") || [];

      const lineItems: WalletLineItem[] = accountOrders.map((order) => {
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

      // Get client name from clients map or fall back to raw_data
      // Check both client_id column and raw_data.client_id
      const clientIdToLookup = account.client_id || rawData?.client_id;
      const clientNameFromDb = clientIdToLookup
        ? clientsMap.get(clientIdToLookup)
        : null;

      // Use client name from DB, or raw_data.client_name (skip if it's "Anonymous")
      const rawClientName = rawData?.client_name;
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
            voidType: item.voidType,
          }))
        : lineItems;

      return {
        id: account.id,
        accountNumber:
          account.account_number ||
          account.barsy_account_id?.toString() ||
          "N/A",
        openDate: account.open_date || "",
        closeDate: account.close_date || "",
        totalAmount,
        placeName: rawData?.place_num
          ? `${rawData.salon_name || ""} ${rawData.place_num}`.trim()
          : "N/A",
        userName: rawData?.user_name || "N/A",
        clientName: clientName,
        paymentName: rawData?.payment_name || null,
        lineItems: adjustedLineItems,
      };
    })
  );

  return { data: transactions };
};
