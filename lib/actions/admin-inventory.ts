"use server";

import {
  syncBarsyCurrentInventory,
  syncBarsyInventorySnapshot,
} from "@/lib/actions/barsy-inventory-reports-sync";
import { createClient } from "@/lib/supabase/server";

export interface InventoryArticle {
  barsy_article_id: number;
  article_name: string;
  location_id: string | null;
  location_name: string | null;
  category_id: number | null;
  category_name: string | null;
  amount_unit: string | null;
  cost_price: number | null;
  avg_delivery_price: number | null;
  delivery_price_last: number | null;
  effective_cost: number | null;
  is_for_sale: boolean;
}

export interface InventoryMovement {
  barsy_article_id: number;
  article_name: string;
  location_id: string;
  location_name: string;
  quantity_loaded: number;
  total_value_loaded: number;
  unit_price: number | null;
}

export interface PeriodInventorySummary {
  location_id: string;
  location_name: string;
  start_quantity: number;
  start_value: number;
  quantity_added: number;
  value_added: number;
  end_quantity: number;
  end_value: number;
  items: PeriodInventoryItem[];
}

export interface PeriodInventoryItem {
  barsy_article_id: number;
  article_name: string;
  unit: string | null;
  start_quantity: number;
  quantity_added: number;
  end_quantity: number;
  unit_price: number | null;
  start_value: number;
  value_added: number;
  end_value: number;
}

/**
 * Get all articles with their cost information
 */
export const getArticlesWithCosts = async (
  locationId?: string
): Promise<{ data?: InventoryArticle[]; error?: string }> => {
  try {
    const supabase = await createClient();

    // Get articles
    let query = supabase
      .from("barsy_articles")
      .select(
        `
        barsy_article_id,
        article_name,
        location_id,
        category_id,
        amount_unit,
        cost_price,
        avg_delivery_price,
        delivery_price_last,
        is_for_sale
      `
      )
      .eq("delete_flag", false)
      .order("article_name");

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data: articles, error } = await query;

    if (error) {
      return { error: error.message };
    }

    if (!articles || articles.length === 0) {
      return { data: [] };
    }

    // Get unique location IDs and category IDs
    const locationIds = [
      ...new Set(articles.map((a: any) => a.location_id).filter(Boolean)),
    ];
    const categoryIds = [
      ...new Set(articles.map((a: any) => a.category_id).filter(Boolean)),
    ];

    // Fetch barsy_locations
    const { data: barsyLocations } = await supabase
      .from("barsy_locations")
      .select("id, name")
      .in("id", locationIds.length > 0 ? locationIds : ["none"]);

    const locationMap = new Map(
      (barsyLocations || []).map((l: any) => [l.id, l.name])
    );

    // Fetch barsy_categories
    const { data: barsyCategories } = await supabase
      .from("barsy_categories")
      .select("barsy_cat_id, cat_name, location_id")
      .in("barsy_cat_id", categoryIds.length > 0 ? categoryIds : [-1]);

    // Create category map: key = "location_id-category_id"
    const categoryMap = new Map(
      (barsyCategories || []).map((c: any) => [
        `${c.location_id}-${c.barsy_cat_id}`,
        c.cat_name,
      ])
    );

    const result: InventoryArticle[] = articles.map((article: any) => {
      // Calculate effective cost: prefer cost_price, then avg_delivery_price, then delivery_price_last
      const effectiveCost =
        article.cost_price ||
        article.avg_delivery_price ||
        article.delivery_price_last ||
        null;

      // Look up category name using location_id + category_id
      const categoryKey = `${article.location_id}-${article.category_id}`;
      const categoryName = categoryMap.get(categoryKey) || null;

      return {
        barsy_article_id: article.barsy_article_id,
        article_name: article.article_name,
        location_id: article.location_id,
        location_name: locationMap.get(article.location_id) || null,
        category_id: article.category_id,
        category_name: categoryName,
        amount_unit: article.amount_unit,
        cost_price: article.cost_price ? parseFloat(article.cost_price) : null,
        avg_delivery_price: article.avg_delivery_price
          ? parseFloat(article.avg_delivery_price)
          : null,
        delivery_price_last: article.delivery_price_last
          ? parseFloat(article.delivery_price_last)
          : null,
        effective_cost: effectiveCost ? parseFloat(effectiveCost) : null,
        is_for_sale: article.is_for_sale ?? false,
      };
    });

    return { data: result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get articles without any cost/price set
 */
export const getArticlesWithoutCost = async (
  locationId?: string
): Promise<{ data?: InventoryArticle[]; error?: string }> => {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("barsy_articles")
      .select(
        `
        barsy_article_id,
        article_name,
        location_id,
        category_id,
        amount_unit,
        cost_price,
        avg_delivery_price,
        delivery_price_last,
        is_for_sale
      `
      )
      .eq("delete_flag", false)
      .is("cost_price", null)
      .is("avg_delivery_price", null)
      .is("delivery_price_last", null)
      .order("article_name");

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data: articles, error } = await query;

    if (error) {
      return { error: error.message };
    }

    if (!articles || articles.length === 0) {
      return { data: [] };
    }

    // Get unique location IDs and category IDs
    const locationIds = [
      ...new Set(articles.map((a: any) => a.location_id).filter(Boolean)),
    ];
    const categoryIds = [
      ...new Set(articles.map((a: any) => a.category_id).filter(Boolean)),
    ];

    // Fetch barsy_locations
    const { data: barsyLocations } = await supabase
      .from("barsy_locations")
      .select("id, name")
      .in("id", locationIds.length > 0 ? locationIds : ["none"]);

    const locationMap = new Map(
      (barsyLocations || []).map((l: any) => [l.id, l.name])
    );

    // Fetch barsy_categories
    const { data: barsyCategories } = await supabase
      .from("barsy_categories")
      .select("barsy_cat_id, cat_name, location_id")
      .in("barsy_cat_id", categoryIds.length > 0 ? categoryIds : [-1]);

    // Create category map: key = "location_id-category_id"
    const categoryMap = new Map(
      (barsyCategories || []).map((c: any) => [
        `${c.location_id}-${c.barsy_cat_id}`,
        c.cat_name,
      ])
    );

    const result: InventoryArticle[] = articles.map((article: any) => {
      // Look up category name using location_id + category_id
      const categoryKey = `${article.location_id}-${article.category_id}`;
      const categoryName = categoryMap.get(categoryKey) || null;

      return {
        barsy_article_id: article.barsy_article_id,
        article_name: article.article_name,
        location_id: article.location_id,
        location_name: locationMap.get(article.location_id) || null,
        category_id: article.category_id,
        category_name: categoryName,
        amount_unit: article.amount_unit,
        cost_price: null,
        avg_delivery_price: null,
        delivery_price_last: null,
        effective_cost: null,
        is_for_sale: article.is_for_sale ?? false,
      };
    });

    return { data: result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get inventory movements (store loads) for a date range
 */
export const getInventoryMovements = async (
  dateFrom: string,
  dateTo: string,
  locationId?: string
): Promise<{ data?: PeriodInventorySummary[]; error?: string }> => {
  try {
    const supabase = await createClient();

    // Get store loads within the period
    let storeLoadsQuery = supabase
      .from("barsy_store_loads")
      .select(
        `
        id,
        barsy_location_id,
        doc_date,
        depot_id
      `
      )
      .gte("doc_date", dateFrom)
      .lte("doc_date", dateTo)
      .eq("operation_type", 1); // Load only, not returns

    if (locationId) {
      storeLoadsQuery = storeLoadsQuery.eq("barsy_location_id", locationId);
    }

    const { data: storeLoads, error: loadsError } = await storeLoadsQuery;

    if (loadsError) {
      return { error: loadsError.message };
    }

    if (!storeLoads || storeLoads.length === 0) {
      return { data: [] };
    }

    // Get store load items
    const storeLoadIds = storeLoads.map((sl: any) => sl.id);
    const { data: loadItems, error: itemsError } = await supabase
      .from("barsy_store_load_items")
      .select(
        `
        store_load_id,
        barsy_article_id,
        article_name,
        quantity,
        unit_price,
        total_price,
        amount_type
      `
      )
      .in("store_load_id", storeLoadIds);

    if (itemsError) {
      return { error: itemsError.message };
    }

    // Get barsy locations (the barsy_location_id is a UUID referencing barsy_locations)
    const locationIds = [
      ...new Set(storeLoads.map((sl: any) => sl.barsy_location_id)),
    ];
    const { data: barsyLocations } = await supabase
      .from("barsy_locations")
      .select("id, name")
      .in("id", locationIds);

    const locationMap = new Map(
      (barsyLocations || []).map((l: any) => [l.id, l.name])
    );

    // Create a map of store_load_id to location_id
    const loadLocationMap = new Map(
      storeLoads.map((sl: any) => [sl.id, sl.barsy_location_id])
    );

    // Aggregate by location and article
    const locationSummaries = new Map<
      string,
      Map<number, PeriodInventoryItem>
    >();

    for (const item of loadItems || []) {
      const locationId = loadLocationMap.get(item.store_load_id);
      if (!locationId) continue;

      if (!locationSummaries.has(locationId)) {
        locationSummaries.set(locationId, new Map());
      }

      const articleMap = locationSummaries.get(locationId)!;
      const existing = articleMap.get(item.barsy_article_id);
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = item.unit_price ? parseFloat(item.unit_price) : null;
      const totalValue = item.total_price
        ? parseFloat(item.total_price)
        : quantity * (unitPrice || 0);

      if (existing) {
        existing.quantity_added += quantity;
        existing.value_added += totalValue;
        existing.end_quantity += quantity;
        existing.end_value += totalValue;
        // Keep unit price from latest entry
        if (unitPrice) {
          existing.unit_price = unitPrice;
        }
      } else {
        articleMap.set(item.barsy_article_id, {
          barsy_article_id: item.barsy_article_id,
          article_name: item.article_name,
          unit: item.amount_type,
          start_quantity: 0, // We don't have historical start quantities
          quantity_added: quantity,
          end_quantity: quantity, // For now, just show what was added
          unit_price: unitPrice,
          start_value: 0,
          value_added: totalValue,
          end_value: totalValue,
        });
      }
    }

    // Build result
    const result: PeriodInventorySummary[] = [];
    for (const [locId, articleMap] of locationSummaries) {
      const items = Array.from(articleMap.values()).sort((a, b) =>
        a.article_name.localeCompare(b.article_name)
      );

      const summary: PeriodInventorySummary = {
        location_id: locId,
        location_name: locationMap.get(locId) || "Unknown Location",
        start_quantity: items.reduce((sum, i) => sum + i.start_quantity, 0),
        start_value: items.reduce((sum, i) => sum + i.start_value, 0),
        quantity_added: items.reduce((sum, i) => sum + i.quantity_added, 0),
        value_added: items.reduce((sum, i) => sum + i.value_added, 0),
        end_quantity: items.reduce((sum, i) => sum + i.end_quantity, 0),
        end_value: items.reduce((sum, i) => sum + i.end_value, 0),
        items,
      };

      result.push(summary);
    }

    return {
      data: result.sort((a, b) =>
        a.location_name.localeCompare(b.location_name)
      ),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get current inventory value summary by location
 */
export const getCurrentInventoryValue = async (): Promise<{
  data?: {
    location_id: string;
    location_name: string;
    total_articles: number;
    articles_with_cost: number;
    articles_without_cost: number;
    estimated_value: number;
  }[];
  error?: string;
}> => {
  try {
    const supabase = await createClient();

    const { data: articles, error } = await supabase
      .from("barsy_articles")
      .select(
        `
        location_id,
        barsy_article_id,
        cost_price,
        avg_delivery_price,
        delivery_price_last
      `
      )
      .eq("delete_flag", false);

    if (error) {
      return { error: error.message };
    }

    // Get unique location IDs
    const locationIds = [
      ...new Set(
        (articles || []).map((a: any) => a.location_id).filter(Boolean)
      ),
    ];

    // Fetch barsy_locations
    const { data: barsyLocations } = await supabase
      .from("barsy_locations")
      .select("id, name")
      .in("id", locationIds.length > 0 ? locationIds : ["none"]);

    const locationMap = new Map(
      (barsyLocations || []).map((l: any) => [l.id, l.name])
    );

    // Group by location
    const locationSummaries = new Map<
      string,
      {
        location_name: string;
        total_articles: number;
        articles_with_cost: number;
        articles_without_cost: number;
        estimated_value: number;
      }
    >();

    for (const article of articles || []) {
      const locId = article.location_id || "no-location";
      const effectiveCost =
        article.cost_price ||
        article.avg_delivery_price ||
        article.delivery_price_last;
      const hasCost = effectiveCost !== null;

      if (!locationSummaries.has(locId)) {
        locationSummaries.set(locId, {
          location_name: locationMap.get(locId) || "No Location",
          total_articles: 0,
          articles_with_cost: 0,
          articles_without_cost: 0,
          estimated_value: 0,
        });
      }

      const summary = locationSummaries.get(locId)!;
      summary.total_articles++;
      if (hasCost) {
        summary.articles_with_cost++;
        // Assume quantity of 1 for each article since we don't have actual stock quantities
        summary.estimated_value += parseFloat(effectiveCost) || 0;
      } else {
        summary.articles_without_cost++;
      }
    }

    const result = Array.from(locationSummaries.entries()).map(
      ([location_id, summary]) => ({
        location_id,
        ...summary,
      })
    );

    return {
      data: result.sort((a, b) =>
        a.location_name.localeCompare(b.location_name)
      ),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get barsy locations for the dropdown (uses UUID IDs)
 */
export const getInventoryLocations = async (): Promise<{
  data?: { id: string; name: string }[];
  error?: string;
}> => {
  try {
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
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// =====================================
// Inventory Stock & Snapshots
// =====================================

export type InventoryType = "product" | "ingredient" | "asset" | "consumable";

export interface StockItem {
  id: string;
  location_id: string;
  location_name: string;
  barsy_article_id: number;
  article_name: string;
  depot_id: number | null;
  depot_name: string | null;
  quantity: number;
  unit: string | null;
  cost_price: number | null;
  total_value: number | null;
  inventory_type: InventoryType;
  synced_at: string | null;
}

export interface InventorySnapshot {
  id: string;
  location_id: string;
  location_name: string;
  snapshot_date: string;
  barsy_article_id: number;
  article_name: string;
  depot_id: number | null;
  depot_name: string | null;
  quantity: number;
  unit: string | null;
  cost_price: number | null;
  total_value: number | null;
}

export interface InventoryValueSummary {
  location_id: string;
  location_name: string;
  total_items: number;
  items_with_value: number;
  total_quantity: number;
  total_value: number;
  synced_at: string | null;
}

export interface SnapshotSummary {
  location_id: string;
  location_name: string;
  snapshot_date: string;
  total_items: number;
  total_quantity: number;
  total_value: number;
}

/**
 * Sync current inventory stock from Barsy
 */
export const syncCurrentStock = async (
  locationId: string
): Promise<{ success: boolean; recordsSynced?: number; error?: string }> => {
  try {
    const result = await syncBarsyCurrentInventory(locationId);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Create an inventory snapshot for a specific date
 */
export const createSnapshot = async (
  locationId: string,
  snapshotDate: string
): Promise<{ success: boolean; recordsSynced?: number; error?: string }> => {
  try {
    const result = await syncBarsyInventorySnapshot(locationId, snapshotDate);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get current stock levels from barsy_store_amounts
 */
export const getCurrentStock = async (
  locationId?: string,
  includeZeroQuantity: boolean = false
): Promise<{ data?: StockItem[]; error?: string }> => {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("barsy_store_amounts")
      .select("*")
      .order("article_name");

    if (!includeZeroQuantity) {
      query = query.gt("quantity", 0);
    }

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data: stockItems, error } = await query;

    if (error) {
      return { error: error.message };
    }

    if (!stockItems || stockItems.length === 0) {
      return { data: [] };
    }

    // Get unique location IDs
    const locationIds = [
      ...new Set(stockItems.map((s: any) => s.location_id).filter(Boolean)),
    ];

    // Fetch barsy_locations
    const { data: barsyLocations } = await supabase
      .from("barsy_locations")
      .select("id, name")
      .in("id", locationIds.length > 0 ? locationIds : ["none"]);

    const locationMap = new Map(
      (barsyLocations || []).map((l: any) => [l.id, l.name])
    );

    const result: StockItem[] = stockItems.map((item: any) => ({
      id: item.id,
      location_id: item.location_id,
      location_name: locationMap.get(item.location_id) || "Unknown",
      barsy_article_id: item.barsy_article_id,
      article_name: item.article_name,
      depot_id: item.depot_id,
      depot_name: item.depot_name,
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit,
      cost_price: item.cost_price ? parseFloat(item.cost_price) : null,
      total_value: item.total_value ? parseFloat(item.total_value) : null,
      inventory_type: item.inventory_type || "product",
      synced_at: item.synced_at,
    }));

    return { data: result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get current stock value summary by location
 */
export const getCurrentStockSummary = async (): Promise<{
  data?: InventoryValueSummary[];
  error?: string;
}> => {
  try {
    const supabase = await createClient();

    const { data: stockItems, error } = await supabase
      .from("barsy_store_amounts")
      .select("*")
      .gt("quantity", 0);

    if (error) {
      return { error: error.message };
    }

    if (!stockItems || stockItems.length === 0) {
      return { data: [] };
    }

    // Get unique location IDs
    const locationIds = [
      ...new Set(stockItems.map((s: any) => s.location_id).filter(Boolean)),
    ];

    // Fetch barsy_locations
    const { data: barsyLocations } = await supabase
      .from("barsy_locations")
      .select("id, name")
      .in("id", locationIds.length > 0 ? locationIds : ["none"]);

    const locationMap = new Map(
      (barsyLocations || []).map((l: any) => [l.id, l.name])
    );

    // Group by location
    const summaries = new Map<string, InventoryValueSummary>();

    for (const item of stockItems) {
      const locId = item.location_id;
      if (!summaries.has(locId)) {
        summaries.set(locId, {
          location_id: locId,
          location_name: locationMap.get(locId) || "Unknown",
          total_items: 0,
          items_with_value: 0,
          total_quantity: 0,
          total_value: 0,
          synced_at: item.synced_at,
        });
      }

      const summary = summaries.get(locId)!;
      summary.total_items++;
      summary.total_quantity += parseFloat(item.quantity) || 0;

      if (item.total_value) {
        summary.items_with_value++;
        summary.total_value += parseFloat(item.total_value) || 0;
      }

      // Track latest sync time
      if (
        item.synced_at &&
        (!summary.synced_at || item.synced_at > summary.synced_at)
      ) {
        summary.synced_at = item.synced_at;
      }
    }

    return {
      data: Array.from(summaries.values()).sort((a, b) =>
        a.location_name.localeCompare(b.location_name)
      ),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get inventory snapshot for a specific date
 */
export const getInventorySnapshot = async (
  snapshotDate: string,
  locationId?: string
): Promise<{ data?: InventorySnapshot[]; error?: string }> => {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("barsy_inventory_snapshots")
      .select("*")
      .eq("snapshot_date", snapshotDate)
      .order("article_name");

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data: snapshots, error } = await query;

    if (error) {
      return { error: error.message };
    }

    if (!snapshots || snapshots.length === 0) {
      return { data: [] };
    }

    // Get unique location IDs
    const locationIds = [
      ...new Set(snapshots.map((s: any) => s.location_id).filter(Boolean)),
    ];

    // Fetch barsy_locations
    const { data: barsyLocations } = await supabase
      .from("barsy_locations")
      .select("id, name")
      .in("id", locationIds.length > 0 ? locationIds : ["none"]);

    const locationMap = new Map(
      (barsyLocations || []).map((l: any) => [l.id, l.name])
    );

    const result: InventorySnapshot[] = snapshots.map((item: any) => ({
      id: item.id,
      location_id: item.location_id,
      location_name: locationMap.get(item.location_id) || "Unknown",
      snapshot_date: item.snapshot_date,
      barsy_article_id: item.barsy_article_id,
      article_name: item.article_name,
      depot_id: item.depot_id,
      depot_name: item.depot_name,
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit,
      cost_price: item.cost_price ? parseFloat(item.cost_price) : null,
      total_value: item.total_value ? parseFloat(item.total_value) : null,
    }));

    return { data: result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get snapshot summary for a specific date
 */
export const getSnapshotSummary = async (
  snapshotDate: string,
  locationId?: string
): Promise<{ data?: SnapshotSummary[]; error?: string }> => {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("barsy_inventory_snapshots")
      .select("*")
      .eq("snapshot_date", snapshotDate);

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data: snapshots, error } = await query;

    if (error) {
      return { error: error.message };
    }

    if (!snapshots || snapshots.length === 0) {
      return { data: [] };
    }

    // Get unique location IDs
    const locationIds = [
      ...new Set(snapshots.map((s: any) => s.location_id).filter(Boolean)),
    ];

    // Fetch barsy_locations
    const { data: barsyLocations } = await supabase
      .from("barsy_locations")
      .select("id, name")
      .in("id", locationIds.length > 0 ? locationIds : ["none"]);

    const locationMap = new Map(
      (barsyLocations || []).map((l: any) => [l.id, l.name])
    );

    // Group by location
    const summaries = new Map<string, SnapshotSummary>();

    for (const item of snapshots) {
      const locId = item.location_id;
      if (!summaries.has(locId)) {
        summaries.set(locId, {
          location_id: locId,
          location_name: locationMap.get(locId) || "Unknown",
          snapshot_date: snapshotDate,
          total_items: 0,
          total_quantity: 0,
          total_value: 0,
        });
      }

      const summary = summaries.get(locId)!;
      summary.total_items++;
      summary.total_quantity += parseFloat(item.quantity) || 0;
      summary.total_value += item.total_value
        ? parseFloat(item.total_value)
        : 0;
    }

    return {
      data: Array.from(summaries.values()).sort((a, b) =>
        a.location_name.localeCompare(b.location_name)
      ),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get available snapshot dates
 */
export const getAvailableSnapshotDates = async (
  locationId?: string
): Promise<{ data?: string[]; error?: string }> => {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("barsy_inventory_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false });

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    // Get unique dates
    const uniqueDates = [
      ...new Set((data || []).map((d: any) => d.snapshot_date)),
    ];

    return { data: uniqueDates };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get P&L inventory values (opening and closing for a period)
 */
export const getPnLInventoryValues = async (
  startDate: string,
  endDate: string,
  locationId?: string
): Promise<{
  data?: {
    opening: SnapshotSummary[];
    closing: SnapshotSummary[];
    openingTotal: number;
    closingTotal: number;
    inventoryChange: number;
  };
  error?: string;
}> => {
  try {
    const [openingResult, closingResult] = await Promise.all([
      getSnapshotSummary(startDate, locationId),
      getSnapshotSummary(endDate, locationId),
    ]);

    if (openingResult.error) {
      return { error: openingResult.error };
    }

    if (closingResult.error) {
      return { error: closingResult.error };
    }

    const openingTotal = (openingResult.data || []).reduce(
      (sum, s) => sum + s.total_value,
      0
    );
    const closingTotal = (closingResult.data || []).reduce(
      (sum, s) => sum + s.total_value,
      0
    );

    return {
      data: {
        opening: openingResult.data || [],
        closing: closingResult.data || [],
        openingTotal,
        closingTotal,
        inventoryChange: closingTotal - openingTotal,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
