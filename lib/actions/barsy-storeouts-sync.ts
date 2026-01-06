"use server";

import { BarsyApiClient } from "@/lib/services/barsy-api";
import { createClient } from "@/lib/supabase/server";

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

/**
 * Sync store outs (inventory write-offs) from Barsy
 */
export async function syncBarsyStoreOuts(
  locationId: string,
  dateFrom: string,
  dateTo: string
): Promise<SyncResult> {
  try {
    const supabase = await createClient();

    // Get location configuration
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
      `Syncing store outs for location: ${location.name} from ${dateFrom} to ${dateTo}`
    );

    // Initialize Barsy API client
    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Fetch store outs
    const storeOutsResponse = await barsyClient.getAllStoreOuts(
      dateFrom,
      dateTo
    );

    if (!storeOutsResponse.success || !storeOutsResponse.data) {
      const error = storeOutsResponse.error || "Failed to fetch store outs";
      await logSyncError(locationId, "store_outs", error, supabase);
      return {
        success: false,
        error,
      };
    }

    const storeOutsRaw = (storeOutsResponse.data as any).Storeouts_getlist;
    const storeOuts = Array.isArray(storeOutsRaw) ? storeOutsRaw : [];
    console.log(`Fetched ${storeOuts.length} store outs from Barsy API`);

    if (storeOuts.length === 0) {
      await logSync(locationId, "store_outs", 0, supabase);
      return {
        success: true,
        recordsSynced: 0,
      };
    }

    // Transform store outs data AND collect details from each store out
    const storeOutsMapped: any[] = [];
    const allDetails: any[] = [];

    storeOuts.forEach((storeOut: any) => {
      const storeOutId = parseInt(storeOut.storeout_id || storeOut.store_out_id || storeOut.id) || 0;
      const storeOutDate = storeOut.ref_date || storeOut.date || new Date().toISOString();

      storeOutsMapped.push({
        location_id: locationId,
        barsy_store_out_id: storeOutId,
        barsy_article_id: parseInt(storeOut.article_id) || 0,
        article_name: storeOut.article_name || "Unknown",
        quantity: parseFloat(storeOut.amount) || 0,
        unit: storeOut.amount_unit || null,
        depot_id: storeOut.depot_id ? parseInt(storeOut.depot_id) : null,
        depot_name: storeOut.depot_name || null,
        reason_id: storeOut.reason_id ? parseInt(storeOut.reason_id) : null,
        reason_name: storeOut.reason_name || null,
        store_out_date: storeOutDate,
        notes: storeOut.notes || null,
        user_id: storeOut.user_id ? parseInt(storeOut.user_id) : null,
        user_name: storeOut.user_name || null,
        raw_data: storeOut,
        synced_at: new Date().toISOString(),
      });

      // Extract details (line items) with cost data - now included via extra_properties
      if (storeOut.details && Array.isArray(storeOut.details)) {
        storeOut.details.forEach((detail: any) => {
          allDetails.push({
            location_id: locationId,
            barsy_store_out_id: storeOutId,
            barsy_article_id: parseInt(detail.article_id) || 0,
            article_name: detail.article_name || "Unknown",
            quantity: parseFloat(detail.amount) || 0,
            unit: detail.amount_unit || null,
            current_price: detail.current_price ? parseFloat(detail.current_price) : null,
            avg_delivery_price: detail.avg_delivery_price ? parseFloat(detail.avg_delivery_price) : null,
            depot_id: storeOut.depot_id ? parseInt(storeOut.depot_id) : null,
            depot_name: storeOut.depot_name || null,
            store_out_date: storeOutDate,
            raw_data: detail,
            synced_at: new Date().toISOString(),
          });
        });
      }
    });

    // Deduplicate store outs by location_id + barsy_store_out_id (keep last occurrence)
    const storeOutsMap = new Map();
    storeOutsMapped.forEach((storeOut) => {
      const key = `${storeOut.location_id}-${storeOut.barsy_store_out_id}`;
      storeOutsMap.set(key, storeOut);
    });
    const storeOutsToInsert = Array.from(storeOutsMap.values());

    console.log(
      `Inserting ${storeOutsToInsert.length} unique store outs (${
        storeOutsMapped.length - storeOutsToInsert.length
      } duplicates removed)...`
    );

    // Upsert store outs
    const { error: insertError } = await supabase
      .from("barsy_store_outs")
      .upsert(storeOutsToInsert, {
        onConflict: "location_id,barsy_store_out_id",
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      await logSyncError(
        locationId,
        "store_outs",
        insertError.message,
        supabase
      );
      return {
        success: false,
        error: `Failed to insert store outs: ${insertError.message}`,
      };
    }

    console.log(
      `✅ Successfully synced ${storeOutsToInsert.length} store outs`
    );

    // Process details (line items with cost data) - now from the main response
    if (allDetails.length > 0) {
      console.log(`Processing ${allDetails.length} store out details with cost data...`);

      // Deduplicate by location_id + barsy_store_out_id + barsy_article_id
      const detailsMap = new Map();
      allDetails.forEach((detail) => {
        const key = `${detail.location_id}-${detail.barsy_store_out_id}-${detail.barsy_article_id}`;
        detailsMap.set(key, detail);
      });
      const detailsToInsert = Array.from(detailsMap.values());

      console.log(
        `Inserting ${detailsToInsert.length} unique detail rows (${
          allDetails.length - detailsToInsert.length
        } duplicates removed)...`
      );

      // Upsert details
      const { error: detailsInsertError } = await supabase
        .from("barsy_store_out_details")
        .upsert(detailsToInsert, {
          onConflict: "location_id,barsy_store_out_id,barsy_article_id",
          ignoreDuplicates: false,
        });

      if (detailsInsertError) {
        console.error("Details insert error:", detailsInsertError);
        // Don't fail the whole sync, just log the error
      } else {
        const withCosts = detailsToInsert.filter((d: any) => d.avg_delivery_price !== null).length;
        console.log(`✅ Synced ${detailsToInsert.length} store out details (${withCosts} with cost data)`);
      }
    } else {
      console.log("⚠️ No store out details found in API response");
    }

    await logSync(locationId, "store_outs", storeOutsToInsert.length, supabase);

    return {
      success: true,
      recordsSynced: storeOutsToInsert.length,
    };
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    try {
      const supabase = await createClient();
      await logSyncError(locationId, "store_outs", errorMessage, supabase);
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sync current store amounts (inventory levels) from Barsy
 */
export async function syncBarsyStoreAmounts(
  locationId: string
): Promise<SyncResult> {
  try {
    const supabase = await createClient();

    // Get location configuration
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

    console.log(`Syncing store amounts for location: ${location.name}`);

    // Initialize Barsy API client
    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Fetch store amounts
    const storeAmountsResponse = await barsyClient.getStoreAmounts();

    if (!storeAmountsResponse.success || !storeAmountsResponse.data) {
      const error =
        storeAmountsResponse.error || "Failed to fetch store amounts";
      await logSyncError(locationId, "store_amounts", error, supabase);
      return {
        success: false,
        error,
      };
    }

    const storeAmountsRaw = (storeAmountsResponse.data as any).Store_amounts;
    const storeAmounts = Array.isArray(storeAmountsRaw) ? storeAmountsRaw : [];
    console.log(`Fetched ${storeAmounts.length} store amounts from Barsy API`);

    if (storeAmounts.length === 0) {
      await logSync(locationId, "store_amounts", 0, supabase);
      return {
        success: true,
        recordsSynced: 0,
      };
    }

    // Transform store amounts data
    const storeAmountsMapped = storeAmounts.map((amount: any) => ({
      location_id: locationId,
      barsy_article_id: parseInt(amount.article_id) || 0,
      article_name: amount.article_name || "Unknown",
      depot_id: amount.depot_id ? parseInt(amount.depot_id) : null,
      depot_name: amount.depot_name || null,
      quantity: parseFloat(amount.amount) || 0,
      unit: amount.amount_unit || null,
      cost_price: amount.cost_price ? parseFloat(amount.cost_price) : null,
      total_value: amount.total_value ? parseFloat(amount.total_value) : null,
      raw_data: amount,
      synced_at: new Date().toISOString(),
    }));

    // Deduplicate by location_id + barsy_article_id + depot_id (keep last occurrence)
    const storeAmountsMap = new Map();
    storeAmountsMapped.forEach((amount) => {
      const key = `${amount.location_id}-${amount.barsy_article_id}-${amount.depot_id}`;
      storeAmountsMap.set(key, amount);
    });
    const storeAmountsToInsert = Array.from(storeAmountsMap.values());

    console.log(
      `Inserting ${storeAmountsToInsert.length} unique store amounts (${
        storeAmountsMapped.length - storeAmountsToInsert.length
      } duplicates removed)...`
    );

    // Upsert store amounts
    const { error: insertError } = await supabase
      .from("barsy_store_amounts")
      .upsert(storeAmountsToInsert, {
        onConflict: "location_id,barsy_article_id,depot_id",
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      await logSyncError(
        locationId,
        "store_amounts",
        insertError.message,
        supabase
      );
      return {
        success: false,
        error: `Failed to insert store amounts: ${insertError.message}`,
      };
    }

    console.log(
      `✅ Successfully synced ${storeAmountsToInsert.length} store amounts`
    );

    await logSync(
      locationId,
      "store_amounts",
      storeAmountsToInsert.length,
      supabase
    );

    return {
      success: true,
      recordsSynced: storeAmountsToInsert.length,
    };
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    try {
      const supabase = await createClient();
      await logSyncError(locationId, "store_amounts", errorMessage, supabase);
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function logSync(
  locationId: string,
  syncType: string,
  recordsSynced: number,
  supabase: any
) {
  const now = new Date().toISOString();
  await supabase.from("barsy_sync_log").insert({
    location_id: locationId,
    sync_type: syncType,
    records_synced: recordsSynced,
    status: recordsSynced > 0 ? "success" : "completed",
    started_at: now,
    completed_at: now,
  });
}

async function logSyncError(
  locationId: string,
  syncType: string,
  errorMessage: string,
  supabase: any
) {
  const now = new Date().toISOString();
  await supabase.from("barsy_sync_log").insert({
    location_id: locationId,
    sync_type: syncType,
    records_synced: 0,
    status: "failed",
    error_message: errorMessage,
    started_at: now,
    completed_at: now,
  });
}
