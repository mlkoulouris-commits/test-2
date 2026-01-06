'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessDate } from '@/lib/utils/business-date'

export const getAllUsersWithStatus = async () => {
  const supabase = await createClient()

  // Get profiles first
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (profilesError) {
    return { error: profilesError.message }
  }

  // Get emails from auth.users
  const userIds = profiles.map(p => p.user_id)
  const { data: authUsers, error: authError } = await supabase
    .from('auth.users')
    .select('id, email')
    .in('id', userIds)

  // Fallback: Use admin API if direct query fails
  let emailMap: Record<string, string> = {}
  if (authError || !authUsers) {
    // Fetch from admin endpoint
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      })
      const data = await response.json()
      if (data.users) {
        emailMap = data.users.reduce((acc: Record<string, string>, user: any) => {
          acc[user.id] = user.email
          return acc
        }, {})
      }
    } catch (err) {
      console.error('Failed to fetch auth users', err)
    }
  } else {
    emailMap = authUsers.reduce((acc, user) => {
      acc[user.id] = user.email
      return acc
    }, {} as Record<string, string>)
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

  // Get current shifts (clocked in)
  const { data: currentShifts, error: shiftsError } = await supabase
    .from('actual_shifts')
    .select(`
      user_id,
      location_id,
      clock_in,
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
  const data = profiles.map(profile => {
    const locations = userLocations?.filter(ul => ul.user_id === profile.user_id) || []
    const currentShift = currentShifts?.find(cs => cs.user_id === profile.user_id)
    const todaySchedule = scheduledShifts?.filter(ss => ss.user_id === profile.user_id) || []
    
    // Check if user is within scheduled time
    const isWithinSchedule = todaySchedule.some(schedule => {
      return currentTime >= schedule.scheduled_start && currentTime <= schedule.scheduled_end
    })

    return {
      ...profile,
      email: emailMap[profile.user_id] || '',
      user_locations: locations,
      current_shift: currentShift,
      is_within_schedule: isWithinSchedule,
      today_schedule: todaySchedule,
    }
  })

  return { data }
}

