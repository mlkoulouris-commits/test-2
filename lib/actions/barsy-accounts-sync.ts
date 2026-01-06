"use server";

import { BarsyApiClient } from "@/lib/services/barsy-api";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

/**
 * Sync Barsy accounts (bills/tabs) from API to database
 */
export const syncBarsyAccounts = async (dateFrom: string, dateTo: string) => {
  console.log(`Syncing accounts (bills) from ${dateFrom} to ${dateTo}...`);
  const supabase = await createClient();

  // Get all active Barsy locations
  const { data: locations, error: locError } = await supabase
    .from("barsy_locations")
    .select("*")
    .eq("is_active", true);

  if (locError || !locations || locations.length === 0) {
    return { error: locError?.message || "No active Barsy locations found" };
  }

  let totalSynced = 0;
  const errors: string[] = [];

  // Break date range into 7-day chunks to avoid Barsy API timeouts
  const startDate = new Date(dateFrom);
  const endDate = new Date(dateTo);
  const chunks: { start: string; end: string }[] = [];

  let currentStart = new Date(startDate);
  while (currentStart <= endDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 6); // 7 days total
    if (currentEnd > endDate) {
      currentEnd.setTime(endDate.getTime());
    }

    chunks.push({
      start: format(currentStart, "yyyy-MM-dd"),
      end: format(currentEnd, "yyyy-MM-dd"),
    });

    currentStart.setDate(currentStart.getDate() + 7);
  }

  console.log(`📅 Split into ${chunks.length} chunks of ~7 days each`);

  // Sync each location
  for (const location of locations) {
    try {
      console.log(`Fetching accounts for ${location.name}...`);
      const barsyClient = new BarsyApiClient({
        baseUrl: location.barsy_url,
        username: location.username,
        password: location.password_encrypted, // Assuming stored as plain text for now
      });

      // Fetch accounts in chunks
      for (const chunk of chunks) {
        console.log(`  📦 Fetching chunk: ${chunk.start} to ${chunk.end}`);
        const response = await barsyClient.getAllAccounts(
          chunk.start,
          chunk.end
        );

        if (!response.success || !response.data) {
          const errorMsg = (response as { error?: string }).error || "Failed to fetch accounts";
          errors.push(
            `${location.name} (${chunk.start} to ${chunk.end}): ${errorMsg}`
          );
          console.error(`❌ ${location.name}: ${errorMsg}`);
          continue;
        }

        const accounts = (response.data as any).Accounts_getlist || [];

        console.log(`  ✅ Fetched ${accounts.length} accounts`);

        if (accounts.length === 0) {
          continue;
        }

        // Transform and insert accounts
        const accountRecords = accounts.map((acc: any) => {
          const openDate = acc.open_date || acc.date_open || acc.create_date;
          const closeDate = acc.close_date || acc.date_close || acc.ref_date;
          // For reporting, use close_date if available, otherwise use open_date (for still-open accounts)
          const reportDate = closeDate || openDate;

          return {
            location_id: location.id,
            barsy_account_id: acc.account_id || acc.id,
            account_number:
              acc.account_number?.toString() || acc.account_id?.toString(),
            open_date: openDate,
            close_date: closeDate,
            status: acc.status?.toString() || null,
            total_amount: acc.total_sum || acc.total || 0,
            paid_amount: acc.total_paid || acc.paid || 0,
            client_id: acc.client_id || null,
            place_id: acc.place_id || acc.table_id || null,
            user_id: acc.user_id || null,
            // Payment method data for transaction analysis
            paymethod_id: acc.paymethod_id ? parseInt(acc.paymethod_id) : null,
            payment_method_name: acc.payment_name || acc.paymethod_name || null,
            discount_percent: acc.discount ? parseFloat(acc.discount) : null,
            raw_data: acc,
            // Set created_at to the report date (close_date for closed accounts, open_date for open accounts)
            created_at: reportDate || new Date().toISOString(),
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });

        // Upsert accounts (update if exists, insert if new)
        const { error: insertError } = await supabase
          .from("barsy_accounts")
          .upsert(accountRecords, {
            onConflict: "location_id,barsy_account_id",
            ignoreDuplicates: false,
          });

        if (insertError) {
          errors.push(`${location.name}: ${insertError.message}`);
          console.error(
            `❌ Failed to insert accounts for ${location.name}:`,
            insertError.message
          );
        } else {
          totalSynced += accountRecords.length;
        }
      }

      console.log(
        `✅ Total synced for ${location.name}: ${totalSynced} accounts`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${location.name}: ${errorMsg}`);
      console.error(`❌ Error syncing ${location.name}:`, errorMsg);
    }
  }

  console.log(`✅ Total accounts synced: ${totalSynced}`);

  if (errors.length > 0) {
    return {
      success: totalSynced > 0,
      synced: totalSynced,
      errors: errors.join("; "),
    };
  }

  return {
    success: true,
    synced: totalSynced,
  };
};

// Fiscal cutoff time is 6:45 AM
const FISCAL_CUTOFF_HOUR = 6;
const FISCAL_CUTOFF_MINUTE = 45;

/**
 * Get Barsy transactions grouped by account (bill)
 */
export const getBarsyAccountTransactions = async (
  dateFrom?: string,
  dateTo?: string,
  locationId?: string,
  page: number = 1,
  pageSize: number = 50,
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
      conditions.push(`a.open_date >= $${paramIndex}`);
      params.push(
        `${dateFrom} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      conditions.push(`a.open_date >= $${paramIndex}`);
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
      conditions.push(`a.open_date < $${paramIndex}`);
      params.push(
        `${extendedEndDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
      );
    } else {
      conditions.push(`a.open_date <= $${paramIndex}`);
      params.push(dateTo);
    }
    paramIndex++;
  }
  if (locationId && locationId !== "all") {
    conditions.push(`a.location_id = $${paramIndex}`);
    params.push(locationId);
    paramIndex++;
  }
  if (userId) {
    conditions.push(`a.user_id = $${paramIndex}`);
    params.push(userId);
    paramIndex++;
  }

  // Build discount filter for orders
  let orderDiscountFilter = "";
  if (discountFilter === "with_discount") {
    orderDiscountFilter = `AND (o.raw_data->>'discount')::numeric != 0`;
  } else if (discountFilter === "no_discount") {
    orderDiscountFilter = `AND (COALESCE((o.raw_data->>'discount')::numeric, 0) = 0)`;
  }

  // Build payment method filter
  let paymentFilter = "";
  if (paymentMethodFilter && paymentMethodFilter !== "all") {
    if (paymentMethodFilter === "no_payment") {
      paymentFilter = `AND (a.raw_data->>'payment_name' IS NULL AND a.raw_data->>'paymethod_name' IS NULL)`;
    } else if (paymentMethodFilter === "cash") {
      paymentFilter = `AND (
        LOWER(a.raw_data->>'payment_name') LIKE '%брой%' OR
        LOWER(a.raw_data->>'payment_name') LIKE '%cash%' OR
        LOWER(a.raw_data->>'payment_name') LIKE '%каса%' OR
        LOWER(a.raw_data->>'paymethod_name') LIKE '%брой%' OR
        LOWER(a.raw_data->>'paymethod_name') LIKE '%cash%' OR
        LOWER(a.raw_data->>'paymethod_name') LIKE '%каса%'
      )`;
    } else if (paymentMethodFilter === "card") {
      paymentFilter = `AND (
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
      paymentFilter = `AND (
        LOWER(a.raw_data->>'payment_name') LIKE '%изход%' OR
        LOWER(a.raw_data->>'payment_short_name') LIKE '%кд%' OR
        (a.raw_data->>'paymethod_id')::text = '3'
      )`;
    }
  }

  const offset = (page - 1) * pageSize;

  // Use single SQL query with JOIN to get accounts with orders
  // Also detect void_type for each order (transfer vs pure_void)
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
    account_orders AS (
      SELECT
        a.barsy_account_id,
        a.account_number,
        a.open_date,
        a.close_date,
        a.status,
        a.total_amount,
        a.paid_amount,
        l.name as location_name,
        a.raw_data->>'client_name' as client_name,
        COALESCE(a.raw_data->>'payment_name', a.raw_data->>'paymethod_name') as payment_method,
        COALESCE(
          json_agg(
            json_build_object(
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
            )
            ORDER BY o.order_date
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'::json
        ) as line_items
      FROM barsy_accounts a
      LEFT JOIN barsy_locations l ON a.location_id = l.id
      LEFT JOIN barsy_orders o ON
        o.location_id = a.location_id AND
        o.order_date >= a.open_date AND
        o.order_date <= COALESCE(a.close_date, a.open_date)
        ${orderDiscountFilter}
      WHERE ${conditions.join(" AND ")} ${paymentFilter}
      GROUP BY a.barsy_account_id, a.account_number, a.open_date, a.close_date, a.status,
               a.total_amount, a.paid_amount, l.name, a.raw_data->>'client_name', a.raw_data
    )
    SELECT
      *,
      COUNT(*) OVER() as total_count
    FROM account_orders
    ORDER BY close_date DESC NULLS LAST, open_date DESC
    LIMIT ${pageSize} OFFSET ${offset}
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
    console.error("Account transactions error:", error);
    return { error: error.message };
  }

  const accounts = data || [];
  const totalCount = accounts.length > 0 ? accounts[0].total_count : 0;

  // Process results
  const processedAccounts = accounts.map((acc: any) => {
    const lineItems = Array.isArray(acc.line_items) ? acc.line_items : [];
    const totalDiscount = lineItems.reduce((sum: number, item: any) => {
      const discountAmount =
        item.discount > 0 ? (item.total * item.discount) / 100 : 0;
      return sum + discountAmount;
    }, 0);

    return {
      account_id: acc.barsy_account_id,
      account_number: acc.account_number,
      open_date: acc.open_date,
      close_date: acc.close_date,
      location_name: acc.location_name || "Unknown",
      client_name: acc.client_name || null,
      total_amount: Number(acc.total_amount) || 0,
      paid_amount: Number(acc.paid_amount) || 0,
      status: acc.status,
      total_discount: totalDiscount,
      payment_methods: acc.payment_method ? [acc.payment_method] : [],
      line_items: lineItems,
    };
  });

  return {
    data: processedAccounts,
    count: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
};
