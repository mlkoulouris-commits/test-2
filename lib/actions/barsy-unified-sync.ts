'use server';

/**
 * Barsy Unified Sync Service
 *
 * Optimized sync service that:
 * 1. Uses batched API calls where possible
 * 2. Runs independent syncs in parallel
 * 3. Respects dependencies between sync types
 * 4. Provides progress tracking
 */

import { createClient } from '@/lib/supabase/server';
import { createBarsyClient, BarsyApiClient } from '@/lib/services/barsy-api';
import {
  SyncType,
  SyncResult,
  SYNC_TYPES,
  BatchSyncConfig,
} from '@/lib/types/barsy-sync';

// Import existing sync functions
import { syncBarsySuppliers, syncBarsyDepots, syncBarsyPlaces, syncBarsyPoses, syncBarsyPaymentMethods, syncBarsyTaxGroups } from './barsy-master-data-sync';
import { syncBarsyStoreLoads } from './barsy-storeloads-sync';
import { syncBarsyStoreOuts, syncBarsyStoreAmounts } from './barsy-storeouts-sync';
import { syncBarsyPayments } from './barsy-payments-sync';
import { syncBarsyAccounts } from './barsy-accounts-sync';
import { syncBarsyClients } from './barsy-clients-sync';
import { syncBarsyRecipes } from './barsy-recipes-sync';
import { syncBarsyTransactions } from './barsy-transactions-sync';
import { syncBarsyArticles, syncBarsyUsers, syncBarsyCategories, syncBarsyOrders } from './barsy-sync';

interface BarsyLocation {
  id: string;
  name: string;
  barsy_url: string;
  username: string;
  password_encrypted: string;
  memento_location_id: number;
}

/**
 * Get Barsy location with caching
 */
const getLocation = async (locationId: string): Promise<BarsyLocation | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('barsy_locations')
    .select('*')
    .eq('id', locationId)
    .single();
  return data;
};

/**
 * Execute a single sync type
 */
export const executeSyncType = async (
  syncType: SyncType,
  locationId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<SyncResult> => {
  const startTime = Date.now();

  try {
    const location = await getLocation(locationId);
    if (!location) {
      return {
        success: false,
        syncType,
        error: 'Location not found',
        durationMs: Date.now() - startTime,
      };
    }

    let result: any;

    switch (syncType) {
      // Reference Data
      case 'payment_methods':
        result = await syncBarsyPaymentMethods(locationId);
        break;
      case 'tax_groups':
        result = await syncBarsyTaxGroups(locationId);
        break;
      case 'currencies':
        // Currencies are fetched with reference data batch
        result = await syncCurrencies(locationId);
        break;
      case 'depots':
        result = await syncBarsyDepots(locationId);
        break;
      case 'poses':
        result = await syncBarsyPoses(locationId);
        break;
      case 'places':
        result = await syncBarsyPlaces(locationId);
        break;

      // Catalog Data
      case 'categories':
        result = await syncBarsyCategories(locationId);
        break;
      case 'articles':
        result = await syncBarsyArticles(locationId);
        break;
      case 'suppliers':
        result = await syncBarsySuppliers(locationId);
        break;
      case 'clients':
        result = await syncBarsyClients(locationId);
        break;

      // Production Data
      case 'users':
        result = await syncBarsyUsers(locationId);
        break;
      case 'recipes':
        result = await syncBarsyRecipes(locationId);
        break;

      // Inventory Operations
      case 'store_loads':
        if (!dateFrom || !dateTo) {
          return {
            success: false,
            syncType,
            error: 'Date range required for store loads',
            durationMs: Date.now() - startTime,
          };
        }
        result = await syncBarsyStoreLoads(locationId, dateFrom, dateTo);
        break;
      case 'store_outs':
        if (!dateFrom || !dateTo) {
          return {
            success: false,
            syncType,
            error: 'Date range required for store outs',
            durationMs: Date.now() - startTime,
          };
        }
        result = await syncBarsyStoreOuts(locationId, dateFrom, dateTo);
        break;
      case 'store_amounts':
        result = await syncBarsyStoreAmounts(locationId);
        break;

      // Sales Operations
      case 'orders':
        if (!dateFrom || !dateTo) {
          return {
            success: false,
            syncType,
            error: 'Date range required for orders',
            durationMs: Date.now() - startTime,
          };
        }
        result = await syncBarsyOrders(locationId, dateFrom, dateTo);
        break;
      case 'accounts':
        if (!dateFrom || !dateTo) {
          return {
            success: false,
            syncType,
            error: 'Date range required for accounts',
            durationMs: Date.now() - startTime,
          };
        }
        result = await syncBarsyAccounts(dateFrom, dateTo);
        break;
      case 'payments':
        if (!dateFrom || !dateTo) {
          return {
            success: false,
            syncType,
            error: 'Date range required for payments',
            durationMs: Date.now() - startTime,
          };
        }
        result = await syncBarsyPayments(locationId, dateFrom, dateTo);
        break;
      case 'transactions':
        if (!dateFrom || !dateTo) {
          return {
            success: false,
            syncType,
            error: 'Date range required for transactions',
            durationMs: Date.now() - startTime,
          };
        }
        if (!location.memento_location_id) {
          return {
            success: false,
            syncType,
            error: 'Location not mapped to Memento',
            durationMs: Date.now() - startTime,
          };
        }
        result = await syncBarsyTransactions(locationId, location.memento_location_id, dateFrom, dateTo);
        break;

      default:
        return {
          success: false,
          syncType,
          error: `Unknown sync type: ${syncType}`,
          durationMs: Date.now() - startTime,
        };
    }

    const recordsSynced = result.recordsSynced ?? result.count ?? 0;

    return {
      success: result.success !== false && !result.error,
      syncType,
      recordsSynced,
      error: result.error,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      syncType,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    };
  }
};

/**
 * Sync currencies (not in existing actions)
 */
const syncCurrencies = async (locationId: string) => {
  const supabase = await createClient();
  const location = await getLocation(locationId);

  if (!location) {
    return { error: 'Location not found' };
  }

  const client = createBarsyClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  });

  const response = await client.getCurrencies();

  if (!response.success || !response.data) {
    return { error: response.error || 'Failed to fetch currencies' };
  }

  const currencies = (response.data as any).Currencies_getlist || [];

  // Store in a generic reference data table or log
  console.log(`Fetched ${currencies.length} currencies`);

  return { success: true, count: currencies.length };
};

/**
 * OPTIMIZED: Sync all reference data in a single batched API call
 * Uses Barsy's multi-method request capability
 */
export const syncAllReferenceDataBatched = async (locationId: string): Promise<SyncResult[]> => {
  const startTime = Date.now();
  const results: SyncResult[] = [];

  try {
    const location = await getLocation(locationId);
    if (!location) {
      return [{
        success: false,
        syncType: 'payment_methods',
        error: 'Location not found',
        durationMs: Date.now() - startTime,
      }];
    }

    const client = createBarsyClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Fetch ALL reference data in a single HTTP request
    console.log('📦 Fetching all reference data in single batched request...');
    const batchResponse = await client.getAllReferenceData();

    if (!batchResponse.success || !batchResponse.data) {
      return [{
        success: false,
        syncType: 'payment_methods',
        error: batchResponse.error || 'Batch request failed',
        durationMs: Date.now() - startTime,
      }];
    }

    const data = batchResponse.data;
    const supabase = await createClient();

    // Process each data type from the batch response
    // Payment Methods
    const paymentMethods = data.Paymentmethods_getlist || [];
    if (paymentMethods.length > 0) {
      const records = paymentMethods.map((m: any) => ({
        barsy_location_id: locationId,
        paymethod_id: m.paymethod_id,
        paymethod_name: m.paymethod_name || m.name,
        paymethod_type: m.paymethod_type,
        is_active: m.is_active ?? true,
        raw_data: m,
        updated_at: new Date().toISOString(),
      }));

      await supabase.from('barsy_payment_methods').upsert(records, {
        onConflict: 'barsy_location_id,paymethod_id',
      });

      results.push({
        success: true,
        syncType: 'payment_methods',
        recordsSynced: records.length,
        durationMs: Date.now() - startTime,
      });
    }

    // Tax Groups
    const taxGroups = data.Taxgroups_getlist || [];
    if (taxGroups.length > 0) {
      const records = taxGroups.map((t: any) => ({
        barsy_location_id: locationId,
        tax_group_id: t.tax_group_id,
        tax_group_name: t.tax_group_name || t.name,
        tax_rate: t.tax_rate,
        is_default: t.is_default ?? false,
        raw_data: t,
        updated_at: new Date().toISOString(),
      }));

      await supabase.from('barsy_tax_groups').upsert(records, {
        onConflict: 'barsy_location_id,tax_group_id',
      });

      results.push({
        success: true,
        syncType: 'tax_groups',
        recordsSynced: records.length,
        durationMs: Date.now() - startTime,
      });
    }

    // Depots
    const depots = data.Depots_getlist || [];
    if (depots.length > 0) {
      const records = depots.map((d: any) => ({
        barsy_location_id: locationId,
        depot_id: d.depot_id,
        depot_name: d.depot_name || d.name,
        barsy_id: d.barsy_id,
        is_active: d.is_active ?? true,
        is_default: d.is_default ?? false,
        description: d.description,
        raw_data: d,
        updated_at: new Date().toISOString(),
      }));

      await supabase.from('barsy_depots').upsert(records, {
        onConflict: 'barsy_location_id,depot_id',
      });

      results.push({
        success: true,
        syncType: 'depots',
        recordsSynced: records.length,
        durationMs: Date.now() - startTime,
      });
    }

    // Places
    const places = data.Places_getlist || [];
    if (places.length > 0) {
      const records = places.map((p: any) => ({
        barsy_location_id: locationId,
        place_id: p.place_id,
        place_name: p.place_name || p.name,
        place_number: p.place_number,
        barsy_id: p.barsy_id,
        place_type: p.place_type,
        capacity: p.capacity,
        is_active: p.is_active ?? true,
        raw_data: p,
        updated_at: new Date().toISOString(),
      }));

      await supabase.from('barsy_places').upsert(records, {
        onConflict: 'barsy_location_id,place_id',
      });

      results.push({
        success: true,
        syncType: 'places',
        recordsSynced: records.length,
        durationMs: Date.now() - startTime,
      });
    }

    // POSes
    const poses = data.Poses_getlist || [];
    if (poses.length > 0) {
      const records = poses.map((p: any) => ({
        barsy_location_id: locationId,
        pos_id: p.pos_id,
        pos_name: p.pos_name || p.name,
        barsy_id: p.barsy_id,
        device_id: p.device_id,
        is_active: p.is_active ?? true,
        is_fiscal: p.is_fiscal ?? false,
        raw_data: p,
        updated_at: new Date().toISOString(),
      }));

      await supabase.from('barsy_poses').upsert(records, {
        onConflict: 'barsy_location_id,pos_id',
      });

      results.push({
        success: true,
        syncType: 'poses',
        recordsSynced: records.length,
        durationMs: Date.now() - startTime,
      });
    }

    // Suppliers
    const suppliers = data.Suppliers_getlist || [];
    if (suppliers.length > 0) {
      // Get memento location ID for the location
      const { data: locationData } = await supabase
        .from('barsy_locations')
        .select('memento_location_id')
        .eq('id', locationId)
        .single();

      const records = suppliers.map((s: any) => ({
        barsy_location_id: locationId,
        location_id: locationData?.memento_location_id,
        supplier_id: s.supplier_id,
        supplier_name: s.supplier_name || s.name,
        bulstat: s.bulstat,
        vat_number: s.vat_number,
        address: s.address,
        city: s.city,
        phone: s.phone,
        email: s.email,
        contact_person: s.contact_person,
        is_active: s.is_active ?? true,
        raw_data: s,
        updated_at: new Date().toISOString(),
      }));

      await supabase.from('barsy_suppliers').upsert(records, {
        onConflict: 'barsy_location_id,supplier_id',
      });

      results.push({
        success: true,
        syncType: 'suppliers',
        recordsSynced: records.length,
        durationMs: Date.now() - startTime,
      });
    }

    // Currencies (just log, no table)
    const currencies = data.Currencies_getlist || [];
    results.push({
      success: true,
      syncType: 'currencies',
      recordsSynced: currencies.length,
      durationMs: Date.now() - startTime,
    });

    const totalDuration = Date.now() - startTime;
    const totalRecords = results.reduce((sum, r) => sum + (r.recordsSynced || 0), 0);
    console.log(`✅ Batched reference data sync complete in ${totalDuration}ms. Total: ${totalRecords} records.`);

    return results;
  } catch (error) {
    return [{
      success: false,
      syncType: 'payment_methods',
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    }];
  }
};

/**
 * OPTIMIZED: Sync categories and users in a single batched request
 */
export const syncCategoriesAndUsersBatched = async (locationId: string): Promise<SyncResult[]> => {
  const startTime = Date.now();
  const results: SyncResult[] = [];

  try {
    const location = await getLocation(locationId);
    if (!location) {
      return [{
        success: false,
        syncType: 'categories',
        error: 'Location not found',
        durationMs: Date.now() - startTime,
      }];
    }

    const client = createBarsyClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    console.log('📦 Fetching categories and users in single batched request...');
    const batchResponse = await client.getCategoriesAndUsers();

    if (!batchResponse.success || !batchResponse.data) {
      return [{
        success: false,
        syncType: 'categories',
        error: batchResponse.error || 'Batch request failed',
        durationMs: Date.now() - startTime,
      }];
    }

    const data = batchResponse.data;
    const supabase = await createClient();

    // Categories
    const categories = data.Categories_getlist || [];
    if (categories.length > 0) {
      const records = categories.map((cat: any) => ({
        location_id: locationId,
        barsy_cat_id: parseInt(cat.cat_id) || 0,
        cat_name: cat.cat_name || 'Unknown',
        cat_path: cat.cat_path || null,
        parent_id: cat.parent_id ? parseInt(cat.parent_id) : null,
        raw_data: cat,
      }));

      await supabase.from('barsy_categories').upsert(records, {
        onConflict: 'location_id,barsy_cat_id',
      });

      results.push({
        success: true,
        syncType: 'categories',
        recordsSynced: records.length,
        durationMs: Date.now() - startTime,
      });
    }

    // Users
    const users = data.Users_getlist || [];
    if (users.length > 0) {
      const records = users.map((user: any) => ({
        location_id: locationId,
        barsy_user_id: parseInt(user.user_id) || 0,
        username: user.user_name || user.username || 'unknown',
        first_name: user.fname || user.first_name || null,
        last_name: user.lname || user.last_name || null,
        email: user.email || null,
        phone: user.phone || null,
        role_id: user.role_id ? parseInt(user.role_id) : null,
        role_name: user.role_name || null,
        is_active: user.delete_flag !== 1 && user.delete_flag !== '1',
        raw_data: user,
        synced_at: new Date().toISOString(),
      }));

      await supabase.from('barsy_staff').upsert(records, {
        onConflict: 'location_id,barsy_user_id',
      });

      results.push({
        success: true,
        syncType: 'users',
        recordsSynced: records.length,
        durationMs: Date.now() - startTime,
      });
    }

    const totalDuration = Date.now() - startTime;
    console.log(`✅ Categories and users sync complete in ${totalDuration}ms.`);

    return results;
  } catch (error) {
    return [{
      success: false,
      syncType: 'categories',
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    }];
  }
};

/**
 * Execute batch sync with parallel execution where possible
 */
export const executeBatchSync = async (config: BatchSyncConfig, locationId: string): Promise<SyncResult[]> => {
  const { syncTypes, dateFrom, dateTo, parallel = true } = config;
  const results: SyncResult[] = [];

  // Group sync types by their dependencies
  const phases = buildExecutionPhases(syncTypes);

  for (const phase of phases) {
    if (parallel && phase.length > 1) {
      // Execute phase in parallel
      const phaseResults = await Promise.all(
        phase.map((syncType) => executeSyncType(syncType, locationId, dateFrom, dateTo))
      );
      results.push(...phaseResults);
    } else {
      // Execute sequentially
      for (const syncType of phase) {
        const result = await executeSyncType(syncType, locationId, dateFrom, dateTo);
        results.push(result);
      }
    }
  }

  return results;
};

/**
 * Build execution phases based on dependencies
 * Returns array of phases, each phase contains sync types that can run in parallel
 */
const buildExecutionPhases = (syncTypes: SyncType[]): SyncType[][] => {
  const phases: SyncType[][] = [];
  const executed = new Set<SyncType>();

  while (executed.size < syncTypes.length) {
    const phase: SyncType[] = [];

    for (const syncType of syncTypes) {
      if (executed.has(syncType)) continue;

      const config = SYNC_TYPES[syncType];
      const dependencies = config.dependencies || [];

      // Check if all dependencies are satisfied
      const dependenciesMet = dependencies.every(
        (dep) => !syncTypes.includes(dep) || executed.has(dep)
      );

      if (dependenciesMet) {
        phase.push(syncType);
      }
    }

    if (phase.length === 0) {
      // Circular dependency or missing dependency, force execute remaining
      const remaining = syncTypes.filter((t) => !executed.has(t));
      phases.push(remaining);
      break;
    }

    phases.push(phase);
    phase.forEach((t) => executed.add(t));
  }

  return phases;
};
