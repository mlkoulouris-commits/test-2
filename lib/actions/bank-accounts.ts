'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BankAccount {
  id: number
  location_id: number
  account_name: string
  account_number: string | null
  bank_name: string | null
  currency: string
  is_active: boolean
  is_default: boolean
  account_type: 'bank' | 'cash' | 'pos'
  current_balance: number
  opening_balance: number
  opening_date: string
  location?: {
    id: number
    name: string
  }
}

export const getBankAccountsByLocation = async (locationId: string | number) => {
  const supabase = await createClient()
  const actualLocationId = typeof locationId === 'string' ? parseInt(locationId) : locationId
  
  const { data, error } = await supabase
    .from('bank_accounts')
    .select(`
      *,
      location:locations!bank_accounts_location_id_fkey (id, name)
    `)
    .eq('location_id', actualLocationId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('account_name', { ascending: true })
  
  if (error) {
    return { error: error.message }
  }
  
  return { data: data as BankAccount[] }
}

export const getAllBankAccounts = async () => {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('bank_accounts')
    .select(`
      *,
      location:locations!bank_accounts_location_id_fkey (id, name)
    `)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
  
  if (error) {
    return { error: error.message }
  }
  
  return { data: data as BankAccount[] }
}

export const createBankAccount = async (
  locationId: string | number,
  accountName: string,
  accountType: 'bank' | 'cash' | 'pos',
  currentBalance: number,
  accountNumber?: string,
  bankName?: string,
  currency?: string,
  isDefault?: boolean
) => {
  const actualLocationId = typeof locationId === 'string' ? parseInt(locationId) : locationId
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('bank_accounts')
    .insert({
      location_id: actualLocationId,
      account_name: accountName,
      account_type: accountType,
      current_balance: currentBalance,
      account_number: accountNumber,
      bank_name: bankName,
      currency: currency || 'BGN',
      is_default: isDefault || false,
    })
    .select()
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/admin/banks')
  return { data }
}

export const getDefaultBankAccount = async (locationId: string | number) => {
  const actualLocationId = typeof locationId === 'string' ? parseInt(locationId) : locationId
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('location_id', actualLocationId)
    .eq('is_active', true)
    .eq('is_default', true)
    .single()
  
  if (error) {
    // If no default, return first active account
    const { data: firstAccount } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('location_id', actualLocationId)
      .eq('is_active', true)
      .order('account_name', { ascending: true })
      .limit(1)
      .single()
    
    return { data: firstAccount }
  }
  
  return { data: data as BankAccount }
}

export const updateBankAccount = async (
  id: number,
  accountName: string,
  currentBalance: number,
  accountNumber?: string,
  bankName?: string,
  currency?: string,
  isDefault?: boolean
) => {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('bank_accounts')
    .update({
      account_name: accountName,
      current_balance: currentBalance,
      account_number: accountNumber,
      bank_name: bankName,
      currency: currency,
      is_default: isDefault,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/admin/banks')
  return { data }
}

export const toggleBankAccountStatus = async (id: number, isActive: boolean) => {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('bank_accounts')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/admin')
  return { success: true }
}

export const setDefaultBankAccount = async (id: number, locationId: string | number) => {
  const actualLocationId = typeof locationId === 'string' ? parseInt(locationId) : locationId
  const supabase = await createClient()
  
  // First, unset all defaults for this location
  await supabase
    .from('bank_accounts')
    .update({ is_default: false })
    .eq('location_id', actualLocationId)
  
  // Then set this one as default
  const { error } = await supabase
    .from('bank_accounts')
    .update({
      is_default: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/admin/banks')
  return { success: true }
}

export const deleteBankAccount = async (id: number) => {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('bank_accounts')
    .delete()
    .eq('id', id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/admin/banks')
  return { success: true }
}

export const getCashAccountByLocation = async (locationId: string | number) => {
  const actualLocationId = typeof locationId === 'string' ? parseInt(locationId) : locationId
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('location_id', actualLocationId)
    .eq('account_type', 'cash')
    .eq('is_active', true)
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  return { data: data as BankAccount }
}

export const getBankAccountById = async (id: number) => {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('bank_accounts')
    .select(`
      *,
      location:locations!bank_accounts_location_id_fkey (id, name)
    `)
    .eq('id', id)
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  return { data: data as BankAccount }
}

