'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentBusinessDate } from '@/lib/utils/business-date'

export const clockIn = async (locationId: number) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const now = new Date().toISOString()
  const businessDate = getCurrentBusinessDate()

  // Check if already clocked in
  const { data: existing } = await supabase
    .from('actual_shifts')
    .select('*')
    .eq('user_id', user.id)
    .eq('location_id', locationId)
    .is('clock_out', null)
    .single()

  if (existing) {
    return { error: 'Already clocked in' }
  }

  const { data, error } = await supabase
    .from('actual_shifts')
    .insert({
      user_id: user.id,
      location_id: locationId,
      clock_in: now,
      business_date: businessDate,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true, data }
}

export const clockOut = async (shiftId: number) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('actual_shifts')
    .update({
      clock_out: now,
      updated_by: user?.id || null,
    })
    .eq('id', shiftId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true, data }
}

export const getCurrentShift = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('actual_shifts')
    .select(`
      *,
      locations (id, name)
    `)
    .eq('user_id', user.id)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { error: error.message }
  }

  return { data }
}

export const getMyShiftHistory = async (limit = 10) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('actual_shifts')
    .select(`
      *,
      locations (id, name)
    `)
    .eq('user_id', user.id)
    .order('clock_in', { ascending: false })
    .limit(limit)

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export const getMySchedule = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(today.getDate() - 7)
  const weekAhead = new Date(today)
  weekAhead.setDate(today.getDate() + 14)

  const { data, error } = await supabase
    .from('scheduled_shifts')
    .select(`
      *,
      locations (id, name)
    `)
    .eq('user_id', user.id)
    .gte('business_date', weekAgo.toISOString().split('T')[0])
    .lte('business_date', weekAhead.toISOString().split('T')[0])
    .order('business_date', { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

// Location Manager functions
export const getLocationStaff = async (locationId: number) => {
  const supabase = await createClient()

  // Get user IDs for this location
  const { data: userLocations, error: ulError } = await supabase
    .from('user_locations')
    .select('user_id')
    .eq('location_id', locationId)

  if (ulError) {
    return { error: ulError.message }
  }

  if (!userLocations || userLocations.length === 0) {
    return { data: [] }
  }

  const userIds = userLocations.map(ul => ul.user_id)

  // Get profiles for these users
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, role, is_active')
    .in('user_id', userIds)

  if (profilesError) {
    return { error: profilesError.message }
  }

  // Transform to match expected structure
  const data = userLocations.map(ul => ({
    user_id: ul.user_id,
    profiles: profiles?.find(p => p.user_id === ul.user_id) || null
  }))

  return { data }
}

export const getStaffSchedule = async (userId: string, startDate: string, endDate: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('scheduled_shifts')
    .select(`
      *,
      locations (id, name)
    `)
    .eq('user_id', userId)
    .gte('business_date', startDate)
    .lte('business_date', endDate)
    .order('business_date', { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export const createScheduledShift = async (data: {
  userId: string
  locationId: number
  shiftDate: string
  startTime: string
  endTime: string
  endsNextDay?: boolean
  notes?: string
}) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is active
  const { data: profile, error: profileError} = await supabase
    .from('profiles')
    .select('is_active')
    .eq('user_id', data.userId)
    .single()

  if (profileError) {
    return { error: 'User not found' }
  }

  if (!profile.is_active) {
    return { error: 'Cannot schedule inactive users' }
  }

  // Construct proper timestamps
  const scheduledStart = `${data.shiftDate}T${data.startTime}:00`
  
  // If shift ends next day, add 1 day to end timestamp
  let scheduledEnd = `${data.shiftDate}T${data.endTime}:00`
  if (data.endsNextDay) {
    const endDate = new Date(data.shiftDate)
    endDate.setDate(endDate.getDate() + 1)
    scheduledEnd = `${endDate.toISOString().split('T')[0]}T${data.endTime}:00`
  }

  // Check for time overlaps with existing shifts for this user (any location)
  const { data: existingShifts, error: checkError } = await supabase
    .from('scheduled_shifts')
    .select('id, scheduled_start, scheduled_end, locations(name)')
    .eq('user_id', data.userId)
    .or(`and(scheduled_start.lt.${scheduledEnd},scheduled_end.gt.${scheduledStart})`)

  if (checkError) {
    return { error: 'Failed to check for conflicts' }
  }

  if (existingShifts && existingShifts.length > 0) {
    const conflictLocation = (existingShifts[0] as any).locations?.name || 'another location'
    return { error: `User already has an overlapping shift at ${conflictLocation}` }
  }

  const { data: shift, error } = await supabase
    .from('scheduled_shifts')
    .insert({
      user_id: data.userId,
      location_id: data.locationId,
      business_date: data.shiftDate,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      created_by: user?.id || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true, data: shift }
}

export const updateScheduledShift = async (
  shiftId: number,
  data: {
    shiftDate?: string
    startTime?: string
    endTime?: string
    endsNextDay?: boolean
  }
) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get current shift to check user_id and construct new times
  const { data: currentShift } = await supabase
    .from('scheduled_shifts')
    .select('user_id, business_date, scheduled_start, scheduled_end')
    .eq('id', shiftId)
    .single()

  if (!currentShift) {
    return { error: 'Shift not found' }
  }

  const updateData: any = {
    updated_by: user?.id || null,
  }
  
  // Construct new timestamps
  const shiftDate = data.shiftDate || currentShift.business_date
  const startTime = data.startTime || currentShift.scheduled_start.split('T')[1].substring(0, 5)
  const endTime = data.endTime || currentShift.scheduled_end.split('T')[1].substring(0, 5)
  
  const scheduledStart = `${shiftDate}T${startTime}:00`
  let scheduledEnd = `${shiftDate}T${endTime}:00`
  
  if (data.endsNextDay) {
    const endDate = new Date(shiftDate)
    endDate.setDate(endDate.getDate() + 1)
    scheduledEnd = `${endDate.toISOString().split('T')[0]}T${endTime}:00`
  }

  updateData.business_date = shiftDate
  updateData.scheduled_start = scheduledStart
  updateData.scheduled_end = scheduledEnd

  // Check for overlaps (excluding current shift)
  const { data: existingShifts } = await supabase
    .from('scheduled_shifts')
    .select('id, scheduled_start, scheduled_end, locations(name)')
    .eq('user_id', currentShift.user_id)
    .neq('id', shiftId)
    .or(`and(scheduled_start.lt.${scheduledEnd},scheduled_end.gt.${scheduledStart})`)

  if (existingShifts && existingShifts.length > 0) {
    const conflictLocation = (existingShifts[0] as any).locations?.name || 'another location'
    return { error: `User already has an overlapping shift at ${conflictLocation}` }
  }

  const { data: shift, error } = await supabase
    .from('scheduled_shifts')
    .update(updateData)
    .eq('id', shiftId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true, data: shift }
}

export const getUserSchedule = async (
  userId: string,
  startDate: string,
  endDate: string
) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('scheduled_shifts')
    .select(`
      *,
      locations (id, name)
    `)
    .eq('user_id', userId)
    .gte('business_date', startDate)
    .lte('business_date', endDate)
    .order('scheduled_start', { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export const deleteScheduledShift = async (shiftId: number) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from('scheduled_shifts')
    .delete()
    .eq('id', shiftId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export const updateActualShift = async (
  shiftId: number,
  data: {
    clockInTime?: string
    clockOutTime?: string
    notes?: string
  }
) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: shift, error } = await supabase
    .from('actual_shifts')
    .update({
      clock_in: data.clockInTime,
      clock_out: data.clockOutTime,
      updated_by: user?.id || null,
    })
    .eq('id', shiftId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true, data: shift }
}

export const getLocationShifts = async (locationId: number, date: string) => {
  const supabase = await createClient()

  // Get scheduled shifts
  const { data: scheduled, error: schedError } = await supabase
    .from('scheduled_shifts')
    .select(`
      *,
      profiles (user_id, first_name, last_name)
    `)
    .eq('location_id', locationId)
    .eq('business_date', date)
    .order('scheduled_start', { ascending: true })

  if (schedError) {
    return { error: schedError.message }
  }

  // Get actual shifts
  const { data: actual, error: actualError } = await supabase
    .from('actual_shifts')
    .select(`
      *,
      profiles (user_id, first_name, last_name)
    `)
    .eq('location_id', locationId)
    .eq('business_date', date)
    .order('clock_in', { ascending: true })

  if (actualError) {
    return { error: actualError.message }
  }

  return { data: { scheduled, actual } }
}

