'use server';

import { createClient } from '@/lib/supabase/server';
import { BarsyApiClient } from '@/lib/services/barsy-api';

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

export async function syncBarsyCategories(locationId: string): Promise<SyncResult> {
  try {
    const supabase = await createClient();

    // Get location configuration
    const { data: location, error: locationError } = await supabase
      .from('barsy_locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (locationError || !location) {
      return {
        success: false,
        error: `Failed to fetch location: ${locationError?.message || 'Not found'}`,
      };
    }

    console.log(`Syncing categories for location: ${location.name}`);

    // Initialize Barsy API client
    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Fetch categories (use flat list for simplicity)
    console.log('Fetching categories from Barsy API...');
    const categoriesResponse = await barsyClient.getCategories(false);

    if (!categoriesResponse.success || !categoriesResponse.data) {
      const error = categoriesResponse.error || 'Failed to fetch categories';
      await logSyncError(locationId, 'categories', error, supabase);
      return {
        success: false,
        error,
      };
    }

    const allCategories = (categoriesResponse.data as any).Categories_getlist || [];
    console.log(`Fetched ${allCategories.length} categories from Barsy API`);

    if (allCategories.length === 0) {
      console.log('No categories found');
      await logSync(locationId, 'categories', 0, supabase);
      return {
        success: true,
        recordsSynced: 0,
      };
    }

    // Transform and prepare categories for insertion
    const categoriesToInsert = allCategories.map((category: any) => ({
      location_id: locationId,
      barsy_category_id: parseInt(category.cat_id) || 0,
      category_name: category.cat_name || 'Unknown',
      parent_id: category.parent_id ? parseInt(category.parent_id) : null,
      sort_order: category.sort_order ? parseInt(category.sort_order) : null,
      is_active: category.is_active !== '0' && category.is_active !== false,
      is_visible: category.is_visible !== '0' && category.is_visible !== false,
      color: category.color || null,
      icon: category.icon || null,
      raw_data: category,
      synced_at: new Date().toISOString(),
    }));

    console.log(`Inserting ${categoriesToInsert.length} categories into database...`);

    // Upsert categories
    const { error: insertError } = await supabase
      .from('barsy_categories')
      .upsert(categoriesToInsert, {
        onConflict: 'location_id,barsy_category_id',
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      await logSyncError(locationId, 'categories', insertError.message, supabase);
      return {
        success: false,
        error: `Failed to insert categories: ${insertError.message}`,
      };
    }

    console.log(`Successfully synced ${categoriesToInsert.length} categories`);

    // Log successful sync
    await logSync(locationId, 'categories', categoriesToInsert.length, supabase);

    return {
      success: true,
      recordsSynced: categoriesToInsert.length,
    };
  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      const supabase = await createClient();
      await logSyncError(locationId, 'categories', errorMessage, supabase);
    } catch (logError) {
      console.error('Failed to log error:', logError);
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
  await supabase.from('barsy_sync_log').insert({
    location_id: locationId,
    sync_type: syncType,
    records_synced: recordsSynced,
    success: true,
  });
}

async function logSyncError(
  locationId: string,
  syncType: string,
  errorMessage: string,
  supabase: any
) {
  await supabase.from('barsy_sync_log').insert({
    location_id: locationId,
    sync_type: syncType,
    records_synced: 0,
    success: false,
    error_message: errorMessage,
  });
}

