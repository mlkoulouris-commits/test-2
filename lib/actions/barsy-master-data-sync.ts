'use server'

import { createClient } from '@/lib/supabase/server'
import { createBarsyClient } from '@/lib/services/barsy-api'

/**
 * Sync Suppliers from Barsy
 */
export const syncBarsySuppliers = async (barsyLocationId: string) => {
  const supabase = await createClient()

  // Get Barsy location config with memento location mapping
  const { data: location } = await supabase
    .from('barsy_locations')
    .select('*, memento_location_id')
    .eq('id', barsyLocationId)
    .single()

  if (!location) {
    return { error: 'Barsy location not found' }
  }

  if (!location.memento_location_id) {
    return { error: 'Barsy location not mapped to a memento location' }
  }

  const client = createBarsyClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  })

  const response = await client.getSuppliers()

  if (!response.success || !response.data) {
    return { error: response.error || 'Failed to fetch suppliers' }
  }

  const suppliers = (response.data as any).Suppliers_getlist || []
  let syncedCount = 0

  for (const supplier of suppliers) {
    const { error } = await supabase
      .from('barsy_suppliers')
      .upsert({
        barsy_location_id: barsyLocationId,
        location_id: location.memento_location_id,
        supplier_id: supplier.supplier_id,
        supplier_name: supplier.supplier_name || supplier.name,
        bulstat: supplier.bulstat,
        vat_number: supplier.vat_number,
        address: supplier.address,
        city: supplier.city,
        phone: supplier.phone,
        email: supplier.email,
        contact_person: supplier.contact_person,
        is_active: supplier.is_active ?? true,
        payment_terms_days: supplier.payment_terms_days,
        raw_data: supplier,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'barsy_location_id,supplier_id'
      })

    if (!error) syncedCount++
  }

  await updateSyncStatus(supabase, barsyLocationId, 'suppliers', syncedCount)

  return { success: true, count: syncedCount }
}

/**
 * Sync Depots/Warehouses from Barsy
 */
export const syncBarsyDepots = async (barsyLocationId: string) => {
  const supabase = await createClient()

  const { data: location } = await supabase
    .from('barsy_locations')
    .select('*')
    .eq('id', barsyLocationId)
    .single()

  if (!location) {
    return { error: 'Barsy location not found' }
  }

  const client = createBarsyClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  })

  const response = await client.getDepots()

  if (!response.success || !response.data) {
    return { error: response.error || 'Failed to fetch depots' }
  }

  const depots = (response.data as any).Depots_getlist || []
  let syncedCount = 0

  for (const depot of depots) {
    const { error } = await supabase
      .from('barsy_depots')
      .upsert({
        barsy_location_id: barsyLocationId,
        depot_id: depot.depot_id,
        depot_name: depot.depot_name || depot.name,
        barsy_id: depot.barsy_id,
        is_active: depot.is_active ?? true,
        is_default: depot.is_default ?? false,
        description: depot.description,
        raw_data: depot,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'barsy_location_id,depot_id'
      })

    if (!error) syncedCount++
  }

  await updateSyncStatus(supabase, barsyLocationId, 'depots', syncedCount)

  return { success: true, count: syncedCount }
}

/**
 * Sync Places (Tables/Areas) from Barsy
 */
export const syncBarsyPlaces = async (barsyLocationId: string) => {
  const supabase = await createClient()

  const { data: location } = await supabase
    .from('barsy_locations')
    .select('*')
    .eq('id', barsyLocationId)
    .single()

  if (!location) {
    return { error: 'Barsy location not found' }
  }

  const client = createBarsyClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  })

  const response = await client.getPlaces()

  if (!response.success || !response.data) {
    return { error: response.error || 'Failed to fetch places' }
  }

  const places = (response.data as any).Places_getlist || []
  let syncedCount = 0

  for (const place of places) {
    const { error } = await supabase
      .from('barsy_places')
      .upsert({
        barsy_location_id: barsyLocationId,
        place_id: place.place_id,
        place_name: place.place_name || place.name,
        place_number: place.place_number,
        barsy_id: place.barsy_id,
        place_type: place.place_type,
        capacity: place.capacity,
        is_active: place.is_active ?? true,
        position_x: place.position_x,
        position_y: place.position_y,
        raw_data: place,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'barsy_location_id,place_id'
      })

    if (!error) syncedCount++
  }

  await updateSyncStatus(supabase, barsyLocationId, 'places', syncedCount)

  return { success: true, count: syncedCount }
}

/**
 * Sync POSes (Cash Registers) from Barsy
 */
export const syncBarsyPoses = async (barsyLocationId: string) => {
  const supabase = await createClient()

  const { data: location } = await supabase
    .from('barsy_locations')
    .select('*')
    .eq('id', barsyLocationId)
    .single()

  if (!location) {
    return { error: 'Barsy location not found' }
  }

  const client = createBarsyClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  })

  const response = await client.getPoses()

  if (!response.success || !response.data) {
    return { error: response.error || 'Failed to fetch poses' }
  }

  const poses = (response.data as any).Poses_getlist || []
  let syncedCount = 0

  for (const pos of poses) {
    const { error } = await supabase
      .from('barsy_poses')
      .upsert({
        barsy_location_id: barsyLocationId,
        pos_id: pos.pos_id,
        pos_name: pos.pos_name || pos.name,
        barsy_id: pos.barsy_id,
        device_id: pos.device_id,
        is_active: pos.is_active ?? true,
        is_fiscal: pos.is_fiscal ?? false,
        raw_data: pos,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'barsy_location_id,pos_id'
      })

    if (!error) syncedCount++
  }

  await updateSyncStatus(supabase, barsyLocationId, 'poses', syncedCount)

  return { success: true, count: syncedCount }
}

/**
 * Sync Payment Methods from Barsy
 */
export const syncBarsyPaymentMethods = async (barsyLocationId: string) => {
  const supabase = await createClient()

  const { data: location } = await supabase
    .from('barsy_locations')
    .select('*')
    .eq('id', barsyLocationId)
    .single()

  if (!location) {
    return { error: 'Barsy location not found' }
  }

  const client = createBarsyClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  })

  const response = await client.getPaymentMethods()

  if (!response.success || !response.data) {
    return { error: response.error || 'Failed to fetch payment methods' }
  }

  const methods = (response.data as any).Paymentmethods_getlist || []
  let syncedCount = 0

  for (const method of methods) {
    const { error } = await supabase
      .from('barsy_payment_methods')
      .upsert({
        barsy_location_id: barsyLocationId,
        paymethod_id: method.paymethod_id,
        paymethod_name: method.paymethod_name || method.name,
        paymethod_type: method.paymethod_type,
        is_active: method.is_active ?? true,
        raw_data: method,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'barsy_location_id,paymethod_id'
      })

    if (!error) syncedCount++
  }

  await updateSyncStatus(supabase, barsyLocationId, 'payment_methods', syncedCount)

  return { success: true, count: syncedCount }
}

/**
 * Sync Tax Groups from Barsy
 */
export const syncBarsyTaxGroups = async (barsyLocationId: string) => {
  const supabase = await createClient()

  const { data: location } = await supabase
    .from('barsy_locations')
    .select('*')
    .eq('id', barsyLocationId)
    .single()

  if (!location) {
    return { error: 'Barsy location not found' }
  }

  const client = createBarsyClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  })

  const response = await client.getTaxGroups()

  if (!response.success || !response.data) {
    return { error: response.error || 'Failed to fetch tax groups' }
  }

  const taxGroups = (response.data as any).Taxgroups_getlist || []
  let syncedCount = 0

  for (const group of taxGroups) {
    const { error } = await supabase
      .from('barsy_tax_groups')
      .upsert({
        barsy_location_id: barsyLocationId,
        tax_group_id: group.tax_group_id,
        tax_group_name: group.tax_group_name || group.name,
        tax_rate: group.tax_rate,
        is_default: group.is_default ?? false,
        raw_data: group,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'barsy_location_id,tax_group_id'
      })

    if (!error) syncedCount++
  }

  await updateSyncStatus(supabase, barsyLocationId, 'tax_groups', syncedCount)

  return { success: true, count: syncedCount }
}

/**
 * Sync all master data at once
 */
export const syncAllBarsyMasterData = async (barsyLocationId: string) => {
  const results: any = {}

  results.suppliers = await syncBarsySuppliers(barsyLocationId)
  results.depots = await syncBarsyDepots(barsyLocationId)
  results.places = await syncBarsyPlaces(barsyLocationId)
  results.poses = await syncBarsyPoses(barsyLocationId)
  results.paymentMethods = await syncBarsyPaymentMethods(barsyLocationId)
  results.taxGroups = await syncBarsyTaxGroups(barsyLocationId)

  return { success: true, results }
}

/**
 * OPTIMIZED: Sync all master data in parallel
 * Uses Promise.all for concurrent processing - ~5x faster
 */
export const syncAllBarsyMasterDataParallel = async (barsyLocationId: string) => {
  const startTime = Date.now()
  console.log(`🚀 Syncing all master data in parallel for location: ${barsyLocationId}`)

  const [suppliers, depots, places, poses, paymentMethods, taxGroups] = await Promise.all([
    syncBarsySuppliers(barsyLocationId),
    syncBarsyDepots(barsyLocationId),
    syncBarsyPlaces(barsyLocationId),
    syncBarsyPoses(barsyLocationId),
    syncBarsyPaymentMethods(barsyLocationId),
    syncBarsyTaxGroups(barsyLocationId),
  ])

  const elapsed = Date.now() - startTime
  const results = { suppliers, depots, places, poses, paymentMethods, taxGroups }
  const allSuccess = Object.values(results).every((r: any) => !r.error)
  const totalRecords = Object.values(results).reduce((sum: number, r: any) => sum + (r.count || 0), 0)

  console.log(`✅ Master data sync complete in ${elapsed}ms. Total: ${totalRecords} records. Success: ${allSuccess}`)

  return { success: allSuccess, results, elapsedMs: elapsed }
}

/**
 * Helper to update sync status
 */
async function updateSyncStatus(
  supabase: any,
  barsyLocationId: string,
  syncType: string,
  recordsSynced: number
) {
  await supabase
    .from('barsy_sync_log')
    .insert({
      location_id: barsyLocationId,
      sync_type: syncType,
      records_synced: recordsSynced,
      status: 'success',
      completed_at: new Date().toISOString(),
    })
}

