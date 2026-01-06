'use server'

import { createClient } from '@/lib/supabase/server'
import { syncBarsyStoreLoads } from './barsy-storeloads-sync'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'

export interface SyncAllResult {
  success: boolean
  totalLocations: number
  successfulSyncs: number
  failedSyncs: number
  totalBillsSynced: number
  results: Array<{
    locationId: string
    locationName: string
    success: boolean
    count?: number
    error?: string
  }>
  error?: string
  elapsedMs?: number
}

/**
 * Sync store loads (bills) from all active Barsy locations
 * Defaults to last 30 days
 */
export const syncAllBarsyBills = async (daysBack: number = 30): Promise<SyncAllResult> => {
  const supabase = await createClient()

  // Get all active Barsy locations
  const { data: locations, error: locationsError } = await supabase
    .from('barsy_locations')
    .select('id, name, barsy_url, username, password_encrypted')
    .eq('is_active', true)

  if (locationsError || !locations || locations.length === 0) {
    return {
      success: false,
      totalLocations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalBillsSynced: 0,
      results: [],
      error: locationsError?.message || 'No active Barsy locations found'
    }
  }

  // Calculate date range (use format to avoid timezone issues with toISOString)
  const now = new Date()
  const dateTo = format(now, 'yyyy-MM-dd')
  const dateFrom = format(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

  console.log(`Syncing bills from ${dateFrom} to ${dateTo} for ${locations.length} locations`)

  const results: SyncAllResult['results'] = []
  let successfulSyncs = 0
  let failedSyncs = 0
  let totalBillsSynced = 0

  // Sync each location sequentially (to avoid API rate limits)
  for (const location of locations) {
    try {
      console.log(`Syncing location: ${location.name} (${location.id})`)

      const syncResult = await syncBarsyStoreLoads(
        location.id,
        dateFrom,
        dateTo
      )

      if (syncResult.success) {
        successfulSyncs++
        totalBillsSynced += syncResult.count || 0
        results.push({
          locationId: location.id,
          locationName: location.name,
          success: true,
          count: syncResult.count
        })
      } else {
        failedSyncs++
        results.push({
          locationId: location.id,
          locationName: location.name,
          success: false,
          error: syncResult.error
        })
      }
    } catch (err) {
      failedSyncs++
      results.push({
        locationId: location.id,
        locationName: location.name,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  // Revalidate pages
  revalidatePath('/admin/barsy-bills')
  revalidatePath('/admin/bills')

  return {
    success: successfulSyncs > 0,
    totalLocations: locations.length,
    successfulSyncs,
    failedSyncs,
    totalBillsSynced,
    results
  }
}

/**
 * OPTIMIZED: Sync store loads from all locations in parallel
 * Uses Promise.all for concurrent processing - much faster for multiple locations
 * Note: Only use if Barsy API can handle concurrent requests without rate limiting
 */
export const syncAllBarsyBillsParallel = async (daysBack: number = 30): Promise<SyncAllResult> => {
  const startTime = Date.now()
  const supabase = await createClient()

  // Get all active Barsy locations
  const { data: locations, error: locationsError } = await supabase
    .from('barsy_locations')
    .select('id, name, barsy_url, username, password_encrypted')
    .eq('is_active', true)

  if (locationsError || !locations || locations.length === 0) {
    return {
      success: false,
      totalLocations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalBillsSynced: 0,
      results: [],
      error: locationsError?.message || 'No active Barsy locations found'
    }
  }

  // Calculate date range
  const now = new Date()
  const dateTo = format(now, 'yyyy-MM-dd')
  const dateFrom = format(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

  console.log(`🚀 Syncing bills PARALLEL from ${dateFrom} to ${dateTo} for ${locations.length} locations`)

  // Sync all locations in parallel
  const syncPromises = locations.map(async (location) => {
    try {
      console.log(`  📍 Starting: ${location.name}`)
      const syncResult = await syncBarsyStoreLoads(location.id, dateFrom, dateTo)

      return {
        locationId: location.id,
        locationName: location.name,
        success: syncResult.success === true,
        count: syncResult.count || 0,
        error: syncResult.error
      }
    } catch (err) {
      return {
        locationId: location.id,
        locationName: location.name,
        success: false,
        count: 0,
        error: err instanceof Error ? err.message : 'Unknown error'
      }
    }
  })

  const results = await Promise.all(syncPromises)
  const elapsedMs = Date.now() - startTime

  const successfulSyncs = results.filter(r => r.success).length
  const failedSyncs = results.filter(r => !r.success).length
  const totalBillsSynced = results.reduce((sum, r) => sum + (r.count || 0), 0)

  // Revalidate pages
  revalidatePath('/admin/barsy-bills')
  revalidatePath('/admin/bills')

  console.log(`✅ Parallel sync complete in ${elapsedMs}ms. ${totalBillsSynced} bills from ${successfulSyncs} locations`)

  return {
    success: successfulSyncs > 0,
    totalLocations: locations.length,
    successfulSyncs,
    failedSyncs,
    totalBillsSynced,
    results,
    elapsedMs
  }
}
