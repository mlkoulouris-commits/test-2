'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getBusinessDate } from '@/lib/utils/business-date'

export interface DailySalesData {
  locationId: number
  businessDate: string
  cashAmount: number
  cashTips?: number
  cardTips?: number
}

export interface CardSaleData {
  dailySalesId: number
  terminalId: number
  amount: number
  businessDate: string
}

export const createOrUpdateDailySales = async (data: DailySalesData) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check if entry exists
  const { data: existing } = await supabase
    .from('daily_sales')
    .select('id')
    .eq('location_id', data.locationId)
    .eq('business_date', data.businessDate)
    .single()

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('daily_sales')
      .update({
        cash_amount: data.cashAmount,
        cash_tips: data.cashTips,
        card_tips: data.cardTips,
        is_cash_edited: true,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', existing.id)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/sales')
    return { success: true, id: existing.id }
  } else {
    // Create new
    const { data: created, error } = await supabase
      .from('daily_sales')
      .insert({
        location_id: data.locationId,
        business_date: data.businessDate,
        cash_amount: data.cashAmount,
        cash_tips: data.cashTips,
        card_tips: data.cardTips,
        actual_timestamp: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { error: error.message }
    revalidatePath('/dashboard/sales')
    return { success: true, id: created.id }
  }
}

export const createCardSale = async (data: CardSaleData) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('card_sales')
    .insert({
      daily_sales_id: data.dailySalesId,
      terminal_id: data.terminalId,
      amount: data.amount,
      business_date: data.businessDate,
      actual_timestamp: new Date().toISOString(),
      created_by: user.id,
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/sales')
  return { success: true }
}

export const getDailySales = async (locationId: number, businessDate: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('daily_sales')
    .select(`
      *,
      card_sales (
        *,
        card_terminals (id, terminal_name)
      )
    `)
    .eq('location_id', locationId)
    .eq('business_date', businessDate)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { error: error.message }
  }

  return { data: data || null }
}

export const getSalesHistory = async (locationId?: number, limit: number = 30) => {
  const supabase = await createClient()

  let query = supabase
    .from('daily_sales')
    .select(`
      *,
      locations (id, name),
      card_sales (amount)
    `)
    .order('business_date', { ascending: false })
    .limit(limit)

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data, error } = await query

  if (error) return { error: error.message }

  // Calculate totals
  const enriched = data.map(sale => ({
    ...sale,
    total_card: sale.card_sales?.reduce((sum: number, cs: any) => sum + Number(cs.amount), 0) || 0,
    total: Number(sale.cash_amount) + (sale.card_sales?.reduce((sum: number, cs: any) => sum + Number(cs.amount), 0) || 0),
  }))

  return { data: enriched }
}

export const getCardTerminals = async (locationId: number) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('card_terminals')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('terminal_name')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export const createCardTerminal = async (locationId: number, name: string, terminalId: string) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('card_terminals')
    .insert({
      location_id: locationId,
      terminal_name: name,
      terminal_id: terminalId,
      created_by: user.id,
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/sales')
  return { success: true }
}

