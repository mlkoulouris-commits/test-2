'use server'

import { createClient } from '@/lib/supabase/server'

export interface InvoiceLineItem {
  id: number
  barsy_article_id: number | null
  article_name: string | null
  quantity: number
  unit_price: number
  total_price: number
  amount_type: string | null
}

export interface Invoice {
  id: number
  barsy_location_id: string
  store_load_id: number
  doc_num: string | null
  doc_date: string | null
  supplier_name: string | null
  location_name: string | null
  total_sum: number
  total_paid: number
  status: number
  description: string | null
  paid_due_date: string | null
}

export async function getInvoices(barsyLocationId?: string, supplierName?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from('barsy_store_loads')
    .select(`
      *,
      barsy_locations!inner (name)
    `)
    .order('doc_date', { ascending: false })
  
  if (barsyLocationId) {
    query = query.eq('barsy_location_id', barsyLocationId)
  }
  
  if (supplierName) {
    query = query.eq('supplier_name', supplierName)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching invoices:', error)
    return []
  }
  
  return data.map(invoice => ({
    ...invoice,
    location_name: invoice.barsy_locations?.name || null,
  })) as Invoice[]
}

export async function getInvoiceLineItems(invoiceId: number) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('barsy_store_load_items')
    .select('*')
    .eq('store_load_id', invoiceId)
    .order('id', { ascending: true })
  
  if (error) {
    console.error('Error fetching invoice line items:', error)
    return []
  }
  
  return data as InvoiceLineItem[]
}

export async function getBarsyLocations() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('barsy_locations')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error fetching barsy locations:', error)
    return []
  }
  
  return data
}

export async function getSuppliers() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('barsy_store_loads')
    .select('supplier_name')
    .not('supplier_name', 'is', null)
    .order('supplier_name', { ascending: true })
  
  if (error) {
    console.error('Error fetching suppliers:', error)
    return []
  }
  
  // Get unique supplier names
  const uniqueSuppliers = [...new Set(data.map(item => item.supplier_name))]
  return uniqueSuppliers.map(name => ({ name }))
}

