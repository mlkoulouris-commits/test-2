"use server";

import { createClient } from "@/lib/supabase/server";

export type VoidType = "transfer" | "pure_void" | null;

// Fiscal cutoff time is 6:45 AM
const FISCAL_CUTOFF_HOUR = 6;
const FISCAL_CUTOFF_MINUTE = 45;

export const getBarsyOrders = async (
  dateFrom?: string,
  dateTo?: string,
  locationId?: string,
  page: number = 1,
  pageSize: number = 50,
  discountFilter?: "all" | "with_discount" | "no_discount",
  userId?: string,
  paymentMethodFilter?: string,
  voidFilter?:
    | "all"
    | "positive_only"
    | "voided_only"
    | "transfers_only"
    | "pure_voids_only",
  useFiscalDate: boolean = false
) => {
  const supabase = await createClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("barsy_orders")
    .select(
      `
      *,
      barsy_locations (id, name)
    `,
      { count: "exact" }
    )
    .order("order_date", { ascending: false })
    .range(from, to);

  if (dateFrom) {
    if (useFiscalDate) {
      // Fiscal date: start from 6:45 AM on the start date
      query = query.gte(
        "order_date",
        `${dateFrom} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      query = query.gte("order_date", dateFrom);
    }
  }
  if (dateTo) {
    if (useFiscalDate) {
      // Fiscal date: extend to 6:44:59 AM on the day after end date
      const endDateObj = new Date(dateTo);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const extendedEndDate = endDateObj.toISOString().split("T")[0];
      query = query.lt(
        "order_date",
        `${extendedEndDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      query = query.lte("order_date", dateTo);
    }
  }
  if (locationId) {
    query = query.eq("location_id", locationId);
  }
  if (userId) {
    query = query.eq("user_name", userId);
  }

  // Apply discount filter
  if (discountFilter === "with_discount") {
    query = query.not("raw_data->discount", "eq", "0");
  } else if (discountFilter === "no_discount") {
    query = query.or("raw_data->discount.eq.0,raw_data->discount.is.null");
  }

  // Apply basic void filter (positive vs negative amounts)
  if (voidFilter === "positive_only") {
    query = query.gt("amount", 0);
  } else if (
    voidFilter === "voided_only" ||
    voidFilter === "transfers_only" ||
    voidFilter === "pure_voids_only"
  ) {
    query = query.lt("amount", 0);
  }

  const { data, error, count } = await query;

  if (error) {
    return { error: error.message };
  }

  // Fetch payment methods from accounts for orders that have account_id
  if (data && data.length > 0) {
    const accountIds = data
      .map((order) => order.raw_data?.account_id)
      .filter((id): id is number => id != null && !isNaN(Number(id)))
      .filter((id, index, self) => self.indexOf(id) === index);

    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from("barsy_accounts")
        .select("barsy_account_id, raw_data")
        .in("barsy_account_id", accountIds);

      // Create a map of account_id (as string) -> payment method
      const paymentMethodsMap = new Map<string, string>();
      if (accounts) {
        for (const account of accounts) {
          const accountId = account.barsy_account_id;
          const paymentMethod =
            account.raw_data?.payment_name || account.raw_data?.paymethod_name;
          if (accountId && paymentMethod) {
            // Store with string key to match the JSON account_id type
            paymentMethodsMap.set(String(accountId), paymentMethod);
          }
        }
      }

      // Attach payment methods to orders
      for (const order of data) {
        const accountId = order.raw_data?.account_id;
        if (accountId) {
          // account_id from raw_data is already a string
          const paymentMethod = paymentMethodsMap.get(String(accountId));
          order.payment_methods = paymentMethod ? [paymentMethod] : [];
        }
      }
    }

    // Detect void types for negative amount orders
    const voidedOrders = data.filter((order) => Number(order.amount) < 0);
    if (voidedOrders.length > 0) {
      // Get all voided order details for transfer detection
      const voidedOrderIds = voidedOrders.map((o) => o.barsy_order_id);

      // Query to find matching transfers (same article, same timestamp, different account)
      const transferQuery = `
        SELECT DISTINCT vo.barsy_order_id as void_order_id
        FROM barsy_orders vo
        JOIN barsy_orders po ON
          po.barsy_article_id = vo.barsy_article_id
          AND po.amount::numeric = ABS(vo.amount::numeric)
          AND po.raw_data->>'account_id' != vo.raw_data->>'account_id'
          AND po.order_date = vo.order_date
        WHERE vo.barsy_order_id IN (${voidedOrderIds.join(",")})
          AND vo.amount::numeric < 0
      `;

      const { data: transferMatches } = await supabase.rpc("execute_sql", {
        query: transferQuery,
      });

      // Create a set of order IDs that are transfers
      const transferOrderIds = new Set(
        (transferMatches || []).map((row: any) => row.void_order_id)
      );

      // Attach void_type to each order
      for (const order of data) {
        if (Number(order.amount) < 0) {
          order.void_type = transferOrderIds.has(order.barsy_order_id)
            ? "transfer"
            : "pure_void";
        } else {
          order.void_type = null;
        }
      }
    } else {
      // No voided orders, set all to null
      for (const order of data) {
        order.void_type = null;
      }
    }
  }

  // Filter by payment method after attaching payment methods
  let filteredData = data || [];
  if (paymentMethodFilter && paymentMethodFilter !== "all") {
    filteredData = filteredData.filter((order) => {
      if (paymentMethodFilter === "no_payment") {
        return !order.payment_methods || order.payment_methods.length === 0;
      } else if (paymentMethodFilter === "cash") {
        return order.payment_methods?.some(
          (pm: string) =>
            pm?.toLowerCase().includes("брой") ||
            pm?.toLowerCase().includes("cash") ||
            pm?.toLowerCase().includes("каса")
        );
      } else if (paymentMethodFilter === "card") {
        return order.payment_methods?.some(
          (pm: string) =>
            pm?.toLowerCase().includes("карта") ||
            pm?.toLowerCase().includes("card") ||
            pm?.toLowerCase().includes("pos") ||
            pm?.toLowerCase().includes("терминал")
        );
      } else if (paymentMethodFilter === "wallet") {
        return order.payment_methods?.some(
          (pm: string) =>
            pm?.toLowerCase().includes("изход") ||
            pm?.toLowerCase().includes("кд")
        );
      }
      return true;
    });
  }

  // Filter by void type (transfers vs pure voids)
  // Note: This is client-side filtering, so pagination might show fewer items per page
  if (voidFilter === "transfers_only") {
    filteredData = filteredData.filter(
      (order) => order.void_type === "transfer"
    );
  } else if (voidFilter === "pure_voids_only") {
    filteredData = filteredData.filter(
      (order) => order.void_type === "pure_void"
    );
  }

  // Use database count for pagination (this is the actual total matching records)
  // Note: Client-side filtering (payment method, transfer/void type) may result in
  // fewer items per page, but pagination will work correctly
  const totalCount = count || 0;

  return {
    data: filteredData,
    count: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
};

export const getBarsyOrderStats = async (
  dateFrom?: string,
  dateTo?: string,
  locationId?: string,
  discountFilter?: "all" | "with_discount" | "no_discount",
  userId?: string,
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
      conditions.push(`order_date >= $${paramIndex}`);
      params.push(
        `${dateFrom} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      conditions.push(`order_date >= $${paramIndex}`);
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
      conditions.push(`order_date < $${paramIndex}`);
      params.push(
        `${extendedEndDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      conditions.push(`order_date <= $${paramIndex}`);
      params.push(dateTo);
    }
    paramIndex++;
  }
  if (locationId) {
    conditions.push(`location_id = $${paramIndex}`);
    params.push(locationId);
    paramIndex++;
  }
  if (userId) {
    conditions.push(`user_name = $${paramIndex}`);
    params.push(userId);
    paramIndex++;
  }
  if (discountFilter === "with_discount") {
    conditions.push(`(raw_data->>'discount')::numeric != 0`);
  } else if (discountFilter === "no_discount") {
    conditions.push(`(COALESCE((raw_data->>'discount')::numeric, 0) = 0)`);
  }

  // Use SQL aggregation for stats
  // Tips: article names containing 'бакшиш', 'tip', 'типс'
  // Waste: article names containing 'брак', 'waste', 'brak'
  const query = `
    SELECT
      COUNT(*) as total_orders,
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
      COUNT(DISTINCT COALESCE((raw_data->>'account_id'), 'single-' || id::text)) as unique_transactions,
      COUNT(*) FILTER (WHERE COALESCE((raw_data->>'discount')::numeric, 0) != 0) as orders_with_discount,
      SUM(
        CASE
          WHEN COALESCE((raw_data->>'discount')::numeric, 0) != 0
          THEN ABS(amount::numeric * actual_price::numeric * COALESCE((raw_data->>'discount')::numeric, 0) / 100)
          ELSE 0
        END
      ) as total_discount
    FROM barsy_orders
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
    console.error("Order stats error:", error);
    return { error: error.message };
  }

  const stats =
    data && data.length > 0
      ? {
          totalOrders: Number(data[0].total_orders) || 0,
          totalRevenue: Number(data[0].total_revenue) || 0,
          totalTips: Number(data[0].total_tips) || 0,
          totalWaste: Number(data[0].total_waste) || 0,
          uniqueTransactions: Number(data[0].unique_transactions) || 0,
          ordersWithDiscount: Number(data[0].orders_with_discount) || 0,
          totalDiscount: Number(data[0].total_discount) || 0,
        }
      : {
          totalOrders: 0,
          totalRevenue: 0,
          totalTips: 0,
          totalWaste: 0,
          uniqueTransactions: 0,
          ordersWithDiscount: 0,
          totalDiscount: 0,
        };

  return { data: stats };
};

export const getBarsyLocations = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("barsy_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return { error: error.message };
  }

  return { data: data || [] };
};

export const getBarsyStaff = async () => {
  const supabase = await createClient();

  // Get unique staff from barsy_orders using raw SQL for efficiency
  const { data, error } = await supabase.rpc("get_unique_barsy_staff");

  if (error) {
    // Fallback to previous method if function doesn't exist yet
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("barsy_orders")
      .select("user_name, barsy_user_id")
      .not("user_name", "is", null)
      .limit(1000); // Add limit to prevent massive data fetch

    if (fallbackError) {
      return { error: fallbackError.message };
    }

    // Get unique staff members
    const uniqueStaff = Array.from(
      new Map(
        (fallbackData || [])
          .filter((item) => item.user_name)
          .map((item) => [item.user_name, item])
      ).values()
    );

    return { data: uniqueStaff };
  }

  return { data: data || [] };
};
