'use server';

import { createClient } from '@/lib/supabase/server';

export interface BarsyLocation {
  id: string;
  name: string;
  barsy_url: string;
  username: string;
  password_encrypted: string;
  is_active: boolean;
  memento_location_id: number | null;
  created_at: string;
  updated_at: string;
}

export async function getAllBarsyLocations() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('barsy_locations')
      .select(`
        *,
        memento_location:locations(id, name)
      `)
      .order('name');

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching Barsy locations:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch Barsy locations' 
    };
  }
}

export async function createBarsyLocation(data: {
  name: string;
  barsy_url: string;
  username: string;
  password: string;
  memento_location_id?: number | null;
}) {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('barsy_locations')
      .insert({
        name: data.name,
        barsy_url: data.barsy_url,
        username: data.username,
        password_encrypted: data.password, // TODO: Add encryption in production
        is_active: true,
        memento_location_id: data.memento_location_id || null,
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error creating Barsy location:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create Barsy location' 
    };
  }
}

export async function updateBarsyLocation(id: string, data: {
  name?: string;
  barsy_url?: string;
  username?: string;
  password?: string;
  is_active?: boolean;
  memento_location_id?: number | null;
}) {
  try {
    const supabase = await createClient();
    
    const updateData: any = { ...data };
    if (data.password) {
      updateData.password_encrypted = data.password; // TODO: Add encryption in production
      delete updateData.password;
    }

    const { error } = await supabase
      .from('barsy_locations')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating Barsy location:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update Barsy location' 
    };
  }
}

export async function deleteBarsyLocation(id: string) {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('barsy_locations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting Barsy location:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete Barsy location' 
    };
  }
}

