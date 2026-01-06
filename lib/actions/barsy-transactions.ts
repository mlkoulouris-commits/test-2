"use server";

import { createClient } from "@/lib/supabase/server";

// Fiscal cutoff time is 6:45 AM
const FISCAL_CUTOFF_HOUR = 6;
const FISCAL_CUTOFF_MINUTE = 45;

interface GroupedTransaction {
  account_id: string;
  order_date: string;
  location_name: string;
  user_name: string | null;
  total_amount: number;
  total_discount: number;
  payment_methods: string[];
  line_items: Array<{
    article_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    discount: number;
  }>;
}

export type VoidFilter =
  | "all"
  | "positive_only"
  | "voided_only"
  | "transfers_only"
  | "pure_voids_only";

export const getBarsyTransactions = async (
  dateFrom?: string,
  dateTo?: string,
  locationId?: string,
  page: number = 1,
  pageSize: number = 50,
  userId?: string,
  discountFilter?: "all" | "with_discount" | "no_discount",
  paymentMethodFilter?: string,
  voidFilter?: VoidFilter,
  useFiscalDate: boolean = false
) => {
  const supabase = await createClient();

  // Build WHERE conditions for SQL query
  const conditions: string[] = ["1=1"];
  const params: any[] = [];
  let paramIndex = 1;

  if (dateFrom) {
    if (useFiscalDate) {
      // Fiscal date: start from 6:45 AM on the start date
      conditions.push(`o.order_date >= $${paramIndex}`);
      params.push(
        `${dateFrom} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      conditions.push(`o.order_date >= $${paramIndex}`);
      params.push(dateFrom);
    }
    paramIndex++;
  }
  if (dateTo) {
    if (useFiscalDate) {
      // Fiscal date: extend to 6:44:59 AM on the day after end date
      const endDateObj = new Date(dateTo);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const extendedEndDate = endDateObj.toISOString().split("T")[0];
      conditions.push(`o.order_date < $${paramIndex}`);
      params.push(
        `${extendedEndDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      conditions.push(`o.order_date <= $${paramIndex}`);
      params.push(dateTo);
    }
    paramIndex++;
  }
  if (locationId) {
    conditions.push(`o.location_id = $${paramIndex}`);
    params.push(locationId);
    paramIndex++;
  }
  if (userId) {
    conditions.push(`o.user_name = $${paramIndex}`);
    params.push(userId);
    paramIndex++;
  }
  if (discountFilter === "with_discount") {
    conditions.push(`(o.raw_data->>'discount')::numeric != 0`);
  } else if (discountFilter === "no_discount") {
    conditions.push(`(COALESCE((o.raw_data->>'discount')::numeric, 0) = 0)`);
  }

  // Apply void filter
  if (voidFilter === "positive_only") {
    conditions.push(`o.amount::numeric > 0`);
  } else if (
    voidFilter === "voided_only" ||
    voidFilter === "transfers_only" ||
    voidFilter === "pure_voids_only"
  ) {
    conditions.push(`o.amount::numeric < 0`);
  }

  // Build payment method CTE filter
  let paymentCTE = "";
  if (paymentMethodFilter && paymentMethodFilter !== "all") {
    if (paymentMethodFilter === "no_payment") {
      paymentCTE = `AND (a.raw_data->>'payment_name' IS NULL AND a.raw_data->>'paymethod_name' IS NULL)`;
    } else if (paymentMethodFilter === "cash") {
      paymentCTE = `AND (
        LOWER(a.raw_data->>'payment_name') LIKE '%брой%' OR
        LOWER(a.raw_data->>'payment_name') LIKE '%cash%' OR
        LOWER(a.raw_data->>'payment_name') LIKE '%каса%' OR
        LOWER(a.raw_data->>'paymethod_name') LIKE '%брой%' OR
        LOWER(a.raw_data->>'paymethod_name') LIKE '%cash%' OR
        LOWER(a.raw_data->>'paymethod_name') LIKE '%каса%'
      )`;
    } else if (paymentMethodFilter === "card") {
      paymentCTE = `AND (
        LOWER(a.raw_data->>'payment_name') LIKE '%карта%' OR
        LOWER(a.raw_data->>'payment_name') LIKE '%card%' OR
        LOWER(a.raw_data->>'payment_name') LIKE '%pos%' OR
        LOWER(a.raw_data->>'payment_name') LIKE '%терминал%' OR
        LOWER(a.raw_data->>'paymethod_name') LIKE '%карта%' OR
        LOWER(a.raw_data->>'paymethod_name') LIKE '%card%' OR
        LOWER(a.raw_data->>'paymethod_name') LIKE '%pos%' OR
        LOWER(a.raw_data->>'paymethod_name') LIKE '%терминал%'
      )`;
    } else if (paymentMethodFilter === "wallet") {
      paymentCTE = `AND (
        LOWER(a.raw_data->>'payment_name') LIKE '%изход%' OR
        LOWER(a.raw_data->>'payment_short_name') LIKE '%кд%' OR
        (a.raw_data->>'paymethod_id')::text = '3'
      )`;
    }
  }

  const offset = (page - 1) * pageSize;

  // Use SQL for database-side aggregation with void_type detection
  // Build date conditions for transfer_orders CTE (for performance)
  const transferDateConditions: string[] = [];
  if (dateFrom) {
    transferDateConditions.push(`vo.order_date >= '${dateFrom}'`);
  }
  if (dateTo) {
    transferDateConditions.push(`vo.order_date <= '${dateTo}'`);
  }
  const transferDateFilter =
    transferDateConditions.length > 0
      ? `AND ${transferDateConditions.join(" AND ")}`
      : "";

  // Build payment filter conditions for filtering transactions (not just fetching payment methods)
  let paymentFilterCondition = "";
  if (paymentMethodFilter && paymentMethodFilter !== "all") {
    if (paymentMethodFilter === "no_payment") {
      // Filter for transactions where account has NO payment method set
      paymentFilterCondition = `
        WHERE NOT EXISTS (
          SELECT 1 FROM barsy_accounts a
          WHERE g.account_id = a.barsy_account_id::text
          AND (a.raw_data->>'payment_name' IS NOT NULL OR a.raw_data->>'paymethod_name' IS NOT NULL)
        )
      `;
    } else if (paymentMethodFilter === "cash") {
      paymentFilterCondition = `
        WHERE EXISTS (
          SELECT 1 FROM barsy_accounts a
          WHERE g.account_id = a.barsy_account_id::text
          AND (
            LOWER(a.raw_data->>'payment_name') LIKE '%брой%' OR
            LOWER(a.raw_data->>'payment_name') LIKE '%cash%' OR
            LOWER(a.raw_data->>'payment_name') LIKE '%каса%' OR
            LOWER(a.raw_data->>'paymethod_name') LIKE '%брой%' OR
            LOWER(a.raw_data->>'paymethod_name') LIKE '%cash%' OR
            LOWER(a.raw_data->>'paymethod_name') LIKE '%каса%'
          )
        )
      `;
    } else if (paymentMethodFilter === "card") {
      paymentFilterCondition = `
        WHERE EXISTS (
          SELECT 1 FROM barsy_accounts a
          WHERE g.account_id = a.barsy_account_id::text
          AND (
            LOWER(a.raw_data->>'payment_name') LIKE '%карта%' OR
            LOWER(a.raw_data->>'payment_name') LIKE '%card%' OR
            LOWER(a.raw_data->>'payment_name') LIKE '%pos%' OR
            LOWER(a.raw_data->>'payment_name') LIKE '%терминал%' OR
            LOWER(a.raw_data->>'paymethod_name') LIKE '%карта%' OR
            LOWER(a.raw_data->>'paymethod_name') LIKE '%card%' OR
            LOWER(a.raw_data->>'paymethod_name') LIKE '%pos%' OR
            LOWER(a.raw_data->>'paymethod_name') LIKE '%терминал%'
          )
        )
      `;
    } else if (paymentMethodFilter === "wallet") {
      paymentFilterCondition = `
        WHERE EXISTS (
          SELECT 1 FROM barsy_accounts a
          WHERE g.account_id = a.barsy_account_id::text
          AND (
            LOWER(a.raw_data->>'payment_name') LIKE '%изход%' OR
            LOWER(a.raw_data->>'payment_short_name') LIKE '%кд%' OR
            (a.raw_data->>'paymethod_id')::text = '3'
          )
        )
      `;
    }
  }

  const query = `
    WITH transfer_orders AS (
      -- Find voided orders that have a matching transfer (same article, qty, timestamp on different account)
      -- Limited to the date range for performance
      SELECT DISTINCT vo.barsy_order_id
      FROM barsy_orders vo
      JOIN barsy_orders po ON
        po.barsy_article_id = vo.barsy_article_id
        AND po.amount::numeric = ABS(vo.amount::numeric)
        AND po.raw_data->>'account_id' != vo.raw_data->>'account_id'
        AND po.order_date = vo.order_date
      WHERE vo.amount::numeric < 0 ${transferDateFilter}
    ),
    grouped_orders AS (
      SELECT
        COALESCE((o.raw_data->>'account_id'), 'single-' || o.id::text) as account_id,
        MAX(o.order_date) as order_date,
        MAX(l.name) as location_name,
        MAX(o.user_name) as user_name,
        SUM(o.amount::numeric * o.actual_price::numeric) as total_amount,
        SUM(CASE
          WHEN COALESCE((o.raw_data->>'discount')::numeric, 0) != 0
          THEN ABS(o.amount::numeric * o.actual_price::numeric * COALESCE((o.raw_data->>'discount')::numeric, 0) / 100)
          ELSE 0
        END) as total_discount,
        json_agg(json_build_object(
          'article_name', o.article_name,
          'quantity', o.amount::numeric,
          'unit_price', o.actual_price::numeric,
          'total', o.amount::numeric * o.actual_price::numeric,
          'discount', COALESCE(ABS((o.raw_data->>'discount')::numeric), 0),
          'barsy_order_id', o.barsy_order_id,
          'void_type', CASE
            WHEN o.amount::numeric < 0 AND EXISTS (SELECT 1 FROM transfer_orders t WHERE t.barsy_order_id = o.barsy_order_id) THEN 'transfer'
            WHEN o.amount::numeric < 0 THEN 'pure_void'
            ELSE NULL
          END
        ) ORDER BY o.order_date) as line_items
      FROM barsy_orders o
      LEFT JOIN barsy_locations l ON o.location_id = l.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY COALESCE((o.raw_data->>'account_id'), 'single-' || o.id::text)
    ),
    filtered_orders AS (
      SELECT g.*
      FROM grouped_orders g
      ${paymentFilterCondition}
    ),
    final_result AS (
      SELECT
        g.account_id,
        g.order_date,
        g.location_name,
        g.user_name,
        g.total_amount,
        g.total_discount,
        g.line_items,
        (
          SELECT ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(a.raw_data->>'payment_name', a.raw_data->>'paymethod_name')), NULL)
          FROM barsy_accounts a
          WHERE g.account_id = a.barsy_account_id::text
        ) as payment_methods,
        (
          SELECT MAX(a.raw_data->>'client_name')
          FROM barsy_accounts a
          WHERE g.account_id = a.barsy_account_id::text
        ) as client_name,
        COUNT(*) OVER() as total_count
      FROM filtered_orders g
      ORDER BY g.order_date DESC
      LIMIT ${pageSize} OFFSET ${offset}
    )
    SELECT * FROM final_result
  `;

  // Replace parameters in query
  let finalQuery = query;
  params.forEach((param, index) => {
    const placeholder = `$${index + 1}`;
    const value = typeof param === "string" ? `'${param}'` : param;
    finalQuery = finalQuery.replace(placeholder, value);
  });

  // Execute raw SQL
  const { data, error } = await supabase.rpc("execute_sql", {
    query: finalQuery,
  });

  if (error) {
    console.error("Transaction query error:", error);
    return { error: error.message };
  }

  let transactions = data || [];
  const totalCount = transactions.length > 0 ? transactions[0].total_count : 0;

  // For transfers_only and pure_voids_only, filter line items within each transaction
  if (voidFilter === "transfers_only" || voidFilter === "pure_voids_only") {
    const targetVoidType =
      voidFilter === "transfers_only" ? "transfer" : "pure_void";

    transactions = transactions
      .map((tx: any) => {
        const filteredLineItems = (tx.line_items || []).filter(
          (item: any) => item.void_type === targetVoidType
        );
        return {
          ...tx,
          line_items: filteredLineItems,
          // Recalculate totals based on filtered items
          total_amount: filteredLineItems.reduce(
            (sum: number, item: any) => sum + (item.total || 0),
            0
          ),
        };
      })
      .filter((tx: any) => tx.line_items.length > 0); // Remove transactions with no matching items
  }

  return {
    data: transactions.map((tx: any) => ({
      account_id: tx.account_id,
      order_date: tx.order_date,
      location_name: tx.location_name,
      user_name: tx.user_name,
      client_name: tx.client_name || null,
      total_amount: Number(tx.total_amount),
      total_discount: Number(tx.total_discount),
      payment_methods: Array.isArray(tx.payment_methods)
        ? tx.payment_methods
        : [],
      line_items: tx.line_items,
    })),
    count:
      voidFilter === "transfers_only" || voidFilter === "pure_voids_only"
        ? transactions.length // Use filtered count for these filters
        : totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(
      (voidFilter === "transfers_only" || voidFilter === "pure_voids_only"
        ? transactions.length
        : totalCount) / pageSize
    ),
  };
};

export const getBarsyTransactionStats = async (
  dateFrom?: string,
  dateTo?: string,
  locationId?: string,
  userId?: string,
  discountFilter?: "all" | "with_discount" | "no_discount",
  paymentMethodFilter?: string,
  useFiscalDate: boolean = false
) => {
  const supabase = await createClient();

  // Build WHERE conditions
  const conditions: string[] = ["1=1"];
  const params: any[] = [];
  let paramIndex = 1;

  if (dateFrom) {
    if (useFiscalDate) {
      // Fiscal date: start from 6:45 AM on the start date
      conditions.push(`o.order_date >= $${paramIndex}`);
      params.push(
        `${dateFrom} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      conditions.push(`o.order_date >= $${paramIndex}`);
      params.push(dateFrom);
    }
    paramIndex++;
  }
  if (dateTo) {
    if (useFiscalDate) {
      // Fiscal date: extend to 6:44:59 AM on the day after end date
      const endDateObj = new Date(dateTo);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const extendedEndDate = endDateObj.toISOString().split("T")[0];
      conditions.push(`o.order_date < $${paramIndex}`);
      params.push(
        `${extendedEndDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      conditions.push(`o.order_date <= $${paramIndex}`);
      params.push(dateTo);
    }
    paramIndex++;
  }
  if (locationId) {
    conditions.push(`o.location_id = $${paramIndex}`);
    params.push(locationId);
    paramIndex++;
  }
  if (userId) {
    conditions.push(`o.user_name = $${paramIndex}`);
    params.push(userId);
    paramIndex++;
  }
  if (discountFilter === "with_discount") {
    conditions.push(`(o.raw_data->>'discount')::numeric != 0`);
  } else if (discountFilter === "no_discount") {
    conditions.push(`(COALESCE((o.raw_data->>'discount')::numeric, 0) = 0)`);
  }

  // Aggregate stats in database
  // Tips: article names containing 'бакшиш', 'tip', 'типс'
  // Waste: article names containing 'брак', 'waste', 'brak'
  const query = `
    SELECT
      COUNT(DISTINCT COALESCE((raw_data->>'account_id'), 'single-' || id::text)) as total_transactions,
      SUM(
        CASE
          WHEN LOWER(article_name) LIKE '%бакшиш%' OR LOWER(article_name) LIKE '%tip%' OR LOWER(article_name) LIKE '%типс%'
            OR LOWER(article_name) LIKE '%брак%' OR LOWER(article_name) LIKE '%waste%' OR LOWER(article_name) LIKE '%brak%'
          THEN 0
          ELSE amount::numeric * actual_price::numeric
        END
      ) as total_revenue,
      SUM(
        CASE
          WHEN LOWER(article_name) LIKE '%бакшиш%' OR LOWER(article_name) LIKE '%tip%' OR LOWER(article_name) LIKE '%типс%'
          THEN amount::numeric * actual_price::numeric
          ELSE 0
        END
      ) as total_tips,
      SUM(
        CASE
          WHEN LOWER(article_name) LIKE '%брак%' OR LOWER(article_name) LIKE '%waste%' OR LOWER(article_name) LIKE '%brak%'
          THEN amount::numeric * actual_price::numeric
          ELSE 0
        END
      ) as total_waste,
      COUNT(*) FILTER (WHERE COALESCE((raw_data->>'discount')::numeric, 0) != 0) as orders_with_discount,
      SUM(
        CASE
          WHEN COALESCE((raw_data->>'discount')::numeric, 0) != 0
          THEN ABS(amount::numeric * actual_price::numeric * COALESCE((raw_data->>'discount')::numeric, 0) / 100)
          ELSE 0
        END
      ) as total_discount
    FROM barsy_orders o
    WHERE ${conditions.join(" AND ")}
  `;

  // Replace parameters
  let finalQuery = query;
  params.forEach((param, index) => {
    const placeholder = `$${index + 1}`;
    const value = typeof param === "string" ? `'${param}'` : param;
    finalQuery = finalQuery.replace(placeholder, value);
  });

  const { data, error } = await supabase.rpc("execute_sql", {
    query: finalQuery,
  });

  if (error) {
    console.error("Transaction stats error:", error);
    return { error: error.message };
  }

  const stats =
    data && data.length > 0
      ? {
          totalTransactions: Number(data[0].total_transactions) || 0,
          totalRevenue: Number(data[0].total_revenue) || 0,
          totalTips: Number(data[0].total_tips) || 0,
          totalWaste: Number(data[0].total_waste) || 0,
          ordersWithDiscount: Number(data[0].orders_with_discount) || 0,
          totalDiscount: Number(data[0].total_discount) || 0,
        }
      : {
          totalTransactions: 0,
          totalRevenue: 0,
          totalTips: 0,
          totalWaste: 0,
          ordersWithDiscount: 0,
          totalDiscount: 0,
        };

  return { data: stats };
};

export interface StaffPerformanceData {
  user_name: string;
  transactions: number;
  revenue: number;
  cash: number;
  card: number;
  wallet: number;
  tips: number;
  waste: number;
  avg_transaction: number;
  items_sold: number;
  discounted_orders: number;
  total_discounts: number;
  void_count: number;
  void_rate: number;
}

export const getStaffPerformanceStats = async (
  dateFrom?: string,
  dateTo?: string,
  locationId?: string,
  useFiscalDate: boolean = false
): Promise<{ data?: StaffPerformanceData[]; error?: string }> => {
  const supabase = await createClient();

  // Build WHERE conditions
  const conditions: string[] = ["o.user_name IS NOT NULL"];
  const params: any[] = [];
  let paramIndex = 1;

  if (dateFrom) {
    if (useFiscalDate) {
      conditions.push(`o.order_date >= $${paramIndex}`);
      params.push(
        `${dateFrom} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      conditions.push(`o.order_date >= $${paramIndex}`);
      params.push(dateFrom);
    }
    paramIndex++;
  }
  if (dateTo) {
    if (useFiscalDate) {
      const endDateObj = new Date(dateTo);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const extendedEndDate = endDateObj.toISOString().split("T")[0];
      conditions.push(`o.order_date < $${paramIndex}`);
      params.push(
        `${extendedEndDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      conditions.push(`o.order_date <= $${paramIndex}`);
      params.push(dateTo);
    }
    paramIndex++;
  }
  if (locationId) {
    conditions.push(`o.location_id = $${paramIndex}`);
    params.push(locationId);
    paramIndex++;
  }

  const query = `
    SELECT
      o.user_name,
      COUNT(DISTINCT COALESCE((o.raw_data->>'account_id'), 'single-' || o.id::text)) as transactions,
      -- Revenue excludes tips + waste (consistent with overall transaction stats)
      SUM(
        CASE
          WHEN LOWER(o.article_name) LIKE '%бакшиш%' OR LOWER(o.article_name) LIKE '%tip%' OR LOWER(o.article_name) LIKE '%типс%'
            OR LOWER(o.article_name) LIKE '%брак%' OR LOWER(o.article_name) LIKE '%waste%' OR LOWER(o.article_name) LIKE '%brak%'
          THEN 0
          ELSE o.amount::numeric * o.actual_price::numeric
        END
      ) as revenue,
      -- Payment breakdown also excludes tips + waste
      SUM(
        CASE
          WHEN LOWER(o.article_name) LIKE '%бакшиш%' OR LOWER(o.article_name) LIKE '%tip%' OR LOWER(o.article_name) LIKE '%типс%'
            OR LOWER(o.article_name) LIKE '%брак%' OR LOWER(o.article_name) LIKE '%waste%' OR LOWER(o.article_name) LIKE '%brak%'
          THEN 0
          WHEN (
            LOWER(COALESCE(a.raw_data->>'payment_name', '')) LIKE '%брой%' OR
            LOWER(COALESCE(a.raw_data->>'payment_name', '')) LIKE '%cash%' OR
            LOWER(COALESCE(a.raw_data->>'payment_name', '')) LIKE '%каса%' OR
            LOWER(COALESCE(a.raw_data->>'paymethod_name', '')) LIKE '%брой%' OR
            LOWER(COALESCE(a.raw_data->>'paymethod_name', '')) LIKE '%cash%' OR
            LOWER(COALESCE(a.raw_data->>'paymethod_name', '')) LIKE '%каса%'
          )
          THEN o.amount::numeric * o.actual_price::numeric
          ELSE 0
        END
      ) as cash,
      SUM(
        CASE
          WHEN LOWER(o.article_name) LIKE '%бакшиш%' OR LOWER(o.article_name) LIKE '%tip%' OR LOWER(o.article_name) LIKE '%типс%'
            OR LOWER(o.article_name) LIKE '%брак%' OR LOWER(o.article_name) LIKE '%waste%' OR LOWER(o.article_name) LIKE '%brak%'
          THEN 0
          WHEN (
            LOWER(COALESCE(a.raw_data->>'payment_name', '')) LIKE '%карта%' OR
            LOWER(COALESCE(a.raw_data->>'payment_name', '')) LIKE '%card%' OR
            LOWER(COALESCE(a.raw_data->>'payment_name', '')) LIKE '%pos%' OR
            LOWER(COALESCE(a.raw_data->>'payment_name', '')) LIKE '%терминал%' OR
            LOWER(COALESCE(a.raw_data->>'paymethod_name', '')) LIKE '%карта%' OR
            LOWER(COALESCE(a.raw_data->>'paymethod_name', '')) LIKE '%card%' OR
            LOWER(COALESCE(a.raw_data->>'paymethod_name', '')) LIKE '%pos%' OR
            LOWER(COALESCE(a.raw_data->>'paymethod_name', '')) LIKE '%терминал%'
          )
          THEN o.amount::numeric * o.actual_price::numeric
          ELSE 0
        END
      ) as card,
      SUM(
        CASE
          WHEN LOWER(o.article_name) LIKE '%бакшиш%' OR LOWER(o.article_name) LIKE '%tip%' OR LOWER(o.article_name) LIKE '%типс%'
            OR LOWER(o.article_name) LIKE '%брак%' OR LOWER(o.article_name) LIKE '%waste%' OR LOWER(o.article_name) LIKE '%brak%'
          THEN 0
          WHEN (
            LOWER(COALESCE(a.raw_data->>'payment_name', '')) LIKE '%изход%' OR
            LOWER(COALESCE(a.raw_data->>'payment_short_name', '')) LIKE '%кд%' OR
            (a.raw_data->>'paymethod_id')::text = '3'
          )
          THEN o.amount::numeric * o.actual_price::numeric
          ELSE 0
        END
      ) as wallet,
      SUM(
        CASE
          WHEN LOWER(o.article_name) LIKE '%бакшиш%' OR LOWER(o.article_name) LIKE '%tip%' OR LOWER(o.article_name) LIKE '%типс%'
          THEN o.amount::numeric * o.actual_price::numeric
          ELSE 0
        END
      ) as tips,
      SUM(
        CASE
          WHEN LOWER(o.article_name) LIKE '%брак%' OR LOWER(o.article_name) LIKE '%waste%' OR LOWER(o.article_name) LIKE '%brak%'
          THEN o.amount::numeric * o.actual_price::numeric
          ELSE 0
        END
      ) as waste,
      -- Items sold excludes tips + waste (more meaningful operationally)
      SUM(
        CASE
          WHEN LOWER(o.article_name) LIKE '%бакшиш%' OR LOWER(o.article_name) LIKE '%tip%' OR LOWER(o.article_name) LIKE '%типс%'
            OR LOWER(o.article_name) LIKE '%брак%' OR LOWER(o.article_name) LIKE '%waste%' OR LOWER(o.article_name) LIKE '%brak%'
          THEN 0
          ELSE o.amount::numeric
        END
      ) as items_sold,
      COUNT(*) FILTER (
        WHERE COALESCE((o.raw_data->>'discount')::numeric, 0) != 0
        AND NOT (
          LOWER(o.article_name) LIKE '%бакшиш%' OR LOWER(o.article_name) LIKE '%tip%' OR LOWER(o.article_name) LIKE '%типс%'
          OR LOWER(o.article_name) LIKE '%брак%' OR LOWER(o.article_name) LIKE '%waste%' OR LOWER(o.article_name) LIKE '%brak%'
        )
      ) as discounted_orders,
      SUM(
        CASE
          WHEN COALESCE((o.raw_data->>'discount')::numeric, 0) != 0
            AND NOT (
              LOWER(o.article_name) LIKE '%бакшиш%' OR LOWER(o.article_name) LIKE '%tip%' OR LOWER(o.article_name) LIKE '%типс%'
              OR LOWER(o.article_name) LIKE '%брак%' OR LOWER(o.article_name) LIKE '%waste%' OR LOWER(o.article_name) LIKE '%brak%'
            )
          THEN ABS(
            o.amount::numeric * o.actual_price::numeric *
            COALESCE((o.raw_data->>'discount')::numeric, 0) / 100
          )
          ELSE 0
        END
      ) as total_discounts,
      COUNT(*) FILTER (WHERE o.amount::numeric < 0) as void_count,
      COUNT(*) as total_orders
    FROM barsy_orders o
    LEFT JOIN barsy_accounts a
      ON (o.raw_data->>'account_id') = a.barsy_account_id::text
      AND a.location_id = o.location_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY o.user_name
    ORDER BY revenue DESC
  `;

  // Replace parameters
  let finalQuery = query;
  params.forEach((param, index) => {
    const placeholder = `$${index + 1}`;
    const value = typeof param === "string" ? `'${param}'` : param;
    finalQuery = finalQuery.replace(placeholder, value);
  });

  const { data, error } = await supabase.rpc("execute_sql", {
    query: finalQuery,
  });

  if (error) {
    console.error("Staff performance stats error:", error);
    return { error: error.message };
  }

  const staffStats: StaffPerformanceData[] = (data || []).map((row: any) => {
    const transactions = Number(row.transactions) || 0;
    const revenue = Number(row.revenue) || 0;
    const totalOrders = Number(row.total_orders) || 0;
    const voidCount = Number(row.void_count) || 0;    return {
      user_name: row.user_name || "Unknown",
      transactions,
      revenue,
      cash: Number(row.cash) || 0,
      card: Number(row.card) || 0,
      wallet: Number(row.wallet) || 0,
      tips: Number(row.tips) || 0,
      waste: Number(row.waste) || 0,
      avg_transaction: transactions > 0 ? revenue / transactions : 0,
      items_sold: Number(row.items_sold) || 0,
      discounted_orders: Number(row.discounted_orders) || 0,
      total_discounts: Number(row.total_discounts) || 0,
      void_count: voidCount,
      void_rate: totalOrders > 0 ? (voidCount / totalOrders) * 100 : 0,
    };
  });  return { data: staffStats };
};
