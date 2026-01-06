'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export const getAllSkills = async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export const getUserSkills = async (userId: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_skills')
    .select(`
      skill_id,
      proficiency_level,
      skills (
        id,
        name,
        color
      )
    `)
    .eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export const assignSkillToUser = async (userId: string, skillId: number, proficiencyLevel: string) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('user_skills')
    .insert({
      user_id: userId,
      skill_id: skillId,
      proficiency_level: proficiencyLevel,
      assigned_by: user?.id || null,
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/users')
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export const removeSkillFromUser = async (userId: string, skillId: number) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_skills')
    .delete()
    .eq('user_id', userId)
    .eq('skill_id', skillId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/users')
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export const getScheduleWithSkills = async (locationId: number, startDate: string, endDate: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('scheduled_shifts')
    .select(`
      *,
      profiles!scheduled_shifts_user_id_fkey (
        user_id,
        first_name,
        last_name
      )
    `)
    .eq('location_id', locationId)
    .gte('business_date', startDate)
    .lte('business_date', endDate)
    .order('business_date')
    .order('scheduled_start')

  if (error) {
    console.error('getScheduleWithSkills error:', error)
    return { error: error.message }
  }

  if (!data || data.length === 0) {
    return { data: [] }
  }

  // Get all unique user IDs from shifts
  const userIds = [...new Set(data.map((shift: any) => shift.user_id))]
  
  // Get skill info for shifts that have skill_required set
  const shiftsWithSkills = data.filter((shift: any) => shift.skill_required !== null)
  const skillIds = [...new Set(shiftsWithSkills.map((shift: any) => shift.skill_required))]
  
  let skillsMap: Record<number, any> = {}
  
  if (skillIds.length > 0) {
    const { data: skillsData } = await supabase
      .from('skills')
      .select('id, name, color')
      .in('id', skillIds)
    
    if (skillsData) {
      skillsData.forEach((skill: any) => {
        skillsMap[skill.id] = skill
      })
    }
  }

  // Attach skills to shifts
  const dataWithSkills = data.map((shift: any) => ({
    ...shift,
    skills: shift.skill_required ? skillsMap[shift.skill_required] || null : null
  }))

  // Get user skills for all users in the shifts
  let userSkills: any[] = []
  
  if (userIds.length > 0) {
    const { data: skills } = await supabase
      .from('user_skills')
      .select(`
        user_id,
        skill_id,
        proficiency_level,
        skills (
          id,
          name,
          color
        )
      `)
      .in('user_id', userIds)
    
    userSkills = skills || []
  }

  // Attach user skills to shifts (empty array if user has no skills)
  const finalData = dataWithSkills.map((shift: any) => ({
    ...shift,
    user_skills: userSkills.filter((us: any) => us.user_id === shift.user_id)
  }))

  return { data: finalData }
}

