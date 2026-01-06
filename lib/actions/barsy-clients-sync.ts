'use server';

import { createClient } from '@/lib/supabase/server';
import { BarsyApiClient } from '@/lib/services/barsy-api';

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

export async function syncBarsyClients(locationId: string): Promise<SyncResult> {
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

    console.log(`Syncing clients for location: ${location.name}`);

    // Initialize Barsy API client
    const barsyClient = new BarsyApiClient({
      baseUrl: location.barsy_url,
      username: location.username,
      password: location.password_encrypted,
    });

    // Fetch clients
    console.log('Fetching clients from Barsy API...');
    const clientsResponse = await barsyClient.getClients({});

    if (!clientsResponse.success || !clientsResponse.data) {
      const error = clientsResponse.error || 'Failed to fetch clients';
      await logSyncError(locationId, 'clients', error, supabase);
      return {
        success: false,
        error,
      };
    }

    const allClients = (clientsResponse.data as any).Clients_getlist || [];
    console.log(`Fetched ${allClients.length} clients from Barsy API`);

    if (allClients.length === 0) {
      console.log('No clients found');
      await logSync(locationId, 'clients', 0, supabase);
      return {
        success: true,
        recordsSynced: 0,
      };
    }

    // Transform and prepare clients for insertion
    const clientsToInsert = allClients.map((client: any) => ({
      location_id: locationId,
      barsy_client_id: parseInt(client.client_id || client.id) || 0,
      client_name: client.client_name || client.name || 'Unknown',
      phone: client.phone || null,
      email: client.email || null,
      address: client.address || null,
      points: client.points ? parseFloat(client.points) : 0,
      discount_percent: client.discount_percent ? parseFloat(client.discount_percent) : null,
      is_active: client.is_active !== '0' && client.is_active !== false,
      raw_data: client,
      synced_at: new Date().toISOString(),
    }));

    console.log(`Inserting ${clientsToInsert.length} clients into database...`);

    // Upsert clients
    const { error: insertError } = await supabase
      .from('barsy_clients')
      .upsert(clientsToInsert, {
        onConflict: 'location_id,barsy_client_id',
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      await logSyncError(locationId, 'clients', insertError.message, supabase);
      return {
        success: false,
        error: `Failed to insert clients: ${insertError.message}`,
      };
    }

    console.log(`Successfully synced ${clientsToInsert.length} clients`);

    // Log successful sync
    await logSync(locationId, 'clients', clientsToInsert.length, supabase);

    return {
      success: true,
      recordsSynced: clientsToInsert.length,
    };
  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      const supabase = await createClient();
      await logSyncError(locationId, 'clients', errorMessage, supabase);
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
    status: 'completed',
    completed_at: new Date().toISOString(),
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
    status: 'failed',
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
  });
}

