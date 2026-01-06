'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export const assignUserLocations = async (userId: string, locationIds: number[]) => {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // Remove existing assignments
  const { error: deleteError } = await supabase
    .from('user_locations')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  // Add new assignments if any
  if (locationIds.length > 0) {
    const assignments = locationIds.map(locationId => ({
      user_id: userId,
      location_id: locationId,
      assigned_by: currentUser?.id || null,
    }))

    const { error: insertError } = await supabase
      .from('user_locations')
      .insert(assignments)

    if (insertError) {
      return { error: insertError.message }
    }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

