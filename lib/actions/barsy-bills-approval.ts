'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const parseNullableFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const parseFiniteNumber = (value: unknown): number => parseNullableFiniteNumber(value) ?? 0

export interface BarsyBill {
  id: number
  store_load_id: number
  barsy_location_id: string
  supplier_id: number | null
  supplier_name: string | null
  vendor_id: number | null
  vendor_name: string | null
  location_name: string | null
  doc_num: string | null
  doc_date: string | null
  total_sum: number
  total_sum_net?: number | null
  total_sum_gross?: number | null
  has_vat?: boolean
  vat_rate?: number | null
  vat_amount?: number | null
  paid_due_date: string | null
  description: string | null
  status: number
  created_at: string
}

// Get Barsy bills (pending or approved)
export const getPendingBarsyBills = async (filters?: {
  /**
   * Memento location id (from `locations.id`) coming from the UI filter.
   * This is NOT the same as `barsy_store_loads.barsy_location_id` (Barsy id).
   */
  locationId?: number | string
  vendorId?: number
  showApproved?: boolean
  showUnlinkedOnly?: boolean
  showRejected?: boolean
}) => {
  const supabase = await createClient()

  let query = supabase
    .from('barsy_store_loads')
    .select(`
      id,
      store_load_id,
      barsy_location_id,
      supplier_id,
      supplier_name,
      vendor_id,
      doc_num,
      doc_date,
      total_sum,
      total_sum_net,
      total_sum_gross,
      has_vat,
      vat_rate,
      vat_amount,
      paid_due_date,
      description,
      status,
      created_at,
      barsy_locations!barsy_store_loads_barsy_location_id_fkey (name),
      vendors!barsy_store_loads_vendor_id_fkey (name)
    `)
    .order('doc_date', { ascending: false })

  // Filter by status
  if (filters?.showRejected) {
    query = query.eq('status', -1) // Show only rejected/voided
  } else {
    query = query.neq('status', -1) // Exclude voided
  }

  if (filters?.locationId !== undefined && filters?.locationId !== null && `${filters.locationId}`.trim()) {
    const parsedMementoLocationId =
      typeof filters.locationId === 'string'
        ? Number.parseInt(filters.locationId, 10)
        : filters.locationId

    if (Number.isFinite(parsedMementoLocationId)) {
      const { data: barsyLocations, error: barsyLocationsError } = await supabase
        .from('barsy_locations')
        .select('id')
        .eq('memento_location_id', parsedMementoLocationId)

      if (barsyLocationsError) {
        return { error: barsyLocationsError.message }
      }

      const barsyLocationIds = (barsyLocations || [])
        .map((l) => (l as { id?: unknown }).id)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)

      if (barsyLocationIds.length === 0) {
        return { data: [] as BarsyBill[] }
      }

      query = query.in('barsy_location_id', barsyLocationIds)
    }
  }

  if (filters?.vendorId) {
    query = query.eq('vendor_id', filters.vendorId)
  }

  if (filters?.showUnlinkedOnly) {
    query = query.is('vendor_id', null)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  // Get approved bills mapping
  const billIds = data.map(b => b.id)

  const { data: existingBills } = await supabase
    .from('bills')
    .select('barsy_store_load_id, id, status, approved_at, approved_by')
    .in('barsy_store_load_id', billIds)

  const approvedMap = new Map(
    existingBills?.map(b => [b.barsy_store_load_id, {
      billId: b.id,
      billStatus: b.status,
      approvedAt: b.approved_at,
      approvedBy: b.approved_by
    }]) || []
  )

  // Filter based on showApproved flag
  const filteredData = filters?.showApproved
    ? data.filter(bill => approvedMap.has(bill.id)) // Show only approved
    : data.filter(bill => !approvedMap.has(bill.id)) // Show only pending

  const barsyBills: BarsyBill[] = filteredData.map(bill => ({
    id: bill.id,
    store_load_id: bill.store_load_id,
    barsy_location_id: bill.barsy_location_id,
    supplier_id: bill.supplier_id,
    supplier_name: bill.supplier_name,
    vendor_id: bill.vendor_id,
    vendor_name:
      (Array.isArray((bill as any).vendors)
        ? (bill as any).vendors[0]?.name
        : (bill as any).vendors?.name) || bill.supplier_name,
    location_name:
      (Array.isArray((bill as any).barsy_locations)
        ? (bill as any).barsy_locations[0]?.name || null
        : (bill as any).barsy_locations?.name || null),
    doc_num: bill.doc_num,
    doc_date: bill.doc_date,
    total_sum: Number(bill.total_sum || 0),
    total_sum_net: parseNullableFiniteNumber((bill as { total_sum_net?: unknown }).total_sum_net),
    total_sum_gross: parseNullableFiniteNumber((bill as { total_sum_gross?: unknown }).total_sum_gross),
    has_vat: (bill as { has_vat?: unknown }).has_vat === true,
    vat_rate: parseNullableFiniteNumber((bill as { vat_rate?: unknown }).vat_rate),
    vat_amount: parseNullableFiniteNumber((bill as { vat_amount?: unknown }).vat_amount),
    paid_due_date: bill.paid_due_date,
    description: bill.description,
    status: bill.status,
    created_at: bill.created_at,
  }))

  return { data: barsyBills }
}

// Get line items for a Barsy bill (from barsy_store_load_items)
export const getBarsyBillItems = async (barsyStoreLoadId: number) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('barsy_store_load_items')
    .select('*')
    .eq('store_load_id', barsyStoreLoadId)
    .order('id', { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

// Get count of pending Barsy bills
export const getPendingBarsyBillsCount = async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('barsy_store_loads')
    .select('id')
    .neq('status', -1) // Exclude voided

  if (error) {
    return { count: 0 }
  }

  // Filter out bills that are already in the bills table
  const billIds = data.map(b => b.id)

  if (billIds.length === 0) {
    return { count: 0 }
  }

  const { data: existingBills } = await supabase
    .from('bills')
    .select('barsy_store_load_id')
    .in('barsy_store_load_id', billIds)

  const existingIds = new Set(existingBills?.map(b => b.barsy_store_load_id) || [])
  const pendingCount = data.filter(bill => !existingIds.has(bill.id)).length

  return { count: pendingCount }
}

// Approve a Barsy bill - copies it to bills table
export const approveBarsyBill = async (barsyStoreLoadId: number) => {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get user profile for full name
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user?.id)
    .single()

  const approvedByName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : user?.email

  // Get the Barsy bill with location mapping
  const { data: barsyBill, error: fetchError } = await supabase
    .from('barsy_store_loads')
    .select(`
      id,
      store_load_id,
      barsy_location_id,
      supplier_id,
      supplier_name,
      vendor_id,
      doc_num,
      doc_date,
      total_sum,
      total_sum_net,
      has_vat,
      vat_rate,
      vat_amount,
      paid_due_date,
      description,
      status,
      barsy_locations!barsy_store_loads_barsy_location_id_fkey (
        memento_location_id
      )
    `)
    .eq('id', barsyStoreLoadId)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  // Get the memento location ID
  const mementoLocationId = (barsyBill.barsy_locations as any)?.memento_location_id

  if (!mementoLocationId) {
    return { error: 'Cannot approve bill: Barsy location not linked to Memento location' }
  }

  // Check if already approved
  const { data: existing } = await supabase
    .from('bills')
    .select('id')
    .eq('barsy_store_load_id', barsyStoreLoadId)
    .single()

  if (existing) {
    return { error: 'Bill already approved' }
  }

  // Ensure vendor_id is set
  let vendorId = barsyBill.vendor_id

  if (!vendorId && barsyBill.supplier_name) {
    // Try to find vendor by supplier name
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .ilike('name', barsyBill.supplier_name)
      .single()

    vendorId = vendor?.id
  }

  if (!vendorId) {
    return { error: 'Cannot approve bill without a vendor. Please link supplier to vendor first.' }
  }

  // Create bill in bills table
  const totalAmountNet =
    parseNullableFiniteNumber((barsyBill as { total_sum_net?: unknown }).total_sum_net) ??
    parseFiniteNumber(barsyBill.total_sum)

  const hasVat = (barsyBill as { has_vat?: unknown }).has_vat === true
  const vatRate = parseNullableFiniteNumber((barsyBill as { vat_rate?: unknown }).vat_rate)
  const vatAmount = parseNullableFiniteNumber((barsyBill as { vat_amount?: unknown }).vat_amount)

  const { data: bill, error: billError } = await supabase
    .from('bills')
    .insert({
      source: 'barsy',
      barsy_store_load_id: barsyStoreLoadId,
      location_id: mementoLocationId,
      vendor_id: vendorId,
      doc_num: barsyBill.doc_num,
      doc_date: barsyBill.doc_date,
      due_date: barsyBill.paid_due_date,
      total_amount: totalAmountNet,
      has_vat: hasVat,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_paid: 0,
      status: 'approved',
      description: barsyBill.description,
      created_by: approvedByName,
      approved_by: approvedByName,
      approved_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (billError) {
    return { error: billError.message }
  }

  // Copy line items
  const { data: items } = await supabase
    .from('barsy_store_load_items')
    .select('*')
    .eq('store_load_id', barsyStoreLoadId)

  if (items && items.length > 0) {
    const billItems = items.map(item => ({
      bill_id: bill.id,
      barsy_article_id: item.barsy_article_id,
      article_name: item.article_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      amount_type: item.amount_type,
      vat_rate: item.vat_rate ?? null,
      vat_amount: item.vat_amount ?? null,
    }))

    const { error: itemsError } = await supabase
      .from('bill_items')
      .insert(billItems)

    if (itemsError) {
      // Rollback bill if items fail
      await supabase.from('bills').delete().eq('id', bill.id)
      return { error: itemsError.message }
    }
  }

  revalidatePath('/admin/barsy-bills')
  revalidatePath('/admin/bills')
  return { success: true, billId: bill.id }
}

// Bulk approve multiple bills
export const bulkApproveBarsyBills = async (barsyStoreLoadIds: number[]) => {
  const results = {
    success: [] as number[],
    failed: [] as { id: number; error: string }[],
  }

  for (const id of barsyStoreLoadIds) {
    const result = await approveBarsyBill(id)
    if (result.success) {
      results.success.push(id)
    } else {
      results.failed.push({ id, error: result.error || 'Unknown error' })
    }
  }

  revalidatePath('/admin/barsy-bills')
  revalidatePath('/admin/bills')

  return { data: results }
}

// Reject a Barsy bill - marks it as voided in barsy_store_loads
export const rejectBarsyBill = async (barsyStoreLoadId: number, reason?: string) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from('barsy_store_loads')
    .update({
      status: -1, // Voided
      description: reason ? `REJECTED: ${reason}` : 'REJECTED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', barsyStoreLoadId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/barsy-bills')
  return { success: true }
}
