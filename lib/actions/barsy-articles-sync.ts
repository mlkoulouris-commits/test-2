'use server';

import { createClient } from '@/lib/supabase/server';
import { BarsyApiClient } from '@/lib/services/barsy-api';

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

export async function syncBarsyArticles(locationId: string): Promise<SyncResult> {
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

    console.log(`Syncing articles for location: ${location.name}`);

    // Initialize Barsy API client
    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted, // Note: should decrypt if encrypted
    });

    // Fetch ALL articles (handles pagination automatically)
    console.log('Fetching articles from Barsy API...');
    const articlesResponse = await barsyClient.getAllArticles({});

    if (!articlesResponse.success || !articlesResponse.data) {
      const error = articlesResponse.error || 'Failed to fetch articles';
      await logSyncError(locationId, 'articles', error, supabase);
      return {
        success: false,
        error,
      };
    }

    const allArticles = (articlesResponse.data as any).Articles_getlist || [];
    console.log(`Fetched ${allArticles.length} total articles from Barsy API`);

    if (allArticles.length === 0) {
      console.log('No articles found');
      await logSync(locationId, 'articles', 0, supabase);
      return {
        success: true,
        recordsSynced: 0,
      };
    }

    // Transform and prepare articles for insertion
    const articlesToInsert = allArticles.map((article: any) => {
      // Check if article has a recipe (recipe_description is non-empty)
      const recipeDescription = article.recipe_description || null;
      const hasRecipe = !!recipeDescription && recipeDescription.trim() !== '';
      
      return {
        location_id: locationId,
        barsy_article_id: parseInt(article.article_id) || 0,
        article_name: article.article_name || 'Unknown',
        article_name_public: article.article_name_public || article.article_name,
        barcode: article.barcode || null,
        price: article.price ? parseFloat(article.price) : null,
        cost_price: article.cost_price ? parseFloat(article.cost_price) : null,
        // Cost price fields for COGS calculation
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
        is_active: article.delete_flag !== 1 && article.delete_flag !== '1',
        is_for_sale: article.is_for_sale === 1 || article.is_for_sale === '1' || article.is_for_sale === true,
        is_semifinished: article.is_semifinished === '1' || article.is_semifinished === true,
        sort_order: article.sort_order ? parseInt(article.sort_order) : null,
        description: article.description || null,
        delete_flag: article.delete_flag === 1 || article.delete_flag === '1',
        last_update: article.last_update || null,
        // Recipe fields for efficient recipe syncing
        recipe_description: recipeDescription,
        has_recipe: hasRecipe,
        raw_data: article,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    console.log(`Inserting ${articlesToInsert.length} articles into database...`);

    // Upsert articles (insert or update on conflict)
    const { error: insertError } = await supabase
      .from('barsy_articles')
      .upsert(articlesToInsert, {
        onConflict: 'location_id,barsy_article_id',
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      await logSyncError(locationId, 'articles', insertError.message, supabase);
      return {
        success: false,
        error: `Failed to insert articles: ${insertError.message}`,
      };
    }

    console.log(`Successfully synced ${articlesToInsert.length} articles`);

    // Log successful sync
    await logSync(locationId, 'articles', articlesToInsert.length, supabase);

    return {
      success: true,
      recordsSynced: articlesToInsert.length,
    };
  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    try {
      const supabase = await createClient();
      await logSyncError(locationId, 'articles', errorMessage, supabase);
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

/**
 * OPTIMIZED: Incremental sync - only fetches articles changed since last sync
 * Uses Barsy's last_update filter for ~10-100x faster delta syncs
 */
export async function syncBarsyArticlesIncremental(locationId: string): Promise<SyncResult> {
  try {
    const supabase = await createClient();
    const startTime = Date.now();

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

    // Get last successful sync timestamp
    const { data: lastSync } = await supabase
      .from('barsy_sync_log')
      .select('completed_at')
      .eq('location_id', locationId)
      .eq('sync_type', 'articles')
      .eq('success', true)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    // If no previous sync, do a full sync
    if (!lastSync?.completed_at) {
      console.log('No previous sync found, performing full sync...');
      return syncBarsyArticles(locationId);
    }

    const lastSyncTimestamp = lastSync.completed_at;
    console.log(`🔄 Incremental sync for ${location.name} since ${lastSyncTimestamp}`);

    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Fetch only changed articles
    const allChangedArticles: any[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await barsyClient.getArticlesChangedSince(
        lastSyncTimestamp,
        offset,
        batchSize
      );

      if (!response.success || !response.data) {
        console.error('Failed to fetch changed articles:', response.error);
        break;
      }

      const articles = (response.data as any).Articles_getlist || [];
      
      if (articles.length === 0) {
        hasMore = false;
      } else {
        allChangedArticles.push(...articles);
        offset += batchSize;
        if (articles.length < batchSize) {
          hasMore = false;
        }
      }
    }

    console.log(`📦 Found ${allChangedArticles.length} changed articles since last sync`);

    if (allChangedArticles.length === 0) {
      // Log successful sync even with no changes
      await logSync(locationId, 'articles', 0, supabase);
      const elapsed = Date.now() - startTime;
      console.log(`✅ No changes detected (checked in ${elapsed}ms)`);
      return { success: true, recordsSynced: 0 };
    }

    // Transform and upsert changed articles
    const articlesToInsert = allChangedArticles.map((article: any) => {
      const recipeDescription = article.recipe_description || null;
      const hasRecipe = !!recipeDescription && recipeDescription.trim() !== '';
      
      return {
        location_id: locationId,
        barsy_article_id: parseInt(article.article_id) || 0,
        article_name: article.article_name || 'Unknown',
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
        is_active: article.delete_flag !== 1 && article.delete_flag !== '1',
        is_for_sale: article.is_for_sale === 1 || article.is_for_sale === '1' || article.is_for_sale === true,
        is_semifinished: article.is_semifinished === '1' || article.is_semifinished === true,
        sort_order: article.sort_order ? parseInt(article.sort_order) : null,
        description: article.description || null,
        delete_flag: article.delete_flag === 1 || article.delete_flag === '1',
        last_update: article.last_update || null,
        recipe_description: recipeDescription,
        has_recipe: hasRecipe,
        raw_data: article,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { error: insertError } = await supabase
      .from('barsy_articles')
      .upsert(articlesToInsert, {
        onConflict: 'location_id,barsy_article_id',
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      await logSyncError(locationId, 'articles', insertError.message, supabase);
      return {
        success: false,
        error: `Failed to insert articles: ${insertError.message}`,
      };
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Incremental sync: ${articlesToInsert.length} articles updated in ${elapsed}ms`);

    await logSync(locationId, 'articles', articlesToInsert.length, supabase);

    return {
      success: true,
      recordsSynced: articlesToInsert.length,
    };
  } catch (error) {
    console.error('Incremental sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    try {
      const supabase = await createClient();
      await logSyncError(locationId, 'articles', errorMessage, supabase);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
