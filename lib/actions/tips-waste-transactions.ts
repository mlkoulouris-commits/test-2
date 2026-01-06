"use server";

import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export interface TipsWasteOrder {
  id: string;
  articleName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  orderDate: string;
  accountNumber: string | null;
  placeName: string;
  userName: string;
}

export type TipsWasteType = "tips" | "waste";

// Fiscal cutoff time is 6:45 AM
const FISCAL_CUTOFF_HOUR = 6;
const FISCAL_CUTOFF_MINUTE = 45;

// Bulgarian VAT rate is 20%
const VAT_RATE = 0.2;

const removeVat = (amount: number): number => {
  return amount / (1 + VAT_RATE);
};

const getArticleFilter = (type: TipsWasteType): string[] => {
  switch (type) {
    case "tips":
      return ["%бакшиш%", "%tip%", "%типс%"];
    case "waste":
      return ["%брак%", "%waste%", "%brak%"];
    default:
      return [];
  }
};

export const getTipsWasteTransactions = async (
  date: string,
  type: TipsWasteType,
  locationId?: string,
  useFiscalDate: boolean = false,
  excludeVat: boolean = false
) => {
  const supabase = await createClient();

  // When using fiscal date, we need to query a wider range
  let startDateTime: string;
  let endDateTime: string;

  if (useFiscalDate) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = format(nextDate, "yyyy-MM-dd");

    startDateTime = `${date} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`;
    endDateTime = `${nextDateStr} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE - 1}:59`;
  } else {
    startDateTime = date;
    endDateTime = date;
  }

  const articlePatterns = getArticleFilter(type);

  if (articlePatterns.length === 0) {
    return { data: [] };
  }

  // Build the query with OR conditions for article name patterns
  let query = supabase
    .from("barsy_orders")
    .select(
      "id, article_name, amount, actual_price, order_date, raw_data"
    )
    .gt("amount", 0) // Only positive amounts (not voids)
    .gte("order_date", startDateTime)
    .lte("order_date", endDateTime);

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  // Apply article name filter using ilike with OR
  query = query.or(
    articlePatterns.map(pattern => `article_name.ilike.${pattern}`).join(",")
  );

  query = query.order("order_date", { ascending: true });

  const { data: orders, error } = await query;

  if (error) {
    return { error: error.message };
  }

  if (!orders || orders.length === 0) {
    return { data: [] };
  }

  // Get account IDs for looking up account info
  const accountIds = [...new Set(
    orders
      .map((o) => (o.raw_data as Record<string, unknown>)?.account_id?.toString())
      .filter(Boolean)
  )] as string[];

  // Fetch account info for display
  let accountsMap = new Map<string, { accountNumber: string; placeName: string; userName: string }>();

  if (accountIds.length > 0) {
    let accountsQuery = supabase
      .from("barsy_accounts")
      .select("barsy_account_id, account_number, raw_data")
      .in("barsy_account_id", accountIds.map(Number).filter(n => !isNaN(n)));

    if (locationId) {
      accountsQuery = accountsQuery.eq("location_id", locationId);
    }

    const { data: accounts } = await accountsQuery;

    if (accounts) {
      for (const account of accounts) {
        const rawData = account.raw_data as Record<string, unknown>;
        accountsMap.set(account.barsy_account_id?.toString() || "", {
          accountNumber: account.account_number || account.barsy_account_id?.toString() || "N/A",
          placeName: rawData?.place_num
            ? `${(rawData.salon_name as string) || ""} ${rawData.place_num}`.trim()
            : "N/A",
          userName: (rawData?.user_name as string) || "N/A",
        });
      }
    }
  }

  // Transform orders into the response format
  const transactions: TipsWasteOrder[] = orders.map((order) => {
    const rawData = order.raw_data as Record<string, unknown>;
    const accountId = rawData?.account_id?.toString() || "";
    const accountInfo = accountsMap.get(accountId);

    const rawAmount = Number(order.amount) || 0;
    const rawPrice = Number(order.actual_price) || 0;
    const quantity = rawAmount;
    const unitPrice = excludeVat ? removeVat(rawPrice) : rawPrice;
    const total = quantity * unitPrice;

    return {
      id: order.id,
      articleName: order.article_name || "Unknown",
      quantity,
      unitPrice,
      total,
      orderDate: order.order_date || "",
      accountNumber: accountInfo?.accountNumber || null,
      placeName: accountInfo?.placeName || "N/A",
      userName: accountInfo?.userName || "N/A",
    };
  });

  return { data: transactions };
};
