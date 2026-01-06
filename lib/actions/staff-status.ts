'use server'

import { createClient } from '@/lib/supabase/server'

export const getLocationStaffStatus = async (locationId: number) => {
  const supabase = await createClient()

  // Get all staff assigned to this location
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

  // Get current shifts (clocked in staff)
  const { data: currentShifts, error: shiftsError } = await supabase
    .from('actual_shifts')
    .select(`
      user_id,
      clock_in,
      location_id,
      locations (id, name)
    `)
    .is('clock_out', null)

  if (shiftsError) {
    return { error: shiftsError.message }
  }

  // Get today's scheduled shifts
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  const { data: scheduledShifts, error: schedError } = await supabase
    .from('scheduled_shifts')
    .select(`
      user_id,
      location_id,
      scheduled_start,
      scheduled_end,
      locations (id, name)
    `)
    .eq('business_date', today)

  if (schedError) {
    return { error: schedError.message }
  }

  // Combine the data
  const staffStatus = profiles?.map((profile: any) => {
    const currentShift = currentShifts?.find(cs => cs.user_id === profile.user_id)
    const todaySchedule = scheduledShifts?.filter(ss => ss.user_id === profile.user_id) || []
    
    // Check if user is within scheduled time at ANY location
    const isWithinSchedule = todaySchedule.some(schedule => {
      return currentTime >= schedule.scheduled_start && currentTime <= schedule.scheduled_end
    })

    // Check if they have a schedule at this specific location
    const hasScheduleHere = todaySchedule.some(schedule => schedule.location_id === locationId)

    return {
      user_id: profile.user_id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      role: profile.role,
      is_active: profile.is_active,
      current_shift: currentShift,
      is_within_schedule: isWithinSchedule,
      has_schedule_here: hasScheduleHere,
      today_schedule: todaySchedule,
    }
  }) || []

  return { data: staffStatus }
}

export const getAllLocationStaffStatus = async (locationIds: number[]) => {
  const supabase = await createClient()

  // Get all staff assigned to these locations
  const { data: userLocations, error: ulError } = await supabase
    .from('user_locations')
    .select('user_id, location_id, locations(id, name)')
    .in('location_id', locationIds)

  if (ulError) {
    return { error: ulError.message }
  }

  if (!userLocations || userLocations.length === 0) {
    return { data: [] }
  }

  const userIds = [...new Set(userLocations.map(ul => ul.user_id))]

  // Get profiles for these users
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, role, is_active')
    .in('user_id', userIds)

  if (profilesError) {
    return { error: profilesError.message }
  }

  // Get current shifts (clocked in staff)
  const { data: currentShifts, error: shiftsError } = await supabase
    .from('actual_shifts')
    .select(`
      user_id,
      clock_in,
      location_id,
      locations (id, name)
    `)
    .is('clock_out', null)

  if (shiftsError) {
    return { error: shiftsError.message }
  }

  // Get today's scheduled shifts
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  const { data: scheduledShifts, error: schedError } = await supabase
    .from('scheduled_shifts')
    .select(`
      user_id,
      location_id,
      scheduled_start,
      scheduled_end,
      locations (id, name)
    `)
    .eq('business_date', today)

  if (schedError) {
    return { error: schedError.message }
  }

  // Group by user_id and get unique users
  const staffStatus = profiles?.map((profile: any) => {
    const currentShift = currentShifts?.find(cs => cs.user_id === profile.user_id)
    const todaySchedule = scheduledShifts?.filter(ss => ss.user_id === profile.user_id) || []
    const userLocationsList = userLocations.filter((ul: any) => ul.user_id === profile.user_id)
    
    // Check if user is within scheduled time
    const isWithinSchedule = todaySchedule.some(schedule => {
      return currentTime >= schedule.scheduled_start && currentTime <= schedule.scheduled_end
    })

    return {
      user_id: profile.user_id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      role: profile.role,
      is_active: profile.is_active,
      locations: userLocationsList.map((ul: any) => ul.locations),
      current_shift: currentShift,
      is_within_schedule: isWithinSchedule,
      today_schedule: todaySchedule,
    }
  }) || []

  return { data: staffStatus }
}

