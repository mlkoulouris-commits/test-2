'use server';

/**
 * Barsy Sync Actions
 * Server actions to sync data from Barsy API to Supabase
 */

import { createClient } from '@/lib/supabase/server';
import { createBarsyClient } from '@/lib/services/barsy-api';

interface BarsyLocation {
  id: string;
  name: string;
  barsy_url: string;
  username: string;
  password_encrypted: string;
}

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

/**
 * Sync orders from Barsy for a specific location and date range
 */
export async function syncBarsyOrders(
  locationId: string,
  dateFrom: string,
  dateTo: string
): Promise<SyncResult> {
  try {
    const supabase = await createClient();

    // Get location config
    const { data: location, error: locationError } = await supabase
      .from('barsy_locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (locationError || !location) {
      return { success: false, error: 'Location not found' };
    }

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('barsy_sync_log')
      .insert({
        location_id: locationId,
        sync_type: 'orders',
        date_from: dateFrom,
        date_to: dateTo,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (syncLogError) {
      return { success: false, error: 'Failed to create sync log' };
    }

    // Create Barsy client
    const barsyClient = createBarsyClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted, // Should decrypt in production
    });

    // Fetch ALL orders (handles pagination automatically)
    const ordersResponse = await barsyClient.getAllOrders(dateFrom, dateTo);

    if (!ordersResponse.success || !ordersResponse.data) {
      await supabase
        .from('barsy_sync_log')
        .update({
          status: 'failed',
          error_message: ordersResponse.error || 'Failed to fetch orders',
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);

      return { success: false, error: ordersResponse.error };
    }

    // Extract orders from response (API now filters by date on server-side)
    const orders = (ordersResponse.data as any).Orders_getlist || [];

    console.log(`✅ Fetched ${orders.length} orders for ${dateFrom} to ${dateTo}`);

    // Transform orders
    const ordersToInsert = orders.map((order: any) => ({
      location_id: locationId,
      barsy_order_id: order.order_id,
      order_date: order.date,
      barsy_article_id: order.article_id,
      article_name: order.article_name,
      amount: order.amount,
      amount_unit: order.amount_unit,
      current_price: order.current_price,
      actual_price: order.actual_price,
      order_status: order.status,
      order_status_title: order.order_status_title,
      barsy_user_id: order.user_id,
      user_name: order.user_name,
      pos_id: order.pos_id,
      stream_id: order.stream_id,
      barsy_id: order.barsy_id,
      served_date: order.served_date,
      served_by: order.served_by,
      amount_type_id: order.amount_type_id,
      amount_type_name_short: order.amount_type_name_short,
      article_type: order.article_type,
      raw_data: order,
    }));

    // Batch insert to avoid timeouts (2000 records per batch)
    const batchSize = 2000;
    let insertedCount = 0;

    for (let i = 0; i < ordersToInsert.length; i += batchSize) {
      const batch = ordersToInsert.slice(i, i + batchSize);
      console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ordersToInsert.length / batchSize)} (${batch.length} records)`);

      const { error: insertError } = await supabase
        .from('barsy_orders')
        .upsert(batch, {
          onConflict: 'location_id,barsy_order_id',
          ignoreDuplicates: false,
        });

      if (insertError) {
        await supabase
          .from('barsy_sync_log')
          .update({
            status: 'failed',
            error_message: `Failed at batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);

        return { success: false, error: insertError.message };
      }

      insertedCount += batch.length;
    }

    console.log(`✅ Inserted ${insertedCount} orders in ${Math.ceil(ordersToInsert.length / batchSize)} batches`);

    // Update sync log as success
    await supabase
      .from('barsy_sync_log')
      .update({
        status: 'success',
        records_synced: orders.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog.id);

    return { success: true, recordsSynced: orders.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync articles from Barsy for a specific location (with pagination)
 */
export async function syncBarsyArticles(locationId: string): Promise<SyncResult> {
  try {
    const supabase = await createClient();

    const { data: location } = await supabase
      .from('barsy_locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (!location) {
      return { success: false, error: 'Location not found' };
    }

    const barsyClient = createBarsyClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Use getAllArticles for automatic pagination (1000/batch)
    console.log('Fetching articles from Barsy API...');
    const articlesResponse = await barsyClient.getAllArticles({});

    if (!articlesResponse.success || !articlesResponse.data) {
      return { success: false, error: articlesResponse.error };
    }

    const articles = (articlesResponse.data as any).Articles_getlist || [];
    console.log(`Fetched ${articles.length} articles from Barsy API`);

    const articlesToInsert = articles.map((article: any) => ({
      location_id: locationId,
      barsy_article_id: parseInt(article.article_id) || 0,
      article_name: article.article_name || 'Unknown',
      article_name_public: article.article_name_public || article.article_name,
      price: article.actual_price ? parseFloat(article.actual_price) : null,
      cost_price: article.cost_price ? parseFloat(article.cost_price) : null,
      category_id: article.master_cat_id ? parseInt(article.master_cat_id) : null,
      amount_type_id: article.amount_type_id ? parseInt(article.amount_type_id) : null,
      is_active: article.delete_flag !== 1 && article.delete_flag !== '1',
      is_for_sale: article.is_for_sale === 1 || article.is_for_sale === '1',
      is_semifinished: article.is_semifinished === 1 || article.is_semifinished === '1',
      barcode: article.barcode || null,
      description: article.description || null,
      raw_data: article,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('barsy_articles')
      .upsert(articlesToInsert, {
        onConflict: 'location_id,barsy_article_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Insert error:', error);
      return { success: false, error: error.message };
    }

    console.log(`Successfully synced ${articles.length} articles`);

    return { success: true, recordsSynced: articles.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync users/staff from Barsy for a specific location
 */
export async function syncBarsyUsers(locationId: string): Promise<SyncResult> {
  try {
    const supabase = await createClient();

    const { data: location } = await supabase
      .from('barsy_locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (!location) {
      return { success: false, error: 'Location not found' };
    }

    const barsyClient = createBarsyClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    console.log('Fetching users from Barsy API...');
    const usersResponse = await barsyClient.getUsers({});

    if (!usersResponse.success || !usersResponse.data) {
      return { success: false, error: usersResponse.error };
    }

    const users = (usersResponse.data as any).Users_getlist || [];
    console.log(`Fetched ${users.length} users from Barsy API`);

    const usersToInsert = users.map((user: any) => ({
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

    const { error } = await supabase
      .from('barsy_staff')
      .upsert(usersToInsert, {
        onConflict: 'location_id,barsy_user_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Insert error:', error);
      return { success: false, error: error.message };
    }

    console.log(`Successfully synced ${users.length} users`);

    return { success: true, recordsSynced: users.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync categories from Barsy for a specific location
 */
export async function syncBarsyCategories(locationId: string): Promise<SyncResult> {
  try {
    const supabase = await createClient();

    const { data: location } = await supabase
      .from('barsy_locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (!location) {
      return { success: false, error: 'Location not found' };
    }

    const barsyClient = createBarsyClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    console.log('Fetching categories from Barsy API...');
    const categoriesResponse = await barsyClient.getCategories(false);

    if (!categoriesResponse.success || !categoriesResponse.data) {
      return { success: false, error: categoriesResponse.error };
    }

    const categories = (categoriesResponse.data as any).Categories_getlist || [];
    console.log(`Fetched ${categories.length} categories from Barsy API`);

    const categoriesToInsert = categories.map((cat: any) => ({
      location_id: locationId,
      barsy_cat_id: parseInt(cat.cat_id) || 0,
      cat_name: cat.cat_name || 'Unknown',
      cat_path: cat.cat_path || null,
      parent_id: cat.parent_id ? parseInt(cat.parent_id) : null,
      raw_data: cat,
    }));

    const { error } = await supabase
      .from('barsy_categories')
      .upsert(categoriesToInsert, {
        onConflict: 'location_id,barsy_cat_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Insert error:', error);
      return { success: false, error: error.message };
    }

    console.log(`Successfully synced ${categories.length} categories`);

    return { success: true, recordsSynced: categories.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all configured Barsy locations
 */
export async function getBarsyLocations() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('barsy_locations')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * Get sync history for a location with pagination
 */
export async function getSyncHistory(
  locationId: string,
  page: number = 1,
  pageSize: number = 10
) {
  const supabase = await createClient();
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from('barsy_sync_log')
    .select(`
      *,
      barsy_locations (name)
    `, { count: 'exact' })
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, error: error.message };
  }

  // Transform data to include location_name at top level
  const transformedData = data?.map((log: any) => ({
    ...log,
    location_name: log.barsy_locations?.name || 'Unknown',
  }));

  return {
    success: true,
    data: transformedData,
    totalCount: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize)
  };
}
