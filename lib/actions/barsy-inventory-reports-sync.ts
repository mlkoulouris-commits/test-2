"use server";

import { BarsyApiClient } from "@/lib/services/barsy-api";
import { createClient } from "@/lib/supabase/server";

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

/**
 * Sync inventory snapshot from Barsy Reports API
 * Uses Reports_store_amounts_by_date to get point-in-time inventory with cost values
 */
export async function syncBarsyInventorySnapshot(
  locationId: string,
  snapshotDate: string
): Promise<SyncResult> {
  try {
    const supabase = await createClient();

    const { data: location, error: locationError } = await supabase
      .from("barsy_locations")
      .select("*")
      .eq("id", locationId)
      .single();

    if (locationError || !location) {
      return {
        success: false,
        error: `Failed to fetch location: ${
          locationError?.message || "Not found"
        }`,
      };
    }

    console.log(
      `📦 Taking inventory snapshot for ${location.name} at ${snapshotDate}`
    );

    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Try to fetch inventory amounts by date using the Reports API
    const response = await barsyClient.getStoreAmountsByDate(snapshotDate);

    if (!response.success || !response.data) {
      // Fallback to current store amounts
      console.log("⚠️ Reports API failed, trying current store amounts...");
      const fallbackResponse = await barsyClient.getStoreAmounts();

      if (!fallbackResponse.success || !fallbackResponse.data) {
        return {
          success: false,
          error: response.error || "Failed to fetch inventory data",
        };
      }

      // Use fallback data
      return processInventoryData(
        supabase,
        locationId,
        snapshotDate,
        (fallbackResponse.data as any).Store_amounts || []
      );
    }

    const inventoryData =
      (response.data as any).Reports_store_amounts_by_date ||
      (response.data as any).values ||
      [];

    return processInventoryData(
      supabase,
      locationId,
      snapshotDate,
      inventoryData
    );
  } catch (error) {
    console.error("Inventory snapshot error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function processInventoryData(
  supabase: any,
  locationId: string,
  snapshotDate: string,
  inventoryData: any[]
): Promise<SyncResult> {
  if (!Array.isArray(inventoryData) || inventoryData.length === 0) {
    console.log("No inventory data found");
    return { success: true, recordsSynced: 0 };
  }

  console.log(`Processing ${inventoryData.length} inventory records`);

  // Delete existing snapshot for this date (replace with new data)
  await supabase
    .from("barsy_inventory_snapshots")
    .delete()
    .eq("location_id", locationId)
    .eq("snapshot_date", snapshotDate);

  const snapshotsToInsert = inventoryData.map((item: any) => ({
    location_id: locationId,
    snapshot_date: snapshotDate,
    barsy_article_id: parseInt(item.article_id) || 0,
    article_name: item.article_name || "Unknown",
    depot_id: item.depot_id ? parseInt(item.depot_id) : null,
    depot_name: item.depot_name || null,
    quantity: parseFloat(item.amount || item.quantity || 0),
    unit: item.amount_unit || null,
    cost_price: item.avg_delivery_price
      ? parseFloat(item.avg_delivery_price)
      : null,
    total_value:
      item.avg_delivery_price && item.amount
        ? parseFloat(item.avg_delivery_price) * parseFloat(item.amount)
        : null,
    created_at: new Date().toISOString(),
  }));

  // Insert in batches of 500
  const batchSize = 500;
  let insertedCount = 0;

  for (let i = 0; i < snapshotsToInsert.length; i += batchSize) {
    const batch = snapshotsToInsert.slice(i, i + batchSize);

    const { error: insertError } = await supabase
      .from("barsy_inventory_snapshots")
      .insert(batch);

    if (insertError) {
      console.error(`Batch insert error at ${i}:`, insertError);
      // Continue with other batches
    } else {
      insertedCount += batch.length;
    }
  }

  console.log(
    `✅ Saved ${insertedCount} inventory snapshot records for ${snapshotDate}`
  );

  return { success: true, recordsSynced: insertedCount };
}

/**
 * Sync current store amounts (inventory levels) with cost data
 * This updates barsy_store_amounts with current quantities and costs
 */
export async function syncBarsyCurrentInventory(
  locationId: string
): Promise<SyncResult> {
  try {
    const supabase = await createClient();

    const { data: location, error: locationError } = await supabase
      .from("barsy_locations")
      .select("*")
      .eq("id", locationId)
      .single();

    if (locationError || !location) {
      return {
        success: false,
        error: `Failed to fetch location: ${
          locationError?.message || "Not found"
        }`,
      };
    }

    console.log(`📦 Syncing current inventory for ${location.name}`);

    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Fetch all store amounts using pagination
    const response = await barsyClient.getAllStoreAmounts();

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || "Failed to fetch store amounts",
      };
    }

    const storeAmountsRaw = response.data;
    console.log(
      `Total fetched: ${storeAmountsRaw.length} store amount records`
    );

    if (!Array.isArray(storeAmountsRaw) || storeAmountsRaw.length === 0) {
      console.log("No store amounts data found");
      return { success: true, recordsSynced: 0 };
    }

    // Fetch article info to determine inventory_type
    const articleIds = storeAmountsRaw
      .map((a: any) => parseInt(a.article_id))
      .filter(Boolean);
    const { data: articles } = await supabase
      .from("barsy_articles")
      .select("barsy_article_id, is_for_sale")
      .eq("location_id", locationId)
      .in("barsy_article_id", articleIds);

    // Build lookup map for article info
    const articleMap = new Map<number, { is_for_sale: boolean }>();
    articles?.forEach((article) => {
      articleMap.set(article.barsy_article_id, {
        is_for_sale: article.is_for_sale ?? true,
      });
    });

    const storeAmountsToInsert = storeAmountsRaw.map((amount: any) => {
      // Handle different field names from Barsy API
      const quantity = parseFloat(amount.store_amount || amount.amount || 0);
      const costPrice = amount.avg_delivery_price
        ? parseFloat(amount.avg_delivery_price)
        : null;
      // Use delivery_price_sum if available, otherwise calculate
      const totalValue = amount.delivery_price_sum
        ? parseFloat(amount.delivery_price_sum)
        : costPrice && quantity
        ? costPrice * quantity
        : null;

      // Determine inventory type based on article data
      const articleId = parseInt(amount.article_id) || 0;
      const articleInfo = articleMap.get(articleId);
      // Default: if for_sale = true -> 'product', otherwise -> 'ingredient'
      const inventoryType =
        articleInfo?.is_for_sale === false ? "ingredient" : "product";

      return {
        location_id: locationId,
        barsy_article_id: articleId,
        article_name: amount.article_name || "Unknown",
        depot_id: amount.depot_id ? parseInt(amount.depot_id) : null,
        depot_name: amount.depot_name || null,
        quantity: quantity,
        unit: amount.amount_type_name_short || amount.amount_unit || null,
        cost_price: costPrice,
        total_value: totalValue,
        inventory_type: inventoryType,
        raw_data: amount,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // Deduplicate by location + article + depot
    const amountsMap = new Map();
    storeAmountsToInsert.forEach((amount: any) => {
      const key = `${amount.location_id}-${amount.barsy_article_id}-${amount.depot_id}`;
      amountsMap.set(key, amount);
    });
    const uniqueAmounts = Array.from(amountsMap.values());

    // Full refresh: delete old records for this location, then insert new ones
    const { error: deleteError } = await supabase
      .from("barsy_store_amounts")
      .delete()
      .eq("location_id", locationId);

    if (deleteError) {
      console.error("Store amounts delete error:", deleteError);
      return {
        success: false,
        error: `Failed to clear old store amounts: ${deleteError.message}`,
      };
    }

    const { error: insertError } = await supabase
      .from("barsy_store_amounts")
      .insert(uniqueAmounts);

    if (insertError) {
      console.error("Store amounts insert error:", insertError);
      return {
        success: false,
        error: `Failed to insert store amounts: ${insertError.message}`,
      };
    }

    const withCosts = uniqueAmounts.filter(
      (a: any) => a.cost_price !== null
    ).length;
    console.log(
      `✅ Synced ${uniqueAmounts.length} store amounts (${withCosts} with cost data)`
    );

    return { success: true, recordsSynced: uniqueAmounts.length };
  } catch (error) {
    console.error("Current inventory sync error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get inventory valuation summary by location
 */
export async function getInventoryValuation(locationId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("barsy_store_amounts")
    .select("*")
    .eq("location_id", locationId)
    .not("quantity", "is", null)
    .gt("quantity", 0);

  if (error) {
    return { error: error.message };
  }

  const totalQuantity = data.reduce(
    (sum: number, item: any) => sum + (parseFloat(item.quantity) || 0),
    0
  );

  const totalValue = data.reduce(
    (sum: number, item: any) => sum + (parseFloat(item.total_value) || 0),
    0
  );

  const itemsWithCost = data.filter(
    (item: any) => item.cost_price !== null
  ).length;

  return {
    data: {
      totalItems: data.length,
      itemsWithCost,
      totalQuantity,
      totalValue,
      averageCostCoverage:
        data.length > 0 ? ((itemsWithCost / data.length) * 100).toFixed(1) : 0,
    },
  };
}
