'use server';

import { createClient } from '@/lib/supabase/server';
import { BarsyApiClient } from '@/lib/services/barsy-api';

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

export async function syncBarsyUsers(locationId: string): Promise<SyncResult> {
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

    console.log(`Syncing users/staff for location: ${location.name}`);

    // Initialize Barsy API client
    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Fetch users
    console.log('Fetching users from Barsy API...');
    const usersResponse = await barsyClient.getUsers({});

    if (!usersResponse.success || !usersResponse.data) {
      const error = usersResponse.error || 'Failed to fetch users';
      await logSyncError(locationId, 'users', error, supabase);
      return {
        success: false,
        error,
      };
    }

    const allUsers = (usersResponse.data as any).Users_getlist || [];
    console.log(`Fetched ${allUsers.length} users from Barsy API`);

    if (allUsers.length === 0) {
      console.log('No users found');
      await logSync(locationId, 'users', 0, supabase);
      return {
        success: true,
        recordsSynced: 0,
      };
    }

    // Transform and prepare users for insertion
    const usersToInsert = allUsers.map((user: any) => ({
      location_id: locationId,
      barsy_user_id: parseInt(user.user_id) || 0,
      username: user.username || 'unknown',
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      email: user.email || null,
      phone: user.phone || null,
      role_id: user.role_id ? parseInt(user.role_id) : null,
      role_name: user.role_name || null,
      is_active: user.is_active !== '0' && user.is_active !== false,
      raw_data: user,
      synced_at: new Date().toISOString(),
    }));

    console.log(`Inserting ${usersToInsert.length} users into database...`);

    // Upsert users
    const { error: insertError } = await supabase
      .from('barsy_staff')
      .upsert(usersToInsert, {
        onConflict: 'location_id,barsy_user_id',
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      await logSyncError(locationId, 'users', insertError.message, supabase);
      return {
        success: false,
        error: `Failed to insert users: ${insertError.message}`,
      };
    }

    console.log(`Successfully synced ${usersToInsert.length} users`);

    // Log successful sync
    await logSync(locationId, 'users', usersToInsert.length, supabase);

    return {
      success: true,
      recordsSynced: usersToInsert.length,
    };
  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      const supabase = await createClient();
      await logSyncError(locationId, 'users', errorMessage, supabase);
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

