'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export const createSkill = async (data: {
  name: string
  description?: string
  color: string
}) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('skills')
    .insert({
      name: data.name,
      description: data.description,
      color: data.color,
      created_by: user?.id || null,
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/skills')
  return { success: true }
}

export const updateSkill = async (id: number, data: {
  name?: string
  description?: string
  color?: string
  is_active?: boolean
}) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from('skills')
    .update(data)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/skills')
  return { success: true }
}

export const deleteSkill = async (id: number) => {
  const supabase = await createClient()

  // Check if skill is in use
  const { data: usageCheck } = await supabase
    .from('user_skills')
    .select('user_id')
    .eq('skill_id', id)
    .limit(1)

  if (usageCheck && usageCheck.length > 0) {
    return { error: 'Cannot delete skill that is assigned to users. Deactivate it instead.' }
  }

  const { error } = await supabase
    .from('skills')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/skills')
  return { success: true }
}

export const getAllSkillsAdmin = async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('name')

  if (error) {
    return { error: error.message }
  }

  return { data }
}













