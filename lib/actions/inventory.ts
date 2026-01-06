"use server";

import { createClient } from "@/lib/supabase/server";

export interface InventoryItem {
  barsy_article_id: number;
  article_name: string;
  depot_id: number | null;
  depot_name: string | null;
  quantity: number;
  unit: string | null;
  cost_price: number | null;
  total_value: number;
}

export interface InventoryComparison extends InventoryItem {
  barsy_quantity: number | null;
  barsy_cost_price: number | null;
  barsy_total_value: number | null;
  quantity_variance: number | null;
  value_variance: number | null;
}

export interface InventorySummary {
  total_items: number;
  calculated_total_value: number;
  barsy_total_value: number | null;
  total_variance: number | null;
  items_with_discrepancies: number;
}

/**
 * Create an inventory snapshot from current barsy_store_amounts
 */
export async function createInventorySnapshot(
  locationId: string,
  snapshotDate: string
): Promise<{ success: boolean; error?: string; recordsCreated?: number }> {
  try {
    const supabase = await createClient();

    // Get current inventory from barsy_store_amounts
    const { data: currentInventory, error: fetchError } = await supabase
      .from("barsy_store_amounts")
      .select("*")
      .eq("location_id", locationId);

    if (fetchError) {
      return {
        success: false,
        error: `Failed to fetch current inventory: ${fetchError.message}`,
      };
    }

    if (!currentInventory || currentInventory.length === 0) {
      return {
        success: false,
        error: "No current inventory found. Sync inventory first.",
      };
    }

    // Transform to snapshot format
    const snapshots = currentInventory.map((item) => ({
      location_id: locationId,
      snapshot_date: snapshotDate,
      barsy_article_id: item.barsy_article_id,
      article_name: item.article_name,
      depot_id: item.depot_id,
      depot_name: item.depot_name,
      quantity: item.quantity,
      unit: item.unit,
      cost_price: item.cost_price,
      total_value: item.total_value,
    }));

    // Upsert snapshots
    const { error: insertError } = await supabase
      .from("barsy_inventory_snapshots")
      .upsert(snapshots, {
        onConflict: "location_id,snapshot_date,barsy_article_id,depot_id",
        ignoreDuplicates: false,
      });

    if (insertError) {
      return {
        success: false,
        error: `Failed to create snapshot: ${insertError.message}`,
      };
    }

    return {
      success: true,
      recordsCreated: snapshots.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Calculate inventory as of a specific date
 */
export async function calculateInventoryAsOfDate(
  locationId: string,
  asOfDate: string,
  depotId?: number
): Promise<{ success: boolean; data?: InventoryItem[]; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Get baseline snapshot (most recent snapshot <= asOfDate)
    let baselineQuery = supabase
      .from("barsy_inventory_snapshots")
      .select("*")
      .eq("location_id", locationId)
      .lte("snapshot_date", asOfDate)
      .order("snapshot_date", { ascending: false })
      .limit(1);

    const { data: snapshot } = await baselineQuery.maybeSingle();

    // If no snapshot, use current barsy_store_amounts as baseline
    let baseline: any[] = [];
    if (snapshot) {
      // Get all items from this snapshot
      const { data: snapshotItems } = await supabase
        .from("barsy_inventory_snapshots")
        .select("*")
        .eq("location_id", locationId)
        .eq("snapshot_date", snapshot.snapshot_date);
      baseline = snapshotItems || [];
    } else {
      // Use current inventory as baseline
      const { data: currentInventory } = await supabase
        .from("barsy_store_amounts")
        .select("*")
        .eq("location_id", locationId);
      baseline = currentInventory || [];
    }

    // 2. Get all increases (store loads) up to asOfDate
    // First get store loads that match criteria
    let storeLoadsQuery = supabase
      .from("barsy_store_loads")
      .select("id, depot_id")
      .eq("barsy_location_id", locationId)
      .eq("operation_type", 1) // Load only, not returns
      .lte("doc_date", asOfDate);

    if (depotId) {
      storeLoadsQuery = storeLoadsQuery.eq("depot_id", depotId);
    }

    const { data: storeLoads } = await storeLoadsQuery;
    const storeLoadIds = storeLoads?.map((sl: any) => sl.id) || [];

    // Then get items for those loads
    let increases: any[] = [];
    if (storeLoadIds.length > 0) {
      const { data: loadItems } = await supabase
        .from("barsy_store_load_items")
        .select("barsy_article_id, article_name, quantity, unit_price")
        .in("store_load_id", storeLoadIds);

      // Create a map of store_load_id to depot_id
      const loadDepotMap = new Map(
        storeLoads?.map((sl: any) => [sl.id, sl.depot_id]) || []
      );

      // Map items with depot_id from parent load
      increases = (loadItems || []).map((item: any) => ({
        barsy_article_id: item.barsy_article_id,
        article_name: item.article_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        depot_id: loadDepotMap.get(item.store_load_id) || null,
      }));
    }

    // 3. Get all decreases (store outs) up to asOfDate
    let storeOutsQuery = supabase
      .from("barsy_store_outs")
      .select("barsy_article_id, article_name, quantity, unit, depot_id")
      .eq("location_id", locationId)
      .lte("store_out_date", asOfDate);

    if (depotId) {
      storeOutsQuery = storeOutsQuery.eq("depot_id", depotId);
    }

    const { data: storeOuts } = await storeOutsQuery;

    // 4. Get all sales depletion up to asOfDate
    let depletionQuery = supabase
      .from("barsy_inventory_depletion_log")
      .select("barsy_ingredient_article_id, quantity_depleted, unit")
      .eq("location_id", locationId)
      .lte("order_date", asOfDate);

    const { data: depletionLog } = await depletionQuery;

    // 5. Build result map
    const resultMap = new Map<string, InventoryItem>();

    // Initialize with baseline
    for (const item of baseline) {
      const key = `${item.barsy_article_id}-${item.depot_id || "null"}`;
      if (!depotId || item.depot_id === depotId) {
        resultMap.set(key, {
          barsy_article_id: item.barsy_article_id,
          article_name: item.article_name || "Unknown",
          depot_id: item.depot_id,
          depot_name: item.depot_name,
          quantity: Number(item.quantity) || 0,
          unit: item.unit,
          cost_price: item.cost_price ? Number(item.cost_price) : null,
          total_value: 0, // Will calculate below
        });
      }
    }

    // Add increases from store loads
    if (increases && increases.length > 0) {
      for (const item of increases) {
        const key = `${item.barsy_article_id}-${item.depot_id || "null"}`;
        const existing = resultMap.get(key);
        if (existing) {
          existing.quantity += Number(item.quantity) || 0;
        } else {
          // New item not in baseline
          resultMap.set(key, {
            barsy_article_id: item.barsy_article_id,
            article_name: item.article_name || "Unknown",
            depot_id: item.depot_id,
            depot_name: null,
            quantity: Number(item.quantity) || 0,
            unit: null,
            cost_price: null, // Will need to calculate or get from snapshot
            total_value: 0,
          });
        }
      }
    }

    // Subtract store outs
    if (storeOuts) {
      for (const item of storeOuts) {
        const key = `${item.barsy_article_id}-${item.depot_id || "null"}`;
        const existing = resultMap.get(key);
        if (existing) {
          existing.quantity = Math.max(
            0,
            existing.quantity - (Number(item.quantity) || 0)
          );
        }
      }
    }

    // Subtract sales depletion
    if (depletionLog) {
      for (const item of depletionLog) {
        const key = `${item.barsy_ingredient_article_id}-null`; // Depletion log doesn't have depot_id
        const existing = resultMap.get(key);
        if (existing) {
          existing.quantity = Math.max(
            0,
            existing.quantity - (Number(item.quantity_depleted) || 0)
          );
        }
      }
    }

    // 6. Calculate total_value and get cost_price from baseline if missing
    const result: InventoryItem[] = [];
    for (const item of resultMap.values()) {
      // Use cost_price from baseline if available
      if (!item.cost_price) {
        const baselineItem = baseline.find(
          (b) =>
            b.barsy_article_id === item.barsy_article_id &&
            b.depot_id === item.depot_id
        );
        if (baselineItem?.cost_price) {
          item.cost_price = Number(baselineItem.cost_price);
        }
      }

      // Calculate total_value
      item.total_value = item.quantity * (item.cost_price || 0);
      result.push(item);
    }

    return {
      success: true,
      data: result.sort((a, b) => a.article_name.localeCompare(b.article_name)),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch Barsy snapshot for a specific date
 *
 * Note: The Barsy Store_amounts API endpoint is a Report-type endpoint that returns
 * a page/UI structure, not raw data. Therefore, we fetch from the synced
 * barsy_store_amounts table in the database instead.
 *
 * For this to work, you need to run syncBarsyStoreAmounts() first to populate the table.
 */
export async function fetchBarsySnapshot(
  locationId: string,
  date: string,
  depotId?: number
): Promise<{ success: boolean; data?: InventoryItem[]; error?: string }> {
  try {
    const supabase = await createClient();

    // Check if date is today
    const today = new Date().toISOString().split("T")[0];
    const isToday = date === today;

    // For historical dates, we don't have Barsy snapshots
    if (!isToday) {
      return {
        success: false,
        error: `Barsy snapshots are only available for today. For historical dates, use the calculated inventory based on stored snapshots and movements.`,
      };
    }

    console.log(
      `Fetching Barsy inventory from database for location ${locationId}`
    );

    // Fetch from barsy_store_amounts table (synced data)
    let query = supabase
      .from("barsy_store_amounts")
      .select("*")
      .eq("location_id", locationId);

    if (depotId) {
      query = query.eq("depot_id", depotId);
    }

    const { data: storeAmounts, error: fetchError } = await query;

    if (fetchError) {
      return {
        success: false,
        error: `Failed to fetch store amounts: ${fetchError.message}`,
      };
    }

    if (!storeAmounts || storeAmounts.length === 0) {
      return {
        success: false,
        error:
          "No inventory data found in database. Note: The Barsy Store_amounts API returns a UI/page structure instead of raw data, so direct API sync is not currently supported. Please contact Barsy support for the correct API endpoint to fetch inventory data, or use the calculated inventory feature which uses store loads, sales, and write-offs to compute inventory levels.",
      };
    }

    console.log(`Found ${storeAmounts.length} inventory items in database`);

    // Transform to InventoryItem format
    const items: InventoryItem[] = storeAmounts.map((amount: any) => ({
      barsy_article_id: amount.barsy_article_id || 0,
      article_name: amount.article_name || "Unknown",
      depot_id: amount.depot_id || null,
      depot_name: amount.depot_name || null,
      quantity: parseFloat(amount.quantity) || 0,
      unit: amount.unit || null,
      cost_price: amount.cost_price ? parseFloat(amount.cost_price) : null,
      total_value: amount.total_value
        ? parseFloat(amount.total_value)
        : (parseFloat(amount.quantity) || 0) *
          (amount.cost_price ? parseFloat(amount.cost_price) : 0),
    }));

    console.log(
      `Successfully loaded ${items.length} inventory items from database`
    );

    return {
      success: true,
      data: items,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Compare calculated inventory with Barsy snapshot
 */
export async function compareInventory(
  calculated: InventoryItem[],
  barsySnapshot: InventoryItem[]
): Promise<InventoryComparison[]> {
  const comparisonMap = new Map<string, InventoryComparison>();

  // Add calculated items
  for (const item of calculated) {
    const key = `${item.barsy_article_id}-${item.depot_id || "null"}`;
    comparisonMap.set(key, {
      ...item,
      barsy_quantity: null,
      barsy_cost_price: null,
      barsy_total_value: null,
      quantity_variance: null,
      value_variance: null,
    });
  }

  // Add Barsy items and calculate variances
  for (const item of barsySnapshot) {
    const key = `${item.barsy_article_id}-${item.depot_id || "null"}`;
    const existing = comparisonMap.get(key);

    if (existing) {
      existing.barsy_quantity = item.quantity;
      existing.barsy_cost_price = item.cost_price;
      existing.barsy_total_value = item.total_value;
      existing.quantity_variance = existing.quantity - item.quantity;
      existing.value_variance = existing.total_value - item.total_value;
    } else {
      // Item exists in Barsy but not in calculated
      comparisonMap.set(key, {
        ...item,
        quantity: 0,
        total_value: 0,
        barsy_quantity: item.quantity,
        barsy_cost_price: item.cost_price,
        barsy_total_value: item.total_value,
        quantity_variance: -item.quantity,
        value_variance: -item.total_value,
      });
    }
  }

  return Array.from(comparisonMap.values()).sort((a, b) =>
    a.article_name.localeCompare(b.article_name)
  );
}

/**
 * Get inventory summary statistics
 */
export async function getInventorySummary(
  calculated: InventoryItem[],
  barsySnapshot?: InventoryItem[]
): Promise<InventorySummary> {
  const calculatedTotalValue = calculated.reduce(
    (sum, item) => sum + item.total_value,
    0
  );

  const barsyTotalValue = barsySnapshot
    ? barsySnapshot.reduce((sum, item) => sum + item.total_value, 0)
    : null;

  let itemsWithDiscrepancies = 0;
  if (barsySnapshot) {
    const comparison = await compareInventory(calculated, barsySnapshot);
    itemsWithDiscrepancies = comparison.filter(
      (item) =>
        item.quantity_variance !== 0 ||
        Math.abs(item.value_variance || 0) > 0.01
    ).length;
  }

  return {
    total_items: calculated.length,
    calculated_total_value: calculatedTotalValue,
    barsy_total_value: barsyTotalValue,
    total_variance:
      barsyTotalValue !== null ? calculatedTotalValue - barsyTotalValue : null,
    items_with_discrepancies: itemsWithDiscrepancies,
  };
}


