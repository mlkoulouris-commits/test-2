'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CreateStaffMemberData {
  email: string
  password: string
  firstName: string
  lastName: string
  locationIds: number[]
}

// Get the current user's assigned locations (for location managers)
export const getManagerLocations = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user profile to check role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profileError) {
    return { error: profileError.message }
  }

  // Only allow location_manager, manager, or admin
  if (!['location_manager', 'manager', 'admin'].includes(profile.role)) {
    return { error: 'Unauthorized' }
  }

  // Admin gets all locations
  if (profile.role === 'admin') {
    const { data: locations, error } = await supabase
      .from('locations')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (error) {
      return { error: error.message }
    }

    return { data: locations }
  }

  // Location managers get only their assigned locations
  const { data: userLocations, error: locError } = await supabase
    .from('user_locations')
    .select('location_id, locations(id, name)')
    .eq('user_id', user.id)

  if (locError) {
    return { error: locError.message }
  }

  const locations = userLocations?.map((ul: any) => ul.locations).filter(Boolean) || []
  return { data: locations }
}

// Get staff members for the manager's assigned locations
export const getLocationStaffMembers = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user profile to check role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profileError) {
    return { error: profileError.message }
  }

  // Only allow location_manager, manager, or admin
  if (!['location_manager', 'manager', 'admin'].includes(profile.role)) {
    return { error: 'Unauthorized' }
  }

  // Get manager's locations first
  let managerLocationIds: number[] = []
  
  if (profile.role === 'admin') {
    // Admin can see all locations
    const { data: allLocations } = await supabase
      .from('locations')
      .select('id')
      .eq('is_active', true)
    managerLocationIds = allLocations?.map(l => l.id) || []
  } else {
    // Location managers see only their assigned locations
    const { data: userLocations } = await supabase
      .from('user_locations')
      .select('location_id')
      .eq('user_id', user.id)
    managerLocationIds = userLocations?.map(ul => ul.location_id) || []
  }

  if (managerLocationIds.length === 0) {
    return { data: [] }
  }

  // Get all user_ids assigned to these locations
  const { data: staffUserLocations, error: staffLocError } = await supabase
    .from('user_locations')
    .select('user_id, location_id')
    .in('location_id', managerLocationIds)

  if (staffLocError) {
    return { error: staffLocError.message }
  }

  const staffUserIds = [...new Set(staffUserLocations?.map(ul => ul.user_id) || [])]

  if (staffUserIds.length === 0) {
    return { data: [] }
  }

  // Get profiles for these users - only staff_member role
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('user_id', staffUserIds)
    .eq('role', 'staff_member')
    .order('created_at', { ascending: false })

  if (profilesError) {
    return { error: profilesError.message }
  }

  // Get all user locations for the staff
  const { data: allUserLocations, error: ulError } = await supabase
    .from('user_locations')
    .select(`
      user_id,
      location_id,
      locations (
        id,
        name
      )
    `)
    .in('user_id', profiles?.map(p => p.user_id) || [])

  if (ulError) {
    return { error: ulError.message }
  }

  // Combine the data
  const data = profiles?.map(profile => ({
    ...profile,
    user_locations: allUserLocations?.filter(ul => ul.user_id === profile.user_id) || []
  })) || []

  return { data }
}

// Create a new staff member (only staff_member role)
export const createStaffMember = async (data: CreateStaffMemberData) => {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  // Get current user profile to check role
  const { data: currentProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', currentUser.id)
    .single()

  if (profileError) {
    return { error: profileError.message }
  }

  // Only allow location_manager, manager, or admin
  if (!['location_manager', 'manager', 'admin'].includes(currentProfile.role)) {
    return { error: 'Unauthorized' }
  }

  // Verify that the manager has access to the selected locations
  if (currentProfile.role !== 'admin') {
    const { data: managerLocations } = await supabase
      .from('user_locations')
      .select('location_id')
      .eq('user_id', currentUser.id)
    
    const managerLocationIds = managerLocations?.map(ul => ul.location_id) || []
    const hasUnauthorizedLocation = data.locationIds.some(id => !managerLocationIds.includes(id))
    
    if (hasUnauthorizedLocation) {
      return { error: 'You can only assign staff to locations you manage' }
    }
  }

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

    // Create profile - always as staff_member
    const { error: createProfileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.id,
        first_name: data.firstName,
        last_name: data.lastName,
        role: 'staff_member', // Always staff_member for location managers
        created_by: currentUser.id,
        updated_by: currentUser.id,
      })

    if (createProfileError) {
      return { error: createProfileError.message }
    }

    // Assign locations if provided
    if (data.locationIds.length > 0) {
      const locationAssignments = data.locationIds.map(locationId => ({
        user_id: authUser.id,
        location_id: locationId,
        assigned_by: currentUser.id,
      }))

      const { error: locationError } = await supabase
        .from('user_locations')
        .insert(locationAssignments)

      if (locationError) {
        return { error: locationError.message }
      }
    }

    revalidatePath('/dashboard/staff-manager')
    return { success: true, userId: authUser.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An error occurred' }
  }
}

// Update staff member status (activate/deactivate)
export const updateStaffMemberStatus = async (userId: string, isActive: boolean) => {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  // Get current user profile to check role
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', currentUser.id)
    .single()

  if (!['location_manager', 'manager', 'admin'].includes(currentProfile?.role || '')) {
    return { error: 'Unauthorized' }
  }

  // Verify the target user is a staff member in manager's locations
  if (currentProfile?.role !== 'admin') {
    const { data: managerLocations } = await supabase
      .from('user_locations')
      .select('location_id')
      .eq('user_id', currentUser.id)
    
    const managerLocationIds = managerLocations?.map(ul => ul.location_id) || []

    const { data: staffLocations } = await supabase
      .from('user_locations')
      .select('location_id')
      .eq('user_id', userId)
    
    const staffLocationIds = staffLocations?.map(ul => ul.location_id) || []
    const hasAccess = staffLocationIds.some(id => managerLocationIds.includes(id))

    if (!hasAccess) {
      return { error: 'You can only manage staff from your assigned locations' }
    }
  }

  // Verify target is a staff_member
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (targetProfile?.role !== 'staff_member') {
    return { error: 'You can only manage staff members' }
  }

  // Update profile status
  const { error } = await supabase
    .from('profiles')
    .update({
      is_active: isActive,
      updated_by: currentUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  // If deactivating user, remove all future scheduled shifts
  if (!isActive) {
    const today = new Date().toISOString().split('T')[0]
    
    await supabase
      .from('scheduled_shifts')
      .delete()
      .eq('user_id', userId)
      .gte('business_date', today)
  }

  revalidatePath('/dashboard/staff-manager')
  return { success: true }
}

// Assign locations to a staff member (limited to manager's locations)
export const assignStaffLocations = async (userId: string, locationIds: number[]) => {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  // Get current user profile to check role
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', currentUser.id)
    .single()

  if (!['location_manager', 'manager', 'admin'].includes(currentProfile?.role || '')) {
    return { error: 'Unauthorized' }
  }

  // Verify target is a staff_member
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (targetProfile?.role !== 'staff_member') {
    return { error: 'You can only manage staff members' }
  }

  // Get manager's locations
  let managerLocationIds: number[] = []
  if (currentProfile?.role === 'admin') {
    const { data: allLocations } = await supabase
      .from('locations')
      .select('id')
      .eq('is_active', true)
    managerLocationIds = allLocations?.map(l => l.id) || []
  } else {
    const { data: managerLocations } = await supabase
      .from('user_locations')
      .select('location_id')
      .eq('user_id', currentUser.id)
    managerLocationIds = managerLocations?.map(ul => ul.location_id) || []
  }

  // Verify all locations are managed by current user
  const hasUnauthorizedLocation = locationIds.some(id => !managerLocationIds.includes(id))
  if (hasUnauthorizedLocation) {
    return { error: 'You can only assign locations you manage' }
  }

  // Get existing locations for this staff member
  const { data: existingLocations } = await supabase
    .from('user_locations')
    .select('location_id')
    .eq('user_id', userId)

  const existingLocationIds = existingLocations?.map(ul => ul.location_id) || []

  // Only remove locations that are in manager's scope
  const locationsToRemove = existingLocationIds.filter(id => 
    managerLocationIds.includes(id) && !locationIds.includes(id)
  )

  // Remove old assignments (only from manager's locations)
  if (locationsToRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('user_locations')
      .delete()
      .eq('user_id', userId)
      .in('location_id', locationsToRemove)

    if (deleteError) {
      return { error: deleteError.message }
    }
  }

  // Add new assignments
  const locationsToAdd = locationIds.filter(id => !existingLocationIds.includes(id))
  if (locationsToAdd.length > 0) {
    const assignments = locationsToAdd.map(locationId => ({
      user_id: userId,
      location_id: locationId,
      assigned_by: currentUser.id,
    }))

    const { error: insertError } = await supabase
      .from('user_locations')
      .insert(assignments)

    if (insertError) {
      return { error: insertError.message }
    }
  }

  revalidatePath('/dashboard/staff-manager')
  return { success: true }
}

// Reset staff member password
export const resetStaffPassword = async (userId: string, newPassword: string) => {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  // Get current user profile to check role
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', currentUser.id)
    .single()

  if (!['location_manager', 'manager', 'admin'].includes(currentProfile?.role || '')) {
    return { error: 'Unauthorized' }
  }

  // Verify the target user is a staff member in manager's locations
  if (currentProfile?.role !== 'admin') {
    const { data: managerLocations } = await supabase
      .from('user_locations')
      .select('location_id')
      .eq('user_id', currentUser.id)
    
    const managerLocationIds = managerLocations?.map(ul => ul.location_id) || []

    const { data: staffLocations } = await supabase
      .from('user_locations')
      .select('location_id')
      .eq('user_id', userId)
    
    const staffLocationIds = staffLocations?.map(ul => ul.location_id) || []
    const hasAccess = staffLocationIds.some(id => managerLocationIds.includes(id))

    if (!hasAccess) {
      return { error: 'You can only manage staff from your assigned locations' }
    }
  }

  // Verify target is a staff_member
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (targetProfile?.role !== 'staff_member') {
    return { error: 'You can only manage staff members' }
  }

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
