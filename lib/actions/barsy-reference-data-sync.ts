"use server";

import { BarsyApiClient } from "@/lib/services/barsy-api";
import { createClient } from "@/lib/supabase/server";

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

/**
 * Sync payment methods from Barsy
 */
export async function syncBarsyPaymentMethods(
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
        error: `Failed to fetch location: ${locationError?.message || "Not found"}`,
      };
    }

    console.log(`Syncing payment methods for location: ${location.name}`);

    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    const response = await barsyClient.getPaymentMethods();

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || "Failed to fetch payment methods",
      };
    }

    const paymentMethods = (response.data as any).Paymentmethods_getlist || [];
    console.log(`Fetched ${paymentMethods.length} payment methods`);

    if (paymentMethods.length === 0) {
      return { success: true, recordsSynced: 0 };
    }

    const methodsToInsert = paymentMethods.map((pm: any) => {
      const name = pm.name || pm.paymethod_name || "Unknown";
      const shortName = pm.short_name || pm.paymethod_short_name || null;
      const nameLower = name.toLowerCase();

      return {
        barsy_location_id: locationId,
        paymethod_id: parseInt(pm.paymethod_id || pm.id) || 0,
        name: name,
        short_name: shortName,
        is_cash:
          nameLower.includes("брой") ||
          nameLower.includes("cash") ||
          nameLower.includes("каса"),
        is_card:
          nameLower.includes("карт") ||
          nameLower.includes("card") ||
          nameLower.includes("pos") ||
          nameLower.includes("терминал"),
        is_wallet:
          nameLower.includes("изход") ||
          nameLower.includes("wallet") ||
          nameLower.includes("кеф холдинг") ||
          nameLower.includes("мементо оод") ||
          nameLower.includes("по сметка"),
        is_fiscal: pm.fx === 1 || pm.fx === "1" || pm.is_fiscal === true,
        is_active: pm.delete_flag !== 1 && pm.delete_flag !== "1",
        raw_data: pm,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { error: insertError } = await supabase
      .from("barsy_payment_methods")
      .upsert(methodsToInsert, {
        onConflict: "barsy_location_id,paymethod_id",
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error("Payment methods insert error:", insertError);
      return {
        success: false,
        error: `Failed to insert payment methods: ${insertError.message}`,
      };
    }

    console.log(`✅ Synced ${methodsToInsert.length} payment methods`);
    return { success: true, recordsSynced: methodsToInsert.length };
  } catch (error) {
    console.error("Payment methods sync error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync tax groups from Barsy
 */
export async function syncBarsyTaxGroups(
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
        error: `Failed to fetch location: ${locationError?.message || "Not found"}`,
      };
    }

    console.log(`Syncing tax groups for location: ${location.name}`);

    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    const response = await barsyClient.getTaxGroups();

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || "Failed to fetch tax groups",
      };
    }

    const taxGroups = (response.data as any).Taxgroups_getlist || [];
    console.log(`Fetched ${taxGroups.length} tax groups`);

    if (taxGroups.length === 0) {
      return { success: true, recordsSynced: 0 };
    }

    const taxGroupsToInsert = taxGroups.map((tg: any) => ({
      barsy_location_id: locationId,
      tax_group_id: parseInt(tg.tax_group_id || tg.id) || 0,
      name: tg.name || tg.tax_group_name || "Unknown",
      tax_rate: tg.tax ? parseFloat(tg.tax) : null,
      is_default: tg.is_default === 1 || tg.is_default === "1",
      raw_data: tg,
      synced_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from("barsy_tax_groups_ref")
      .upsert(taxGroupsToInsert, {
        onConflict: "barsy_location_id,tax_group_id",
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error("Tax groups insert error:", insertError);
      return {
        success: false,
        error: `Failed to insert tax groups: ${insertError.message}`,
      };
    }

    console.log(`✅ Synced ${taxGroupsToInsert.length} tax groups`);
    return { success: true, recordsSynced: taxGroupsToInsert.length };
  } catch (error) {
    console.error("Tax groups sync error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync depots (warehouses) from Barsy
 */
export async function syncBarsyDepots(locationId: string): Promise<SyncResult> {
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
        error: `Failed to fetch location: ${locationError?.message || "Not found"}`,
      };
    }

    console.log(`Syncing depots for location: ${location.name}`);

    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    const response = await barsyClient.getDepots();

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || "Failed to fetch depots",
      };
    }

    const depots = (response.data as any).Depots_getlist || [];
    console.log(`Fetched ${depots.length} depots`);

    if (depots.length === 0) {
      return { success: true, recordsSynced: 0 };
    }

    const depotsToInsert = depots.map((d: any) => ({
      barsy_location_id: locationId,
      depot_id: parseInt(d.depot_id || d.id) || 0,
      name: d.name || d.depot_name || "Unknown",
      barsy_id: d.barsy_id ? parseInt(d.barsy_id) : null,
      is_default: d.is_default === 1 || d.is_default === "1",
      is_active: d.delete_flag !== 1 && d.delete_flag !== "1",
      raw_data: d,
      synced_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from("barsy_depots")
      .upsert(depotsToInsert, {
        onConflict: "barsy_location_id,depot_id",
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error("Depots insert error:", insertError);
      return {
        success: false,
        error: `Failed to insert depots: ${insertError.message}`,
      };
    }

    console.log(`✅ Synced ${depotsToInsert.length} depots`);
    return { success: true, recordsSynced: depotsToInsert.length };
  } catch (error) {
    console.error("Depots sync error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync places (tables/areas) from Barsy
 */
export async function syncBarsyPlaces(locationId: string): Promise<SyncResult> {
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
        error: `Failed to fetch location: ${locationError?.message || "Not found"}`,
      };
    }

    console.log(`Syncing places for location: ${location.name}`);

    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    const response = await barsyClient.getPlaces();

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || "Failed to fetch places",
      };
    }

    const places = (response.data as any).Places_getlist || [];
    console.log(`Fetched ${places.length} places`);

    if (places.length === 0) {
      return { success: true, recordsSynced: 0 };
    }

    const placesToInsert = places.map((p: any) => ({
      barsy_location_id: locationId,
      place_id: parseInt(p.place_id || p.id) || 0,
      name: p.name || p.place_name || p.place_num || "Unknown",
      place_type: p.place_type ? parseInt(p.place_type) : null,
      place_type_name: p.place_type_name || null,
      salon_name: p.salon_name || null,
      is_active: p.delete_flag !== 1 && p.delete_flag !== "1",
      raw_data: p,
      synced_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase.from("barsy_places").upsert(placesToInsert, {
      onConflict: "barsy_location_id,place_id",
      ignoreDuplicates: false,
    });

    if (insertError) {
      console.error("Places insert error:", insertError);
      return {
        success: false,
        error: `Failed to insert places: ${insertError.message}`,
      };
    }

    console.log(`✅ Synced ${placesToInsert.length} places`);
    return { success: true, recordsSynced: placesToInsert.length };
  } catch (error) {
    console.error("Places sync error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync all reference data for a location
 */
export async function syncAllBarsyReferenceData(
  locationId: string
): Promise<{
  success: boolean;
  results: Record<string, SyncResult>;
}> {
  const results: Record<string, SyncResult> = {};

  console.log(`🔄 Syncing all reference data for location: ${locationId}`);

  // Sync payment methods
  results.paymentMethods = await syncBarsyPaymentMethods(locationId);

  // Sync tax groups
  results.taxGroups = await syncBarsyTaxGroups(locationId);

  // Sync depots
  results.depots = await syncBarsyDepots(locationId);

  // Sync places
  results.places = await syncBarsyPlaces(locationId);

  const allSuccess = Object.values(results).every((r) => r.success);

  console.log(`✅ Reference data sync complete. Success: ${allSuccess}`);

  return {
    success: allSuccess,
    results,
  };
}

/**
 * OPTIMIZED: Sync all reference data in a single batched API request
 * Uses Barsy's multi-method request feature to fetch all reference data at once
 * ~5-7x faster than individual requests
 */
export async function syncAllBarsyReferenceDataBatched(
  locationId: string
): Promise<{
  success: boolean;
  results: Record<string, SyncResult>;
}> {
  const results: Record<string, SyncResult> = {};
  const startTime = Date.now();

  console.log(`🚀 Syncing all reference data (batched) for location: ${locationId}`);

  try {
    const supabase = await createClient();

    const { data: location, error: locationError } = await supabase
      .from("barsy_locations")
      .select("*")
      .eq("id", locationId)
      .single();

    if (locationError || !location) {
      const error = `Failed to fetch location: ${locationError?.message || "Not found"}`;
      return {
        success: false,
        results: {
          error: { success: false, error, recordsSynced: 0 },
        },
      };
    }

    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Single batched API request for all reference data
    console.log("📡 Fetching all reference data in single request...");
    const response = await barsyClient.getAllReferenceData();

    if (!response.success || !response.data) {
      return {
        success: false,
        results: {
          error: { success: false, error: response.error || "API request failed", recordsSynced: 0 },
        },
      };
    }

    const data = response.data;
    console.log(`✅ Received batched response in ${Date.now() - startTime}ms`);

    // Process all data types in parallel DB inserts
    const [paymentMethodsResult, taxGroupsResult, depotsResult, placesResult, posesResult, suppliersResult] = 
      await Promise.all([
        // Payment methods
        processPaymentMethods(supabase, locationId, data.Paymentmethods_getlist || []),
        // Tax groups
        processTaxGroups(supabase, locationId, data.Taxgroups_getlist || []),
        // Depots
        processDepots(supabase, locationId, data.Depots_getlist || []),
        // Places
        processPlaces(supabase, locationId, data.Places_getlist || []),
        // POSes
        processPoses(supabase, locationId, data.Poses_getlist || []),
        // Suppliers
        processSuppliers(supabase, locationId, data.Suppliers_getlist || [], location.memento_location_id),
      ]);

    results.paymentMethods = paymentMethodsResult;
    results.taxGroups = taxGroupsResult;
    results.depots = depotsResult;
    results.places = placesResult;
    results.poses = posesResult;
    results.suppliers = suppliersResult;

    const allSuccess = Object.values(results).every((r) => r.success);
    const totalRecords = Object.values(results).reduce((sum, r) => sum + (r.recordsSynced || 0), 0);
    const elapsed = Date.now() - startTime;

    console.log(`✅ Reference data sync complete in ${elapsed}ms. Total records: ${totalRecords}. Success: ${allSuccess}`);

    return {
      success: allSuccess,
      results,
    };
  } catch (error) {
    console.error("Batched reference data sync error:", error);
    return {
      success: false,
      results: {
        error: { success: false, error: error instanceof Error ? error.message : "Unknown error", recordsSynced: 0 },
      },
    };
  }
}

// Helper functions for processing batched data
async function processPaymentMethods(supabase: any, locationId: string, paymentMethods: unknown[]): Promise<SyncResult> {
  if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
    return { success: true, recordsSynced: 0 };
  }

  const methodsToInsert = paymentMethods.map((pm: any) => {
    const name = pm.name || pm.paymethod_name || "Unknown";
    const shortName = pm.short_name || pm.paymethod_short_name || null;
    const nameLower = name.toLowerCase();

    return {
      barsy_location_id: locationId,
      paymethod_id: parseInt(pm.paymethod_id || pm.id) || 0,
      name: name,
      short_name: shortName,
      is_cash: nameLower.includes("брой") || nameLower.includes("cash") || nameLower.includes("каса"),
      is_card: nameLower.includes("карт") || nameLower.includes("card") || nameLower.includes("pos") || nameLower.includes("терминал"),
      is_wallet: nameLower.includes("изход") || nameLower.includes("wallet") || nameLower.includes("кеф холдинг") || nameLower.includes("мементо оод") || nameLower.includes("по сметка"),
      is_fiscal: pm.fx === 1 || pm.fx === "1" || pm.is_fiscal === true,
      is_active: pm.delete_flag !== 1 && pm.delete_flag !== "1",
      raw_data: pm,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase.from("barsy_payment_methods").upsert(methodsToInsert, {
    onConflict: "barsy_location_id,paymethod_id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("Payment methods insert error:", error);
    return { success: false, error: error.message, recordsSynced: 0 };
  }

  console.log(`  ✅ Payment methods: ${methodsToInsert.length}`);
  return { success: true, recordsSynced: methodsToInsert.length };
}

async function processTaxGroups(supabase: any, locationId: string, taxGroups: unknown[]): Promise<SyncResult> {
  if (!Array.isArray(taxGroups) || taxGroups.length === 0) {
    return { success: true, recordsSynced: 0 };
  }

  const taxGroupsToInsert = taxGroups.map((tg: any) => ({
    barsy_location_id: locationId,
    tax_group_id: parseInt(tg.tax_group_id || tg.id) || 0,
    name: tg.name || tg.tax_group_name || "Unknown",
    tax_rate: tg.tax ? parseFloat(tg.tax) : null,
    is_default: tg.is_default === 1 || tg.is_default === "1",
    raw_data: tg,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("barsy_tax_groups_ref").upsert(taxGroupsToInsert, {
    onConflict: "barsy_location_id,tax_group_id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("Tax groups insert error:", error);
    return { success: false, error: error.message, recordsSynced: 0 };
  }

  console.log(`  ✅ Tax groups: ${taxGroupsToInsert.length}`);
  return { success: true, recordsSynced: taxGroupsToInsert.length };
}

async function processDepots(supabase: any, locationId: string, depots: unknown[]): Promise<SyncResult> {
  if (!Array.isArray(depots) || depots.length === 0) {
    return { success: true, recordsSynced: 0 };
  }

  const depotsToInsert = depots.map((d: any) => ({
    barsy_location_id: locationId,
    depot_id: parseInt(d.depot_id || d.id) || 0,
    name: d.name || d.depot_name || "Unknown",
    barsy_id: d.barsy_id ? parseInt(d.barsy_id) : null,
    is_default: d.is_default === 1 || d.is_default === "1",
    is_active: d.delete_flag !== 1 && d.delete_flag !== "1",
    raw_data: d,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("barsy_depots").upsert(depotsToInsert, {
    onConflict: "barsy_location_id,depot_id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("Depots insert error:", error);
    return { success: false, error: error.message, recordsSynced: 0 };
  }

  console.log(`  ✅ Depots: ${depotsToInsert.length}`);
  return { success: true, recordsSynced: depotsToInsert.length };
}

async function processPlaces(supabase: any, locationId: string, places: unknown[]): Promise<SyncResult> {
  if (!Array.isArray(places) || places.length === 0) {
    return { success: true, recordsSynced: 0 };
  }

  const placesToInsert = places.map((p: any) => ({
    barsy_location_id: locationId,
    place_id: parseInt(p.place_id || p.id) || 0,
    name: p.name || p.place_name || p.place_num || "Unknown",
    place_type: p.place_type ? parseInt(p.place_type) : null,
    place_type_name: p.place_type_name || null,
    salon_name: p.salon_name || null,
    is_active: p.delete_flag !== 1 && p.delete_flag !== "1",
    raw_data: p,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("barsy_places").upsert(placesToInsert, {
    onConflict: "barsy_location_id,place_id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("Places insert error:", error);
    return { success: false, error: error.message, recordsSynced: 0 };
  }

  console.log(`  ✅ Places: ${placesToInsert.length}`);
  return { success: true, recordsSynced: placesToInsert.length };
}

async function processPoses(supabase: any, locationId: string, poses: unknown[]): Promise<SyncResult> {
  if (!Array.isArray(poses) || poses.length === 0) {
    return { success: true, recordsSynced: 0 };
  }

  const posesToInsert = poses.map((pos: any) => ({
    barsy_location_id: locationId,
    pos_id: parseInt(pos.pos_id || pos.id) || 0,
    pos_name: pos.pos_name || pos.name || "Unknown",
    barsy_id: pos.barsy_id ? parseInt(pos.barsy_id) : null,
    device_id: pos.device_id || null,
    is_active: pos.is_active ?? true,
    is_fiscal: pos.is_fiscal ?? false,
    raw_data: pos,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("barsy_poses").upsert(posesToInsert, {
    onConflict: "barsy_location_id,pos_id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("POSes insert error:", error);
    return { success: false, error: error.message, recordsSynced: 0 };
  }

  console.log(`  ✅ POSes: ${posesToInsert.length}`);
  return { success: true, recordsSynced: posesToInsert.length };
}

async function processSuppliers(supabase: any, locationId: string, suppliers: unknown[], mementoLocationId: number | null): Promise<SyncResult> {
  if (!Array.isArray(suppliers) || suppliers.length === 0) {
    return { success: true, recordsSynced: 0 };
  }

  const suppliersToInsert = suppliers.map((supplier: any) => ({
    barsy_location_id: locationId,
    location_id: mementoLocationId,
    supplier_id: parseInt(supplier.supplier_id || supplier.id) || 0,
    supplier_name: supplier.supplier_name || supplier.name || "Unknown",
    bulstat: supplier.bulstat || null,
    vat_number: supplier.vat_number || null,
    address: supplier.address || null,
    city: supplier.city || null,
    phone: supplier.phone || null,
    email: supplier.email || null,
    contact_person: supplier.contact_person || null,
    is_active: supplier.is_active ?? true,
    payment_terms_days: supplier.payment_terms_days || null,
    raw_data: supplier,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("barsy_suppliers").upsert(suppliersToInsert, {
    onConflict: "barsy_location_id,supplier_id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("Suppliers insert error:", error);
    return { success: false, error: error.message, recordsSynced: 0 };
  }

  console.log(`  ✅ Suppliers: ${suppliersToInsert.length}`);
  return { success: true, recordsSynced: suppliersToInsert.length };
}
