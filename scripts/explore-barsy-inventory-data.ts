/**
 * Exploration script to inspect Barsy inventory data structure
 * Run with: npx tsx explore-barsy-inventory-data.ts
 */

import { BarsyApiClient } from "../lib/services/barsy-api";
import { createClient } from "../lib/supabase/server";

async function exploreBarsyData() {
  const supabase = await createClient();

  console.log("=".repeat(80));
  console.log("EXPLORING BARSY INVENTORY DATA STRUCTURE");
  console.log("=".repeat(80));

  // 1. Check what's in barsy_store_amounts (current inventory)
  console.log("\n1. CURRENT INVENTORY (barsy_store_amounts)");
  console.log("-".repeat(80));
  const { data: storeAmounts, error: saError } = await supabase
    .from("barsy_store_amounts")
    .select("*")
    .limit(3);

  if (saError) {
    console.error("Error fetching store amounts:", saError);
  } else if (storeAmounts && storeAmounts.length > 0) {
    console.log(`Found ${storeAmounts.length} sample records`);
    console.log("\nSample record structure:");
    console.log(JSON.stringify(storeAmounts[0], null, 2));

    if (storeAmounts[0].raw_data) {
      console.log("\nRaw Barsy API response structure:");
      console.log(JSON.stringify(storeAmounts[0].raw_data, null, 2));
    }
  } else {
    console.log("No store amounts found. Sync inventory first.");
  }

  // 2. Check what's in barsy_store_load_items (purchases)
  console.log("\n\n2. STORE LOAD ITEMS (barsy_store_load_items)");
  console.log("-".repeat(80));
  const { data: loadItems, error: liError } = await supabase
    .from("barsy_store_load_items")
    .select("*, barsy_store_loads(doc_date, doc_num, supplier_name)")
    .limit(3);

  if (liError) {
    console.error("Error fetching load items:", liError);
  } else if (loadItems && loadItems.length > 0) {
    console.log(`Found ${loadItems.length} sample records`);
    console.log("\nSample record structure:");
    console.log(JSON.stringify(loadItems[0], null, 2));

    if (loadItems[0].raw_data) {
      console.log("\nRaw Barsy API response structure:");
      console.log(JSON.stringify(loadItems[0].raw_data, null, 2));
    }
  } else {
    console.log("No store load items found. Sync store loads first.");
  }

  // 3. Check what's in barsy_store_outs (write-offs)
  console.log("\n\n3. STORE OUTS (barsy_store_outs)");
  console.log("-".repeat(80));
  const { data: storeOuts, error: soError } = await supabase
    .from("barsy_store_outs")
    .select("*")
    .limit(3);

  if (soError) {
    console.error("Error fetching store outs:", soError);
  } else if (storeOuts && storeOuts.length > 0) {
    console.log(`Found ${storeOuts.length} sample records`);
    console.log("\nSample record structure:");
    console.log(JSON.stringify(storeOuts[0], null, 2));

    if (storeOuts[0].raw_data) {
      console.log("\nRaw Barsy API response structure:");
      console.log(JSON.stringify(storeOuts[0].raw_data, null, 2));
    }
  } else {
    console.log("No store outs found. Sync store outs first.");
  }

  // 4. Test API call for historical inventory (if we have a location)
  console.log("\n\n4. TESTING BARSY API - Store Amounts By Date");
  console.log("-".repeat(80));
  const { data: locations } = await supabase
    .from("barsy_locations")
    .select("id, name, barsy_url, username, password_encrypted")
    .limit(1);

  if (locations && locations.length > 0) {
    const location = locations[0];
    console.log(`Testing with location: ${location.name}`);

    try {
      const barsyClient = new BarsyApiClient({
        baseUrl: location.barsy_url,
        username: location.username,
        password: location.password_encrypted,
      });

      // Test current inventory
      console.log("\nFetching current inventory (Store_amounts)...");
      const currentResponse = await barsyClient.getStoreAmounts();
      if (currentResponse.success && currentResponse.data) {
        const currentData = (currentResponse.data as any).Store_amounts;
        if (Array.isArray(currentData) && currentData.length > 0) {
          console.log(`✅ Got ${currentData.length} items`);
          console.log("\nSample API response structure:");
          console.log(JSON.stringify(currentData[0], null, 2));
        } else {
          console.log("⚠️  API returned empty array or unexpected format");
          console.log(
            "Response:",
            JSON.stringify(currentResponse.data, null, 2)
          );
        }
      } else {
        console.error("❌ API call failed:", currentResponse.error);
      }

      // Test historical inventory (yesterday)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split("T")[0];

      console.log(
        `\nFetching historical inventory for ${dateStr} (Store_amounts_by_date)...`
      );
      const historicalResponse = await barsyClient.getStoreAmountsByDate(
        dateStr
      );
      if (historicalResponse.success && historicalResponse.data) {
        const historicalData = (historicalResponse.data as any)
          .Store_amounts_by_date;
        if (Array.isArray(historicalData) && historicalData.length > 0) {
          console.log(`✅ Got ${historicalData.length} items`);
          console.log("\nSample API response structure:");
          console.log(JSON.stringify(historicalData[0], null, 2));
        } else {
          console.log("⚠️  API returned empty array or unexpected format");
          console.log(
            "Response:",
            JSON.stringify(historicalResponse.data, null, 2)
          );
        }
      } else {
        console.error("❌ API call failed:", historicalResponse.error);
      }
    } catch (error) {
      console.error("Error calling Barsy API:", error);
    }
  } else {
    console.log("No Barsy locations configured. Cannot test API.");
  }

  // 5. Summary of available fields
  console.log("\n\n5. FIELD SUMMARY");
  console.log("-".repeat(80));
  console.log("\nExpected fields from Barsy API:");
  console.log("\nStore_amounts / Store_amounts_by_date:");
  console.log("  - article_id (integer)");
  console.log("  - article_name (string)");
  console.log("  - amount (quantity, numeric)");
  console.log("  - amount_unit (string)");
  console.log("  - depot_id (integer, nullable)");
  console.log("  - depot_name (string, nullable)");
  console.log("  - cost_price (numeric, nullable)");
  console.log("  - total_value (numeric, nullable)");

  console.log("\nStore_load_items:");
  console.log("  - article_id (integer)");
  console.log("  - article_name (string)");
  console.log("  - quantity / amount (numeric)");
  console.log("  - unit_price / delivery_price / current_price (numeric)");
  console.log("  - total_price (numeric)");

  console.log("\nStore_outs:");
  console.log("  - article_id (integer)");
  console.log("  - article_name (string)");
  console.log("  - amount (quantity, numeric)");
  console.log("  - amount_unit (string)");
  console.log("  - depot_id (integer)");
  console.log("  - reason_id, reason_name");
  console.log("  - ref_date / date (date)");

  console.log("\n" + "=".repeat(80));
  console.log("EXPLORATION COMPLETE");
  console.log("=".repeat(80));
}

exploreBarsyData().catch(console.error);
