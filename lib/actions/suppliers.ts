'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Supplier {
  id: number
  barsy_location_id: string
  supplier_id: number
  supplier_name: string
  bulstat: string | null
  vat_number: string | null
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  contact_person: string | null
  is_active: boolean
  payment_terms_days: number | null
  vendor_id: number | null
  location_name?: string
  vendor_name?: string
}

export const getAllSuppliers = async (options?: {
  page?: number
  pageSize?: number
  search?: string
  locationId?: string
  linkedStatus?: 'all' | 'linked' | 'unlinked'
}) => {
  const supabase = await createClient()
  const page = options?.page || 1
  const pageSize = options?.pageSize || 10
  const search = options?.search?.trim()
  const locationId = options?.locationId
  const linkedStatus = options?.linkedStatus || 'all'

  let countQuery = supabase
    .from('barsy_suppliers')
    .select('*', { count: 'exact', head: true })

  let dataQuery = supabase
    .from('barsy_suppliers')
    .select(`
      *,
      barsy_locations!barsy_suppliers_barsy_location_id_fkey (name),
      vendors!barsy_suppliers_vendor_id_fkey (name)
    `)
    .order('supplier_name')

  // Apply search filter
  if (search) {
    countQuery = countQuery.or(`supplier_name.ilike.%${search}%,contact_person.ilike.%${search}%,bulstat.ilike.%${search}%`)
    dataQuery = dataQuery.or(`supplier_name.ilike.%${search}%,contact_person.ilike.%${search}%,bulstat.ilike.%${search}%`)
  }

  // Apply location filter
  if (locationId) {
    countQuery = countQuery.eq('barsy_location_id', locationId)
    dataQuery = dataQuery.eq('barsy_location_id', locationId)
  }

  // Apply linked status filter
  if (linkedStatus === 'linked') {
    countQuery = countQuery.not('vendor_id', 'is', null)
    dataQuery = dataQuery.not('vendor_id', 'is', null)
  } else if (linkedStatus === 'unlinked') {
    countQuery = countQuery.is('vendor_id', null)
    dataQuery = dataQuery.is('vendor_id', null)
  }

  // Get total count
  const { count, error: countError } = await countQuery

  if (countError) {
    return { error: countError.message }
  }

  // Get paginated data
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error } = await dataQuery.range(from, to)

  if (error) {
    return { error: error.message }
  }

  const suppliers: Supplier[] = data.map((s: any) => ({
    id: s.id,
    barsy_location_id: s.barsy_location_id,
    supplier_id: s.supplier_id,
    supplier_name: s.supplier_name,
    bulstat: s.bulstat,
    vat_number: s.vat_number,
    address: s.address,
    city: s.city,
    phone: s.phone,
    email: s.email,
    contact_person: s.contact_person,
    is_active: s.is_active,
    payment_terms_days: s.payment_terms_days,
    vendor_id: s.vendor_id,
    location_name: s.barsy_locations?.name,
    vendor_name: s.vendors?.name,
  }))

  return { data: suppliers, total: count || 0 }
}

export const getSupplierLocations = async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('barsy_locations')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export const searchVendors = async (search?: string) => {
  const supabase = await createClient()

  let query = supabase
    .from('vendors')
    .select('id, name, contact_name, contact_email')
    .eq('is_active', true)
    .order('name')
    .limit(50)

  // Apply search filter if provided
  if (search && search.length >= 2) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export const linkSuppliersToVendor = async (supplierIds: number[], vendorId: number) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('barsy_suppliers')
    .update({
      vendor_id: vendorId,
      updated_at: new Date().toISOString(),
    })
    .in('id', supplierIds)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/suppliers')
  revalidatePath('/admin/vendors')
  return { success: true }
}

export const unlinkSupplier = async (supplierId: number) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from('barsy_suppliers')
    .update({
      vendor_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', supplierId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/suppliers')
  revalidatePath('/admin/vendors')
  return { success: true }
}

export const createVendorFromSupplier = async (supplierId: number) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get supplier data
  const { data: supplier, error: fetchError } = await supabase
    .from('barsy_suppliers')
    .select('*')
    .eq('id', supplierId)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  // Create vendor
  const { data: vendor, error: createError } = await supabase
    .from('vendors')
    .insert({
      name: supplier.supplier_name,
      tax_id: supplier.bulstat ? parseInt(supplier.bulstat) : null,
      vat_number: supplier.vat_number,
      address: supplier.address,
      city: supplier.city,
      contact_name: supplier.contact_person,
      contact_phone: supplier.phone,
      contact_email: supplier.email,
      payment_terms: supplier.payment_terms_days ? `${supplier.payment_terms_days} days` : null,
      notes: `Created from supplier #${supplier.supplier_id}`,
      created_by: user?.id || null,
      updated_by: user?.id || null,
    })
    .select()
    .single()

  if (createError) {
    return { error: createError.message }
  }

  // Link supplier to new vendor
  const { error: linkError } = await supabase
    .from('barsy_suppliers')
    .update({
      vendor_id: vendor.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', supplierId)

  if (linkError) {
    return { error: linkError.message }
  }

  revalidatePath('/admin/suppliers')
  revalidatePath('/admin/vendors')
  return { success: true, data: vendor }
}

