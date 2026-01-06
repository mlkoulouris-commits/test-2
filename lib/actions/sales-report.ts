"use server";

import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export interface DailySalesReport {
  date: string;
  totalSales: number;
  totalTransactions: number;
  zeroAmountTransactions: number;
  zeroAmountItemsSum: number;
  regularSales: number;
  regularTransactions: number;
  cashSales: number;
  cashTransactions: number;
  cardSales: number;
  cardTransactions: number;
  invoiceSales: number;
  invoiceTransactions: number;
  compSales: number;
  compTransactions: number;
  walletSales: number;
  walletTransactions: number;
  noPaymentSales: number;
  noPaymentTransactions: number;
  tips: number;
  waste: number;
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

const getFiscalDate = (orderDate: string): string => {
  // orderDate format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  let datePart: string;
  let timePart: string;

  if (orderDate.includes(" ")) {
    [datePart, timePart] = orderDate.split(" ");
  } else if (orderDate.includes("T")) {
    [datePart, timePart] = orderDate.split("T");
  } else {
    return orderDate; // No time component, return as-is
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

const extractDatePart = (dateString: string): string => {
  if (dateString.includes(" ")) {
    return dateString.split(" ")[0];
  } else if (dateString.includes("T")) {
    return dateString.split("T")[0];
  }
  return dateString;
};

export const getDailySalesReport = async (
  startDate: string,
  endDate: string,
  locationId?: string,
  useFiscalDate: boolean = false,
  excludeVat: boolean = false,
  excludeNoPayment: boolean = true
) => {
  const supabase = await createClient();

  // Build date range for query
  // When using fiscal date, we need to extend the query range
  // Orders before 6:45 AM on the next day should be included in the endDate's fiscal report
  let queryStartDate = startDate;
  let queryEndDate = endDate;

  if (useFiscalDate) {
    // Extend end date to include early morning hours of the next day
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    queryEndDate = format(endDateObj, "yyyy-MM-dd");
  }

  // Build WHERE conditions for orders
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (useFiscalDate) {
    // Fiscal date: start from 6:45 AM on the start date
    conditions.push(`o.order_date >= $${paramIndex}`);
    params.push(
      `${queryStartDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
    );
    paramIndex++;

    // Fiscal date: extend to 6:44:59 AM on the day after end date
    conditions.push(`o.order_date < $${paramIndex}`);
    params.push(
      `${queryEndDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
    );
    paramIndex++;
  } else {
    conditions.push(`o.order_date >= $${paramIndex}`);
    params.push(`${queryStartDate} 00:00:00`);
    paramIndex++;

    conditions.push(`o.order_date <= $${paramIndex}`);
    params.push(`${queryEndDate} 23:59:59`);
    paramIndex++;
  }

  if (locationId) {
    conditions.push(`o.location_id = $${paramIndex}`);
    params.push(locationId);
    paramIndex++;
  }

  // Build location filter for account lookup
  const locationFilter = locationId
    ? `AND a.location_id = '${locationId}'`
    : "";

  // Build date conditions for transfer detection (performance optimization)
  const transferDateConditions = useFiscalDate
    ? `vo.order_date >= '${queryStartDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00' AND vo.order_date < '${queryEndDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00'`
    : `vo.order_date >= '${queryStartDate}' AND vo.order_date <= '${queryEndDate}'`;

  // Use SQL to aggregate orders by account, with payment info from accounts
  // Group by order_date (with fiscal date logic applied in post-processing)
  const query = `
    WITH transfer_orders AS (
      -- Find voided orders that have a matching transfer (same article, qty, timestamp on different account)
      SELECT DISTINCT vo.barsy_order_id
      FROM barsy_orders vo
      JOIN barsy_orders po ON
        po.barsy_article_id = vo.barsy_article_id
        AND po.amount::numeric = ABS(vo.amount::numeric)
        AND po.raw_data->>'account_id' != vo.raw_data->>'account_id'
        AND po.order_date = vo.order_date
      WHERE vo.amount::numeric < 0
        AND ${transferDateConditions}
    ),
    order_details AS (
      SELECT
        o.id,
        o.order_date,
        o.article_name,
        o.amount::numeric as quantity,
        o.actual_price::numeric as unit_price,
        (o.amount::numeric * o.actual_price::numeric) as line_total,
        o.raw_data->>'account_id' as account_id,
        o.barsy_order_id,
        o.location_id,
        -- Detect tips and waste
        CASE
          WHEN LOWER(o.article_name) LIKE '%бакшиш%'
            OR LOWER(o.article_name) LIKE '%tip%'
            OR LOWER(o.article_name) LIKE '%типс%'
          THEN true ELSE false
        END as is_tip,
        CASE
          WHEN LOWER(o.article_name) LIKE '%брак%'
            OR LOWER(o.article_name) LIKE '%waste%'
            OR LOWER(o.article_name) LIKE '%brak%'
          THEN true ELSE false
        END as is_waste,
        -- Detect void type
        CASE
          WHEN o.amount::numeric < 0 AND EXISTS (
            SELECT 1 FROM transfer_orders t WHERE t.barsy_order_id = o.barsy_order_id
          ) THEN 'transfer'
          WHEN o.amount::numeric < 0 THEN 'pure_void'
          ELSE NULL
        END as void_type
      FROM barsy_orders o
      WHERE ${conditions.join(" AND ")}
    ),
    account_payment_info AS (
      -- Get payment method info for each account
      SELECT DISTINCT ON (barsy_account_id)
        barsy_account_id::text as account_id,
        location_id,
        LOWER(COALESCE(raw_data->>'payment_name', '')) as payment_name,
        LOWER(COALESCE(raw_data->>'payment_short_name', '')) as payment_short_name,
        COALESCE(raw_data->>'paymethod_id', '') as paymethod_id,
        LOWER(COALESCE(raw_data->>'paymethod_name', '')) as paymethod_name
      FROM barsy_accounts a
      WHERE 1=1 ${locationFilter}
    ),
    order_with_payment AS (
      SELECT
        od.*,
        api.payment_name,
        api.payment_short_name,
        api.paymethod_id,
        api.paymethod_name,
        -- Determine payment category
        CASE
          WHEN api.payment_name LIKE '%изход%'
            OR api.payment_short_name LIKE '%кд%'
            OR api.paymethod_id = '3' THEN 'wallet'
          WHEN api.payment_name LIKE '%брой%'
            OR api.payment_name LIKE '%каса%'
            OR api.payment_name LIKE '%cash%' THEN 'cash'
          WHEN api.payment_name LIKE '%карта%'
            OR api.payment_name LIKE '%card%'
            OR api.payment_name LIKE '%pos%'
            OR api.payment_name LIKE '%терминал%' THEN 'card'
          WHEN api.payment_name LIKE '%фактура%'
            OR api.payment_name LIKE '%invoice%' THEN 'invoice'
          WHEN api.payment_name = '' AND api.paymethod_name = '' THEN 'no_payment'
          ELSE 'no_payment'
        END as payment_category
      FROM order_details od
      LEFT JOIN account_payment_info api ON od.account_id = api.account_id
    ),
    account_aggregates AS (
      -- Aggregate by account to count unique transactions
      SELECT
        account_id,
        MIN(order_date) as first_order_date,
        MAX(order_date) as last_order_date,
        MAX(payment_category) as payment_category,
        SUM(CASE WHEN NOT is_tip AND NOT is_waste AND quantity > 0 THEN line_total ELSE 0 END) as sales_amount,
        SUM(CASE WHEN is_tip AND quantity > 0 THEN line_total ELSE 0 END) as tips,
        SUM(CASE WHEN is_waste AND quantity > 0 THEN line_total ELSE 0 END) as waste,
        -- Check if this is a zero-amount transaction with pure voids
        BOOL_OR(void_type = 'pure_void') as has_pure_void,
        SUM(CASE WHEN quantity > 0 AND NOT is_tip AND NOT is_waste THEN line_total ELSE 0 END) as positive_sales
      FROM order_with_payment
      GROUP BY account_id
    )
    SELECT
      owp.order_date,
      owp.account_id,
      owp.is_tip,
      owp.is_waste,
      owp.void_type,
      owp.quantity,
      owp.line_total,
      owp.payment_category,
      aa.has_pure_void,
      aa.positive_sales,
      aa.sales_amount as account_sales,
      aa.tips as account_tips,
      aa.waste as account_waste
    FROM order_with_payment owp
    LEFT JOIN account_aggregates aa ON owp.account_id = aa.account_id
    ORDER BY owp.order_date DESC
  `;

  // Replace parameters in query
  let finalQuery = query;
  params.forEach((param, index) => {
    const placeholder = `$${index + 1}`;
    const value = typeof param === "string" ? `'${param}'` : param;
    finalQuery = finalQuery.replace(
      new RegExp(`\\$${index + 1}(?![0-9])`, "g"),
      value
    );
  });

  const { data: orders, error } = await supabase.rpc("execute_sql", {
    query: finalQuery,
  });

  if (error) {
    console.error("Sales report query error:", error);
    return { error: error.message };
  }

  // Process orders and aggregate by date (applying fiscal date logic)
  const groupedData: Record<string, DailySalesReport> = {};
  const processedAccounts = new Set<string>(); // Track accounts already processed for transaction counting
  const zeroAmountAccounts = new Set<string>(); // Track zero-amount accounts

  // First pass: identify zero-amount accounts with pure voids
  const accountSummary = new Map<
    string,
    {
      orderDate: string;
      hasPositiveSales: boolean;
      hasPureVoid: boolean;
      positiveValue: number;
      paymentCategory: string;
    }
  >();

  for (const order of orders || []) {
    const accountId = order.account_id;
    if (!accountId) continue;

    const orderDate = order.order_date;
    const date = useFiscalDate
      ? getFiscalDate(orderDate)
      : extractDatePart(orderDate);

    if (!accountSummary.has(accountId)) {
      accountSummary.set(accountId, {
        orderDate: date,
        hasPositiveSales: false,
        hasPureVoid: false,
        positiveValue: 0,
        paymentCategory: order.payment_category || "no_payment",
      });
    }

    const summary = accountSummary.get(accountId)!;

    if (Number(order.quantity) > 0 && !order.is_tip && !order.is_waste) {
      summary.hasPositiveSales = true;
      summary.positiveValue += Number(order.line_total);
    }

    if (order.void_type === "pure_void") {
      summary.hasPureVoid = true;
    }
  }

  // Identify zero-amount accounts
  for (const [accountId, summary] of accountSummary.entries()) {
    if (summary.hasPureVoid && summary.hasPositiveSales) {
      // Check if total is approximately zero (positive sales cancelled by voids)
      // This account had sales but they were voided
      zeroAmountAccounts.add(accountId);
    }
  }

  // Second pass: aggregate by date
  for (const order of orders || []) {
    const orderDate = order.order_date;
    if (!orderDate) continue;

    // Apply fiscal date logic to order_date
    const date = useFiscalDate
      ? getFiscalDate(orderDate)
      : extractDatePart(orderDate);

    if (!date || date.length !== 10) continue;

    // Initialize date record if needed
    if (!groupedData[date]) {
      groupedData[date] = {
        date,
        totalSales: 0,
        totalTransactions: 0,
        zeroAmountTransactions: 0,
        zeroAmountItemsSum: 0,
        regularSales: 0,
        regularTransactions: 0,
        cashSales: 0,
        cashTransactions: 0,
        cardSales: 0,
        cardTransactions: 0,
        invoiceSales: 0,
        invoiceTransactions: 0,
        compSales: 0,
        compTransactions: 0,
        walletSales: 0,
        walletTransactions: 0,
        noPaymentSales: 0,
        noPaymentTransactions: 0,
        tips: 0,
        waste: 0,
      };
    }

    const accountId = order.account_id;
    const accountDateKey = `${accountId}:${date}`;
    const quantity = Number(order.quantity) || 0;
    const lineTotal = Number(order.line_total) || 0;
    const isTip = order.is_tip;
    const isWaste = order.is_waste;
    const paymentCategory = order.payment_category || "no_payment";
    const isNoPayment = paymentCategory === "no_payment";

    // Apply VAT exclusion if needed
    const amount = excludeVat ? removeVat(lineTotal) : lineTotal;

    // Skip voided items from sales totals
    if (quantity < 0) continue;

    // Add tips
    if (isTip && quantity > 0) {
      groupedData[date].tips += amount;
      continue;
    }

    // Add waste
    if (isWaste && quantity > 0) {
      groupedData[date].waste += amount;
      continue;
    }

    // Skip if this is a zero-amount account (already voided)
    if (accountId && zeroAmountAccounts.has(accountId)) {
      // Track zero-amount transaction (only once per account per date)
      if (!processedAccounts.has(accountDateKey)) {
        processedAccounts.add(accountDateKey);
        groupedData[date].zeroAmountTransactions++;

        // Add the positive value that was voided
        const summary = accountSummary.get(accountId);
        if (summary) {
          const voidedValue = excludeVat
            ? removeVat(summary.positiveValue)
            : summary.positiveValue;
          groupedData[date].zeroAmountItemsSum += voidedValue;
        }
      }
      continue;
    }

    // Regular sale
    if (quantity > 0 && amount > 0) {
      // When excludeNoPayment is true, don't add no-payment transactions to totals
      const shouldIncludeInTotals = !excludeNoPayment || !isNoPayment;

      // Count transaction only once per account per date
      if (!processedAccounts.has(accountDateKey)) {
        processedAccounts.add(accountDateKey);

        if (shouldIncludeInTotals) {
          groupedData[date].totalTransactions++;
          groupedData[date].regularTransactions++;
        }

        // Count payment method transaction
        if (paymentCategory === "cash") {
          groupedData[date].cashTransactions++;
        } else if (paymentCategory === "card") {
          groupedData[date].cardTransactions++;
        } else if (paymentCategory === "invoice") {
          groupedData[date].invoiceTransactions++;
        } else if (paymentCategory === "wallet") {
          groupedData[date].walletTransactions++;
        } else {
          groupedData[date].noPaymentTransactions++;
        }
      }

      // Add sales amounts
      if (shouldIncludeInTotals) {
        groupedData[date].totalSales += amount;
        groupedData[date].regularSales += amount;
      }

      // Add to payment category
      if (paymentCategory === "cash") {
        groupedData[date].cashSales += amount;
      } else if (paymentCategory === "card") {
        groupedData[date].cardSales += amount;
      } else if (paymentCategory === "invoice") {
        groupedData[date].invoiceSales += amount;
      } else if (paymentCategory === "wallet") {
        groupedData[date].walletSales += amount;
      } else {
        groupedData[date].noPaymentSales += amount;
      }
    }
  }

  // Filter to only include dates within the requested range
  const reportData = Object.values(groupedData)
    .filter((day) => day.date >= startDate && day.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { data: reportData };
};
