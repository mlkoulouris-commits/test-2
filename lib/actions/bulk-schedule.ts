'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { addDays, format } from 'date-fns'

export interface CreateBulkScheduleData {
  userId: string
  locationId: number
  startTime: string
  endTime: string
  endsNextDay?: boolean
  startDate: string
  endDate?: string
  repeatPattern?: 'none' | 'daily' | 'weekly' | 'custom'
  repeatDays?: number[] // 0 = Sunday, 1 = Monday, etc.
}

export const createBulkSchedule = async (data: CreateBulkScheduleData) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is active
  const { data: profile, error: profileError } = await supabase
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

  const shifts: any[] = []

  // Helper to create timestamps
  const createTimestamps = (businessDate: string) => {
    const scheduledStart = `${businessDate}T${data.startTime}:00`
    let scheduledEnd = `${businessDate}T${data.endTime}:00`
    
    if (data.endsNextDay) {
      const endDate = new Date(businessDate)
      endDate.setDate(endDate.getDate() + 1)
      scheduledEnd = `${format(endDate, 'yyyy-MM-dd')}T${data.endTime}:00`
    }
    
    return { scheduledStart, scheduledEnd }
  }

  if (data.repeatPattern === 'none') {
    // Single day schedule
    const { scheduledStart, scheduledEnd } = createTimestamps(data.startDate)
    shifts.push({
      user_id: data.userId,
      location_id: data.locationId,
      business_date: data.startDate,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      created_by: user?.id || null,
    })
  } else if (data.repeatPattern === 'daily') {
    // Daily repeat
    if (!data.endDate) {
      return { error: 'End date is required for repeating schedules' }
    }

    let currentDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    while (currentDate <= endDate) {
      const businessDate = format(currentDate, 'yyyy-MM-dd')
      const { scheduledStart, scheduledEnd } = createTimestamps(businessDate)
      shifts.push({
        user_id: data.userId,
        location_id: data.locationId,
        business_date: businessDate,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: user?.id || null,
      })
      currentDate = addDays(currentDate, 1)
    }
  } else if (data.repeatPattern === 'weekly' || data.repeatPattern === 'custom') {
    // Weekly or custom days repeat
    if (!data.endDate || !data.repeatDays || data.repeatDays.length === 0) {
      return { error: 'End date and days are required for weekly/custom schedules' }
    }

    let currentDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay()
      if (data.repeatDays.includes(dayOfWeek)) {
        const businessDate = format(currentDate, 'yyyy-MM-dd')
        const { scheduledStart, scheduledEnd } = createTimestamps(businessDate)
        shifts.push({
          user_id: data.userId,
          location_id: data.locationId,
          business_date: businessDate,
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          created_by: user?.id || null,
        })
      }
      currentDate = addDays(currentDate, 1)
    }
  }

  if (shifts.length === 0) {
    return { error: 'No shifts were generated' }
  }

  // Check for time overlaps with existing shifts
  const overlapChecks = await Promise.all(
    shifts.map(async (shift) => {
      const { data: existingShifts } = await supabase
        .from('scheduled_shifts')
        .select('id, scheduled_start, scheduled_end, business_date, locations(name)')
        .eq('user_id', data.userId)
        .or(`and(scheduled_start.lt.${shift.scheduled_end},scheduled_end.gt.${shift.scheduled_start})`)
      
      return { shift, conflicts: existingShifts || [] }
    })
  )

  const conflicts = overlapChecks.filter(check => check.conflicts.length > 0)
  if (conflicts.length > 0) {
    const conflictDates = conflicts.map(c => c.shift.business_date).join(', ')
    const firstConflict = conflicts[0].conflicts[0] as any
    const conflictLocation = firstConflict.locations?.name || 'another location'
    return { error: `User has overlapping shifts at ${conflictLocation} on: ${conflictDates}` }
  }

  // Insert all shifts
  const { error: insertError } = await supabase
    .from('scheduled_shifts')
    .insert(shifts)

  if (insertError) {
    return { error: insertError.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true, count: shifts.length }
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

export const getStaffForLocation = async (locationId: number) => {
  const supabase = await createClient()

  const { data: userLocations, error } = await supabase
    .from('user_locations')
    .select('user_id')
    .eq('location_id', locationId)

  if (error || !userLocations || userLocations.length === 0) {
    return { data: [] }
  }

  const userIds = userLocations.map(ul => ul.user_id)

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, role, is_active')
    .in('user_id', userIds)
    .eq('is_active', true)
    .order('first_name')

  if (profilesError) {
    return { error: profilesError.message }
  }

  return { data: profiles || [] }
}

