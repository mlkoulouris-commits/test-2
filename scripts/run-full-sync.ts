/**
 * Full sync script for Memento locations
 * Run with: npx tsx scripts/run-full-sync.ts
 */

import { syncBarsyArticles } from "../lib/actions/barsy-articles-sync";
import { syncBarsyAccounts } from "../lib/actions/barsy-accounts-sync";
import { syncAllBarsyReferenceData } from "../lib/actions/barsy-reference-data-sync";
import { syncBarsyStoreOuts } from "../lib/actions/barsy-storeouts-sync";

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

async function runSync() {
  console.log("🚀 Starting full sync...");
  console.log(`📅 Date range: ${dateFrom} to ${dateTo}`);
  console.log("");

  for (const [name, locationId] of Object.entries(LOCATIONS)) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📍 Syncing ${name.toUpperCase()} (${locationId})`);
    console.log("=".repeat(60));

    // 1. Reference data (payment methods, depots, places, tax groups)
    console.log("\n🔧 Syncing reference data...");
    const refResult = await syncAllBarsyReferenceData(locationId);
    console.log(`   Payment Methods: ${refResult.results.paymentMethods?.recordsSynced || 0}`);
    console.log(`   Tax Groups: ${refResult.results.taxGroups?.recordsSynced || 0}`);
    console.log(`   Depots: ${refResult.results.depots?.recordsSynced || 0}`);
    console.log(`   Places: ${refResult.results.places?.recordsSynced || 0}`);

    // 2. Articles (products with cost data)
    console.log("\n📦 Syncing articles...");
    const articlesResult = await syncBarsyArticles(locationId);
    if (articlesResult.success) {
      console.log(`   ✅ Synced ${articlesResult.recordsSynced} articles`);
    } else {
      console.log(`   ❌ Error: ${articlesResult.error}`);
    }

    // 3. Store outs (inventory write-offs with costs)
    console.log("\n📤 Syncing store outs...");
    const storeOutsResult = await syncBarsyStoreOuts(locationId, dateFrom, dateTo);
    if (storeOutsResult.success) {
      console.log(`   ✅ Synced ${storeOutsResult.recordsSynced} store outs`);
    } else {
      console.log(`   ❌ Error: ${storeOutsResult.error}`);
    }
  }

  // 4. Accounts (bills with payment methods) - runs for all locations
  console.log("\n\n📋 Syncing accounts (all locations)...");
  const accountsResult = await syncBarsyAccounts(dateFrom, dateTo);
  if (accountsResult.success) {
    console.log(`   ✅ Synced ${accountsResult.synced} accounts`);
  } else {
    console.log(`   ❌ Errors: ${accountsResult.errors}`);
  }

  console.log("\n\n✅ Full sync complete!");
}

runSync().catch(console.error);
