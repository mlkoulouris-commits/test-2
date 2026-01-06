'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getBusinessDate } from '@/lib/utils/business-date'

export interface TransactionLineItem {
  productId: number
  quantity: number
  unitPrice: number
}

export interface CreateTransactionData {
  locationId: number
  paymentMethod: 'cash' | 'card' | 'invoice' | 'comp'
  lineItems: TransactionLineItem[]
  taxAmount?: number
  tipAmount?: number
  isComp?: boolean
  compReason?: string
  compApprovedBy?: string
  transactionNumber?: string
}

export const createTransaction = async (data: CreateTransactionData) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Calculate total from line items
  const subtotal = data.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  const totalAmount = subtotal + (data.taxAmount || 0) + (data.tipAmount || 0)

  // Determine business date
  const now = new Date()
  const businessDate = getBusinessDate(now)

  // Create transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      location_id: data.locationId,
      business_date: businessDate,
      actual_timestamp: now.toISOString(),
      transaction_number: data.transactionNumber,
      total_amount: totalAmount,
      tax_amount: data.taxAmount,
      tip_amount: data.tipAmount,
      payment_method: data.paymentMethod,
      is_comp: data.isComp || false,
      comp_reason: data.compReason,
      comp_approved_by: data.compApprovedBy,
      created_by: user.id,
    })
    .select()
    .single()

  if (txError) {
    return { error: txError.message }
  }

  // Create line items
  const lineItemsData = data.lineItems.map(item => ({
    transaction_id: transaction.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.quantity * item.unitPrice,
  }))

  const { error: lineItemsError } = await supabase
    .from('transaction_line_items')
    .insert(lineItemsData)

  if (lineItemsError) {
    return { error: lineItemsError.message }
  }

  revalidatePath('/admin/transactions')
  return { success: true, transaction }
}

export const getTransactions = async (locationId?: number, limit: number = 50) => {
  const supabase = await createClient()

  let query = supabase
    .from('transactions')
    .select(`
      *,
      locations (id, name),
      transaction_line_items (
        *,
        products (id, name, sku)
      )
    `)
    .order('actual_timestamp', { ascending: false })
    .limit(limit)

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  return { data: data || [] }
}

export const getTransactionStats = async (businessDate?: string) => {
  const supabase = await createClient()

  let query = supabase
    .from('transactions')
    .select('total_amount, payment_method, is_comp')

  if (businessDate) {
    query = query.eq('business_date', businessDate)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  const stats = {
    totalTransactions: data.length,
    totalRevenue: data.reduce((sum, t) => sum + Number(t.total_amount), 0),
    compTransactions: data.filter(t => t.is_comp).length,
    compValue: data.filter(t => t.is_comp).reduce((sum, t) => sum + Number(t.total_amount), 0),
    byPaymentMethod: {
      cash: data.filter(t => t.payment_method === 'cash').length,
      card: data.filter(t => t.payment_method === 'card').length,
      invoice: data.filter(t => t.payment_method === 'invoice').length,
      comp: data.filter(t => t.payment_method === 'comp').length,
    }
  }

  return { data: stats }
}
