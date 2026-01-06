'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type UserRole = 'admin' | 'manager' | 'location_manager' | 'staff_member' | 'shareholder'

export interface CreateUserData {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
  locationIds?: number[]
}

export interface UpdateUserData {
  firstName: string
  lastName: string
  role: UserRole
}

export const createUser = async (data: CreateUserData) => {
  const supabase = await createClient()

  // Get current user for audit
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  try {
    // Create auth user using service role key
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        email_confirm: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.message || 'Failed to create auth user' }
    }

    const authUser = await response.json()

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.id,
        first_name: data.firstName,
        last_name: data.lastName,
        role: data.role,
        created_by: currentUser?.id || null,
        updated_by: currentUser?.id || null,
      })

    if (profileError) {
      return { error: profileError.message }
    }

    // Assign locations if provided
    if (data.locationIds && data.locationIds.length > 0) {
      const locationAssignments = data.locationIds.map(locationId => ({
        user_id: authUser.id,
        location_id: locationId,
        assigned_by: currentUser?.id || null,
      }))

      const { error: locationError } = await supabase
        .from('user_locations')
        .insert(locationAssignments)

      if (locationError) {
        return { error: locationError.message }
      }
    }

    revalidatePath('/admin/users')
    return { success: true, userId: authUser.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An error occurred' }
  }
}

export const getAllUsers = async () => {
  const supabase = await createClient()

  // Get profiles first
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (profilesError) {
    return { error: profilesError.message }
  }

  // Get user locations separately
  const { data: userLocations, error: locationsError } = await supabase
    .from('user_locations')
    .select(`
      user_id,
      location_id,
      locations (
        id,
        name
      )
    `)

  if (locationsError) {
    return { error: locationsError.message }
  }

  // Combine the data
  const data = profiles.map(profile => ({
    ...profile,
    user_locations: userLocations?.filter(ul => ul.user_id === profile.user_id) || []
  }))

  return { data }
}

export const updateUserStatus = async (userId: string, isActive: boolean) => {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // Update profile status
  const { error } = await supabase
    .from('profiles')
    .update({
      is_active: isActive,
      updated_by: currentUser?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  // If deactivating user, remove all future scheduled shifts
  if (!isActive) {
    const today = new Date().toISOString().split('T')[0]
    
    const { error: deleteError } = await supabase
      .from('scheduled_shifts')
      .delete()
      .eq('user_id', userId)
      .gte('business_date', today)

    if (deleteError) {
      console.error('Error deleting future shifts:', deleteError)
      // Don't fail the whole operation if this fails
    }
  }

  revalidatePath('/admin/users')
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export const updateUser = async (userId: string, data: UpdateUserData) => {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: data.firstName,
      last_name: data.lastName,
      role: data.role,
      updated_by: currentUser?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export const resetUserPassword = async (userId: string, newPassword: string) => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        password: newPassword,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.message || 'Failed to reset password' }
    }

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An error occurred' }
  }
}

