'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CreateLocationData {
  name: string
  brandId?: number
  categoryId?: number
  address?: string
  phone?: string
  hoursOfOperation?: Record<string, { open: string; close: string }>
}

export const createLocation = async (data: CreateLocationData) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: location, error } = await supabase
    .from('locations')
    .insert({
      name: data.name,
      brand_id: data.brandId,
      category_id: data.categoryId,
      address: data.address,
      phone: data.phone,
      hours_of_operation: data.hoursOfOperation,
      created_by: user?.id || null,
      updated_by: user?.id || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/locations')
  return { success: true, data: location }
}

export const getAllLocations = async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('locations')
    .select(`
      *,
      brands (id, name),
      location_categories (id, name)
    `)
    .order('name')

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export const getAllLocationCategories = async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('location_categories')
    .select('*')
    .order('name')

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export const getLocations = async () => {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })
  
  if (error) {
    return { error: error.message }
  }
  
  return { data }
}

export const toggleLocationStatus = async (id: number, isActive: boolean) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('locations')
    .update({
      is_active: isActive,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/locations')
  return { success: true }
}

