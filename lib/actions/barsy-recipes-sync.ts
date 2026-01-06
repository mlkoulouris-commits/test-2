'use server';

import { createClient } from '@/lib/supabase/server';
import { BarsyApiClient } from '@/lib/services/barsy-api';

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

/**
 * Helper to process items in parallel batches with controlled concurrency
 */
async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    // Log progress every batch
    if (items.length > batchSize) {
      console.log(`  📦 Processed ${Math.min(i + batchSize, items.length)}/${items.length} articles...`);
    }
  }
  
  return results;
}

/**
 * Sync recipes from Barsy for all articles
 * Fetches recipe/BOM data showing which ingredients are used in each product
 * 
 * OPTIMIZED: 
 * 1. Uses already-synced articles from DB instead of fetching all from API
 * 2. Only checks articles likely to have recipes (is_for_sale=true, not deleted)
 * 3. Uses parallel batching (20 concurrent requests)
 */
export async function syncBarsyRecipes(locationId: string): Promise<SyncResult> {
  try {
    const startTime = Date.now();
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

    console.log(`🚀 Syncing recipes for location: ${location.name}`);

    // Initialize Barsy API client
    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // OPTIMIZED: Get articles from DB instead of API (already synced)
    // Only check articles that have has_recipe=true (set during article sync)
    const { data: dbArticles, error: dbError } = await supabase
      .from('barsy_articles')
      .select('barsy_article_id, article_name')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .eq('has_recipe', true);

    if (dbError) {
      // Fallback to API if DB query fails
      console.log('DB query failed, falling back to API...');
      const articlesResponse = await barsyClient.getAllArticles({});
      if (!articlesResponse.success || !articlesResponse.data) {
        return {
          success: false,
          error: articlesResponse.error || 'Failed to fetch articles',
        };
      }
      const apiArticles = (articlesResponse.data as any).Articles_getlist || [];
      return syncRecipesForArticles(locationId, apiArticles, barsyClient, supabase, startTime);
    }

    let articles = (dbArticles || []).map((a: any) => ({
      article_id: a.barsy_article_id,
      article_name: a.article_name,
    }));
    
    // If no articles have has_recipe=true, this might be first run - scan all active for-sale articles
    if (articles.length === 0) {
      console.log('No articles with has_recipe=true found. Scanning all active for-sale articles...');
      const { data: allArticles } = await supabase
        .from('barsy_articles')
        .select('barsy_article_id, article_name')
        .eq('location_id', locationId)
        .eq('is_active', true)
        .eq('is_for_sale', true);
      
      articles = (allArticles || []).map((a: any) => ({
        article_id: a.barsy_article_id,
        article_name: a.article_name,
      }));
      console.log(`Found ${articles.length} active for-sale articles to scan for recipes`);
    } else {
      console.log(`Found ${articles.length} articles with has_recipe=true`);
    }

    return syncRecipesForArticles(locationId, articles, barsyClient, supabase, startTime);
  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      const supabase = await createClient();
      await logSyncError(locationId, 'recipes', errorMessage, supabase);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Core recipe sync logic - extracted for reuse
 */
async function syncRecipesForArticles(
  locationId: string,
  articles: any[],
  barsyClient: BarsyApiClient,
  supabase: any,
  startTime: number
): Promise<SyncResult> {
  // OPTIMIZED: Fetch recipes in parallel batches of 20 concurrent requests
  const CONCURRENT_REQUESTS = 20;
  
  const recipeResults = await processInBatches(
    articles,
    CONCURRENT_REQUESTS,
    async (article: any) => {
      const articleId = parseInt(article.article_id);
      
      try {
        const recipeResponse = await barsyClient.getArticleRecipe(articleId);
        
        if (!recipeResponse.success || !recipeResponse.data) {
          return { articleId, articleName: article.article_name, ingredients: [] };
        }

        const recipeData = (recipeResponse.data as any).Articles_getrecipearticles;
        
        if (!recipeData || !Array.isArray(recipeData) || recipeData.length === 0) {
          return { articleId, articleName: article.article_name, ingredients: [] };
        }

        return { 
          articleId, 
          articleName: article.article_name, 
          ingredients: recipeData 
        };
      } catch {
        return { articleId, articleName: article.article_name, ingredients: [] };
      }
    }
  );

  // Transform results into recipe records
  const allRecipes: any[] = [];
  let articlesWithRecipes = 0;

  for (const result of recipeResults) {
    if (result.ingredients.length > 0) {
      articlesWithRecipes++;
      
      for (const ingredient of result.ingredients) {
        allRecipes.push({
          location_id: locationId,
          barsy_article_id: result.articleId,
          barsy_ingredient_article_id: parseInt(ingredient.article_id) || 0,
          article_name: result.articleName,
          ingredient_name: ingredient.article_name || 'Unknown',
          quantity: parseFloat(ingredient.amount) || 0,
          unit: ingredient.amount_unit || null,
          raw_data: ingredient,
          synced_at: new Date().toISOString(),
        });
      }
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`Found ${allRecipes.length} recipe ingredients for ${articlesWithRecipes} articles (${elapsed}ms)`);

  if (allRecipes.length === 0) {
    await logSync(locationId, 'recipes', 0, supabase);
    return {
      success: true,
      recordsSynced: 0,
    };
  }

  // Delete existing recipes for this location
  const { error: deleteError } = await supabase
    .from('barsy_recipes')
    .delete()
    .eq('location_id', locationId);

  if (deleteError) {
    console.error('Delete error:', deleteError);
  }

  // OPTIMIZED: Batch insert recipes in chunks of 500
  const BATCH_SIZE = 500;
  let insertedCount = 0;
  
  for (let i = 0; i < allRecipes.length; i += BATCH_SIZE) {
    const batch = allRecipes.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from('barsy_recipes')
      .insert(batch);

    if (insertError) {
      console.error(`Insert error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, insertError);
    } else {
      insertedCount += batch.length;
    }
  }

  // Update has_recipe flag on articles that have recipes
  if (articlesWithRecipes > 0) {
    const articleIdsWithRecipes = recipeResults
      .filter(r => r.ingredients.length > 0)
      .map(r => r.articleId);
    
    if (articleIdsWithRecipes.length > 0) {
      await supabase
        .from('barsy_articles')
        .update({ has_recipe: true })
        .eq('location_id', locationId)
        .in('barsy_article_id', articleIdsWithRecipes);
      
      console.log(`  📝 Updated has_recipe flag for ${articleIdsWithRecipes.length} articles`);
    }
  }

  const totalElapsed = Date.now() - startTime;
  console.log(`✅ Successfully synced ${insertedCount} recipe ingredients in ${totalElapsed}ms`);

  await logSync(locationId, 'recipes', insertedCount, supabase);

  return {
    success: true,
    recordsSynced: insertedCount,
  };
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

