/**
 * Standalone sync script for Memento locations
 * Uses direct Supabase connection (no Next.js cookies)
 * Run with: npx tsx scripts/run-sync-standalone.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { BarsyApiClient } from "../lib/services/barsy-api";

// Load env vars from .env.local
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const LOCATIONS = {
  ndk: "382064d5-1542-487a-a566-db269d83526d",
  vitosha: "dca56dbc-b084-41d3-a578-3648c278504f",
};

// Date range: past year
const today = new Date();
const oneYearAgo = new Date();
oneYearAgo.setFullYear(today.getFullYear() - 1);

const dateFrom = oneYearAgo.toISOString().split("T")[0];
const dateTo = today.toISOString().split("T")[0];

async function syncArticles(locationId: string, location: any) {
  console.log("📦 Syncing articles...");

  const barsyClient = new BarsyApiClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  });

  const articlesResponse = await barsyClient.getAllArticles({});

  if (!articlesResponse.success || !articlesResponse.data) {
    console.log(`   ❌ Error: ${articlesResponse.error}`);
    return 0;
  }

  const allArticles = (articlesResponse.data as any).Articles_getlist || [];
  console.log(`   Fetched ${allArticles.length} articles`);

  if (allArticles.length === 0) return 0;

  const articlesToInsert = allArticles.map((article: any) => ({
    location_id: locationId,
    barsy_article_id: parseInt(article.article_id) || 0,
    article_name: article.article_name || "Unknown",
    article_name_public: article.article_name_public || article.article_name,
    barcode: article.barcode || null,
    price: article.price ? parseFloat(article.price) : null,
    cost_price: article.cost_price ? parseFloat(article.cost_price) : null,
    avg_delivery_price: article.avg_delivery_price ? parseFloat(article.avg_delivery_price) : null,
    delivery_price_last: article.delivery_price ? parseFloat(article.delivery_price) : null,
    actual_price: article.actual_price ? parseFloat(article.actual_price) : null,
    current_price: article.current_price ? parseFloat(article.current_price) : null,
    category_id: article.cat_id ? parseInt(article.cat_id) : (article.master_cat_id ? parseInt(article.master_cat_id) : null),
    amount_type_id: article.amount_type_id ? parseInt(article.amount_type_id) : null,
    amount_unit: article.amount_unit || null,
    stream_id: article.stream_id ? parseInt(article.stream_id) : null,
    tax: article.tax ? parseFloat(article.tax) : null,
    tax_code: article.tax_id?.toString() || null,
    is_active: article.delete_flag !== 1 && article.delete_flag !== "1",
    is_for_sale: article.is_for_sale === 1 || article.is_for_sale === "1" || article.is_for_sale === true,
    is_semifinished: article.is_semifinished === "1" || article.is_semifinished === true,
    sort_order: article.sort_order ? parseInt(article.sort_order) : null,
    description: article.description || null,
    delete_flag: article.delete_flag === 1 || article.delete_flag === "1",
    last_update: article.last_update || null,
    raw_data: article,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("barsy_articles")
    .upsert(articlesToInsert, {
      onConflict: "location_id,barsy_article_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return 0;
  }

  console.log(`   ✅ Synced ${articlesToInsert.length} articles`);
  return articlesToInsert.length;
}

async function syncPaymentMethods(locationId: string, location: any) {
  console.log("💳 Syncing payment methods...");

  const barsyClient = new BarsyApiClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  });

  const response = await barsyClient.getPaymentMethods();

  if (!response.success || !response.data) {
    console.log(`   ❌ Error: ${response.error}`);
    return 0;
  }

  const paymentMethods = (response.data as any).Paymentmethods_getlist || [];
  console.log(`   Fetched ${paymentMethods.length} payment methods`);

  if (paymentMethods.length === 0) return 0;

  const methodsToInsert = paymentMethods.map((pm: any) => {
    const name = pm.name || pm.paymethod_name || "Unknown";
    const nameLower = name.toLowerCase();

    return {
      barsy_location_id: locationId,
      paymethod_id: parseInt(pm.paymethod_id || pm.id) || 0,
      name: name,
      short_name: pm.short_name || pm.paymethod_short_name || null,
      is_cash: nameLower.includes("брой") || nameLower.includes("cash") || nameLower.includes("каса"),
      is_card: nameLower.includes("карт") || nameLower.includes("card") || nameLower.includes("pos"),
      is_wallet: nameLower.includes("изход") || nameLower.includes("wallet") ||
                 nameLower.includes("кеф холдинг") || nameLower.includes("мементо оод") ||
                 nameLower.includes("по сметка"),
      is_fiscal: pm.fx === 1 || pm.fx === "1",
      is_active: pm.delete_flag !== 1 && pm.delete_flag !== "1",
      raw_data: pm,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("barsy_payment_methods")
    .upsert(methodsToInsert, {
      onConflict: "barsy_location_id,paymethod_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return 0;
  }

  console.log(`   ✅ Synced ${methodsToInsert.length} payment methods`);
  return methodsToInsert.length;
}

async function syncDepots(locationId: string, location: any) {
  console.log("🏢 Syncing depots...");

  const barsyClient = new BarsyApiClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  });

  const response = await barsyClient.getDepots();

  if (!response.success || !response.data) {
    console.log(`   ❌ Error: ${response.error}`);
    return 0;
  }

  const depots = (response.data as any).Depots_getlist || [];
  console.log(`   Fetched ${depots.length} depots`);

  if (depots.length === 0) return 0;

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

  const { error } = await supabase
    .from("barsy_depots")
    .upsert(depotsToInsert, {
      onConflict: "barsy_location_id,depot_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return 0;
  }

  console.log(`   ✅ Synced ${depotsToInsert.length} depots`);
  return depotsToInsert.length;
}

async function syncTaxGroups(locationId: string, location: any) {
  console.log("📊 Syncing tax groups...");

  const barsyClient = new BarsyApiClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  });

  const response = await barsyClient.getTaxGroups();

  if (!response.success || !response.data) {
    console.log(`   ❌ Error: ${response.error}`);
    return 0;
  }

  const taxGroups = (response.data as any).Taxgroups_getlist || [];
  console.log(`   Fetched ${taxGroups.length} tax groups`);

  if (taxGroups.length === 0) return 0;

  const taxGroupsToInsert = taxGroups.map((tg: any) => ({
    barsy_location_id: locationId,
    tax_group_id: parseInt(tg.tax_group_id || tg.id) || 0,
    name: tg.name || tg.tax_group_name || "Unknown",
    tax_rate: tg.tax ? parseFloat(tg.tax) : null,
    is_default: tg.is_default === 1 || tg.is_default === "1",
    raw_data: tg,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("barsy_tax_groups_ref")
    .upsert(taxGroupsToInsert, {
      onConflict: "barsy_location_id,tax_group_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return 0;
  }

  console.log(`   ✅ Synced ${taxGroupsToInsert.length} tax groups`);
  return taxGroupsToInsert.length;
}

async function syncPlaces(locationId: string, location: any) {
  console.log("🪑 Syncing places...");

  const barsyClient = new BarsyApiClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  });

  const response = await barsyClient.getPlaces();

  if (!response.success || !response.data) {
    console.log(`   ❌ Error: ${response.error}`);
    return 0;
  }

  const places = (response.data as any).Places_getlist || [];
  console.log(`   Fetched ${places.length} places`);

  if (places.length === 0) return 0;

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

  const { error } = await supabase
    .from("barsy_places")
    .upsert(placesToInsert, {
      onConflict: "barsy_location_id,place_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return 0;
  }

  console.log(`   ✅ Synced ${placesToInsert.length} places`);
  return placesToInsert.length;
}

async function syncStoreOuts(locationId: string, location: any) {
  console.log("📤 Syncing store outs...");

  const barsyClient = new BarsyApiClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  });

  const storeOutsResponse = await barsyClient.getAllStoreOuts(dateFrom, dateTo);

  if (!storeOutsResponse.success || !storeOutsResponse.data) {
    console.log(`   ❌ Error: ${storeOutsResponse.error}`);
    return 0;
  }

  const storeOutsRaw = (storeOutsResponse.data as any).Storeouts_getlist;
  const storeOuts = Array.isArray(storeOutsRaw) ? storeOutsRaw : [];
  console.log(`   Fetched ${storeOuts.length} store outs`);

  if (storeOuts.length === 0) return 0;

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

    // Extract details with cost data
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

  // Deduplicate store outs
  const storeOutsMap = new Map();
  storeOutsMapped.forEach((so) => {
    storeOutsMap.set(`${so.location_id}-${so.barsy_store_out_id}`, so);
  });
  const storeOutsToInsert = Array.from(storeOutsMap.values());

  const { error: storeOutsError } = await supabase
    .from("barsy_store_outs")
    .upsert(storeOutsToInsert, {
      onConflict: "location_id,barsy_store_out_id",
      ignoreDuplicates: false,
    });

  if (storeOutsError) {
    console.log(`   ❌ Store outs error: ${storeOutsError.message}`);
  } else {
    console.log(`   ✅ Synced ${storeOutsToInsert.length} store outs`);
  }

  // Insert details
  if (allDetails.length > 0) {
    const detailsMap = new Map();
    allDetails.forEach((d) => {
      detailsMap.set(`${d.location_id}-${d.barsy_store_out_id}-${d.barsy_article_id}`, d);
    });
    const detailsToInsert = Array.from(detailsMap.values());

    const { error: detailsError } = await supabase
      .from("barsy_store_out_details")
      .upsert(detailsToInsert, {
        onConflict: "location_id,barsy_store_out_id,barsy_article_id",
        ignoreDuplicates: false,
      });

    if (detailsError) {
      console.log(`   ❌ Details error: ${detailsError.message}`);
    } else {
      const withCosts = detailsToInsert.filter((d) => d.avg_delivery_price !== null).length;
      console.log(`   ✅ Synced ${detailsToInsert.length} store out details (${withCosts} with cost data)`);
    }
  }

  return storeOutsToInsert.length;
}

async function updateTransactionLineCosts() {
  console.log("\n💰 Updating transaction line item costs...");

  const { error } = await supabase.rpc("execute_sql", {
    query: `
      UPDATE transaction_line_items tli
      SET cost_price = ba.avg_delivery_price
      FROM barsy_articles ba
      WHERE tli.barsy_article_id = ba.barsy_article_id
        AND tli.cost_price IS NULL
        AND ba.avg_delivery_price IS NOT NULL
    `,
  });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
  } else {
    console.log(`   ✅ Updated transaction line items with cost prices`);
  }
}

async function runSync() {
  console.log("🚀 Starting full sync...");
  console.log(`📅 Date range: ${dateFrom} to ${dateTo}`);
  console.log("");

  for (const [name, locationId] of Object.entries(LOCATIONS)) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📍 Syncing ${name.toUpperCase()} (${locationId})`);
    console.log("=".repeat(60));

    // Get location config
    const { data: location, error: locError } = await supabase
      .from("barsy_locations")
      .select("*")
      .eq("id", locationId)
      .single();

    if (locError || !location) {
      console.log(`   ❌ Location not found: ${locError?.message}`);
      continue;
    }

    console.log(`   Barsy URL: ${location.barsy_url}`);
    console.log("");

    // Sync all data types
    await syncPaymentMethods(locationId, location);
    await syncTaxGroups(locationId, location);
    await syncDepots(locationId, location);
    await syncPlaces(locationId, location);
    await syncArticles(locationId, location);
    await syncStoreOuts(locationId, location);
  }

  // Update transaction costs
  await updateTransactionLineCosts();

  console.log("\n\n✅ Full sync complete!");
}

runSync().catch(console.error);
