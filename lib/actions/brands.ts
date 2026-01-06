'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CreateBrandData {
  name: string
  description?: string
}

export const createBrand = async (data: CreateBrandData) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: brand, error } = await supabase
    .from('brands')
    .insert({
      name: data.name,
      description: data.description,
      created_by: user?.id || null,
      updated_by: user?.id || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/brands')
  return { success: true, data: brand }
}

export const getAllBrands = async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('name')

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export const updateBrand = async (id: number, data: CreateBrandData) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('brands')
    .update({
      name: data.name,
      description: data.description,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/brands')
  return { success: true }
}

export const toggleBrandStatus = async (id: number, isActive: boolean) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('brands')
    .update({
      is_active: isActive,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/brands')
  return { success: true }
}

