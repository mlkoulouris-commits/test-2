'use server'

import { createClient } from '@/lib/supabase/server'
import { createBarsyClient } from '@/lib/services/barsy-api'

const parseFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const parseNullableFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100

/**
 * Sync Store Loads (Supplier Purchases/Invoices) from Barsy
 */
export const syncBarsyStoreLoads = async (
  barsyLocationId: string,
  dateFrom: string,
  dateTo: string
) => {
  const supabase = await createClient()

  // Get Barsy location config
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

  console.log(`Fetching store loads from ${dateFrom} to ${dateTo}...`)

  const response = await client.getAllStoreLoads(dateFrom, dateTo)

  if (!response.success || !response.data) {
    return { error: response.error || 'Failed to fetch store loads' }
  }

  const storeLoads = ((response.data as Record<string, unknown>).Storeloads_getlist as unknown[]) || []
  console.log(`Fetched ${storeLoads.length} store loads`)

  // Fetch detailed net/gross line totals to compute VAT reliably (no hardcoded VAT rate).
  const detailsResponse = await client.getAllStoreLoadsDetailsRows(dateFrom, dateTo, {
    statuses: [0, 1],
    rowsPerPage: 1000,
    columns: [
      'store_load_id',
      'article_id',
      'article_name',
      'amount',
      'current_price',
      'current_price_total',
      'current_price_tax',
      'current_price_tax_total',
    ],
  })

  const detailsRows = detailsResponse.success && detailsResponse.data ? detailsResponse.data.rows : []
  const detailsRowsByStoreLoadId = new Map<number, Array<Record<string, unknown>>>()
  const totalsByStoreLoadId = new Map<number, { netTotal: number; grossTotal: number }>()

  detailsRows.forEach((row) => {
    if (!row || typeof row !== 'object') return
    const r = row as Record<string, unknown>
    const storeLoadId = Number(r.store_load_id)
    if (!Number.isFinite(storeLoadId) || storeLoadId <= 0) return

    const netTotal = parseFiniteNumber(r.current_price_total)
    const grossTotal = parseFiniteNumber(r.current_price_tax_total)

    const existingTotals = totalsByStoreLoadId.get(storeLoadId) || { netTotal: 0, grossTotal: 0 }
    totalsByStoreLoadId.set(storeLoadId, {
      netTotal: existingTotals.netTotal + netTotal,
      grossTotal: existingTotals.grossTotal + grossTotal,
    })

    const existingRows = detailsRowsByStoreLoadId.get(storeLoadId) || []
    existingRows.push(r)
    detailsRowsByStoreLoadId.set(storeLoadId, existingRows)
  })

  // Pre-fetch all vendor mappings for this location to optimize performance
  const supplierIds = [
    ...new Set(
      storeLoads
        .map((l) => (l as Record<string, unknown>).supplier_id)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    ),
  ]
  const vendorMap = new Map<number, number>()

  if (supplierIds.length > 0) {
    const { data: suppliers } = await supabase
      .from('barsy_suppliers')
      .select('supplier_id, vendor_id')
      .eq('barsy_location_id', barsyLocationId)
      .in('supplier_id', supplierIds)
      .not('vendor_id', 'is', null)

    if (suppliers) {
      suppliers.forEach(s => {
        if (s.vendor_id) {
          vendorMap.set(s.supplier_id, s.vendor_id)
        }
      })
    }

    console.log(`Found ${vendorMap.size} vendor mappings for ${supplierIds.length} unique suppliers`)
  }

  // OPTIMIZED: Batch transform all store loads first, then batch insert
  const storeLoadsToUpsert: any[] = []
  const allLineItems: Map<number, any[]> = new Map() // store_load_id -> items

  for (const load of storeLoads) {
    const loadObj = load as Record<string, unknown>
    const storeLoadId = Number(loadObj.store_load_id)
    const hasTax = parseFiniteNumber(loadObj.has_tax)

    const totals = totalsByStoreLoadId.get(storeLoadId)
    const netTotal = totals ? roundCurrency(totals.netTotal) : roundCurrency(parseFiniteNumber(loadObj.total_sum))
    const grossTotal = totals ? roundCurrency(totals.grossTotal) : null
    const vatAmount =
      totals && grossTotal !== null ? roundCurrency(grossTotal - netTotal) : null
    const vatRate =
      vatAmount !== null && Math.abs(netTotal) > 0.0001
        ? roundCurrency((vatAmount / netTotal) * 100)
        : null
    const hasVat = hasTax === 1 && vatAmount !== null && Math.abs(vatAmount) > 0.0001

    // Look up vendor_id from pre-fetched map
    const supplierId = typeof loadObj.supplier_id === 'number' ? loadObj.supplier_id : null
    const vendorId = supplierId ? (vendorMap.get(supplierId) || null) : null

    storeLoadsToUpsert.push({
      barsy_location_id: barsyLocationId,
      store_load_id: storeLoadId,
      barsy_id: parseNullableFiniteNumber(loadObj.barsy_id),
      depot_id: parseNullableFiniteNumber(loadObj.depot_id),
      supplier_id: supplierId,
      supplier_name: typeof loadObj.supplier_name === 'string' ? loadObj.supplier_name : null,
      vendor_id: vendorId,
      doc_type_id: parseNullableFiniteNumber(loadObj.doc_type_id),
      doc_type_name: typeof loadObj.doc_type_name === 'string' ? loadObj.doc_type_name : null,
      doc_num: typeof loadObj.doc_num === 'string' ? loadObj.doc_num : null,
      doc_date: typeof loadObj.doc_date === 'string' ? loadObj.doc_date : null,
      date: typeof loadObj.date === 'string' ? loadObj.date : null,
      close_date: typeof loadObj.close_date === 'string' ? loadObj.close_date : null,
      status: parseNullableFiniteNumber(loadObj.status),
      operation_type: parseNullableFiniteNumber(loadObj.operation_type),
      price_mode: parseNullableFiniteNumber(loadObj.price_mode),
      has_tax: parseNullableFiniteNumber(loadObj.has_tax),
      total_sum: parseNullableFiniteNumber(loadObj.total_sum),
      total_paid: parseNullableFiniteNumber(loadObj.total_paid),
      total_costs: parseNullableFiniteNumber(loadObj.total_costs),
      paid_due_date: typeof loadObj.paid_due_date === 'string' ? loadObj.paid_due_date : null,
      currency_id: parseNullableFiniteNumber(loadObj.currency_id),
      currency_rate: parseNullableFiniteNumber(loadObj.currency_rate),
      paymethod_id: parseNullableFiniteNumber(loadObj.paymethod_id),
      description: typeof loadObj.description === 'string' ? loadObj.description : null,
      creator_id: parseNullableFiniteNumber(loadObj.creator_id),
      user_name: typeof loadObj.user_name === 'string' ? loadObj.user_name : null,
      last_update: typeof loadObj.last_update === 'string' ? loadObj.last_update : null,
      has_vat: hasVat,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_sum_net: netTotal,
      total_sum_gross: grossTotal,
      raw_data: load,
      updated_at: new Date().toISOString(),
    })

    // Collect line items for this store load
    const reportItems = Number.isFinite(storeLoadId) ? detailsRowsByStoreLoadId.get(storeLoadId) : undefined
    const lineItems: any[] = []

    if (reportItems && reportItems.length > 0) {
      for (const item of reportItems) {
        const quantity = parseFiniteNumber(item.amount)
        const netUnitPrice = parseFiniteNumber(item.current_price)
        const netTotalPrice =
          parseFiniteNumber(item.current_price_total) || roundCurrency(quantity * netUnitPrice)
        const grossTotalPrice = parseFiniteNumber(item.current_price_tax_total)

        const rowVatAmount = hasVat ? roundCurrency(grossTotalPrice - netTotalPrice) : null
        const rowVatRate =
          rowVatAmount !== null && Math.abs(netTotalPrice) > 0.0001
            ? roundCurrency((rowVatAmount / netTotalPrice) * 100)
            : null

        lineItems.push({
          barsy_article_id: parseNullableFiniteNumber(item.article_id),
          article_name: typeof item.article_name === 'string' ? item.article_name : null,
          quantity,
          unit_price: netUnitPrice,
          total_price: netTotalPrice,
          amount_type: null,
          vat_rate: rowVatRate,
          vat_amount: rowVatAmount,
          raw_data: item,
        })
      }
    } else if (loadObj.details && Array.isArray(loadObj.details)) {
      for (const item of loadObj.details) {
        if (!item || typeof item !== 'object') continue
        const itemObj = item as Record<string, unknown>
        const quantity = parseFiniteNumber(itemObj.amount ?? itemObj.quantity)
        const unitPrice = parseFiniteNumber(
          itemObj.delivery_price ?? itemObj.current_price ?? itemObj.unit_price ?? itemObj.price
        )
        const totalPrice = parseFiniteNumber(itemObj.total_price) || roundCurrency(quantity * unitPrice)

        lineItems.push({
          barsy_article_id: parseNullableFiniteNumber(itemObj.article_id),
          article_name: typeof itemObj.article_name === 'string' ? itemObj.article_name : null,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          amount_type: typeof itemObj.amount_type === 'string' ? itemObj.amount_type : null,
          raw_data: item,
        })
      }
    }

    if (lineItems.length > 0) {
      allLineItems.set(storeLoadId, lineItems)
    }
  }

  // BATCH INSERT: Upsert all store loads in batches of 500
  let syncedCount = 0
  const batchSize = 500
  console.log(`📦 Batch upserting ${storeLoadsToUpsert.length} store loads...`)

  for (let i = 0; i < storeLoadsToUpsert.length; i += batchSize) {
    const batch = storeLoadsToUpsert.slice(i, i + batchSize)
    const { error: batchError } = await supabase
      .from('barsy_store_loads')
      .upsert(batch, {
        onConflict: 'barsy_location_id,store_load_id',
        ignoreDuplicates: false,
      })

    if (batchError) {
      console.error(`Error in batch ${Math.floor(i / batchSize) + 1}:`, batchError)
    } else {
      syncedCount += batch.length
    }
  }

  // Now fetch the inserted IDs for line item association
  let itemsCount = 0
  if (allLineItems.size > 0) {
    const storeLoadIds = Array.from(allLineItems.keys())
    
    // Fetch the DB IDs for the store loads we just inserted
    const { data: insertedLoads } = await supabase
      .from('barsy_store_loads')
      .select('id, store_load_id')
      .eq('barsy_location_id', barsyLocationId)
      .in('store_load_id', storeLoadIds)

    if (insertedLoads) {
      const dbIdMap = new Map<number, string>()
      for (const load of insertedLoads) {
        dbIdMap.set(load.store_load_id, load.id)
      }

      // Prepare all line items with DB foreign keys
      const allItemsToInsert: any[] = []
      for (const [storeLoadId, items] of allLineItems) {
        const dbId = dbIdMap.get(storeLoadId)
        if (dbId) {
          for (const item of items) {
            allItemsToInsert.push({
              ...item,
              store_load_id: dbId,
            })
          }
        }
      }

      if (allItemsToInsert.length > 0) {
        // Delete existing items for these store loads first
        const dbIds = Array.from(dbIdMap.values())
        await supabase
          .from('barsy_store_load_items')
          .delete()
          .in('store_load_id', dbIds)

        // Batch insert all line items
        console.log(`📦 Batch inserting ${allItemsToInsert.length} line items...`)
        for (let i = 0; i < allItemsToInsert.length; i += batchSize) {
          const batch = allItemsToInsert.slice(i, i + batchSize)
          const { error: itemBatchError } = await supabase
            .from('barsy_store_load_items')
            .insert(batch)

          if (!itemBatchError) {
            itemsCount += batch.length
          } else {
            console.error(`Error inserting line items batch:`, itemBatchError)
          }
        }
      }
    }
  }

  await updateSyncStatus(supabase, barsyLocationId, 'store_loads', syncedCount)

  console.log(`✅ Synced ${syncedCount} store loads with ${itemsCount} line items (batch insert)`)

  return {
    success: true,
    count: syncedCount,
    itemsCount,
    dateFrom,
    dateTo
  }
}

/**
 * Get store loads summary
 */
export const getBarsyStoreLoadsSummary = async (barsyLocationId: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('barsy_store_loads')
    .select('*')
    .eq('barsy_location_id', barsyLocationId)
    .order('doc_date', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  const summary = {
    total: data.length,
    open: data.filter(l => l.status === 0).length,
    closed: data.filter(l => l.status === 1).length,
    totalAmount: data.reduce((sum, l) => sum + Number(l.total_sum || 0), 0),
    unpaidAmount: data.reduce((sum, l) => sum + (Number(l.total_sum || 0) - Number(l.total_paid || 0)), 0),
  }

  return { data: summary }
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
    .from('barsy_sync_status')
    .upsert({
      barsy_location_id: barsyLocationId,
      sync_type: syncType,
      last_sync_at: new Date().toISOString(),
      last_sync_success: true,
      records_synced: recordsSynced,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'barsy_location_id,sync_type'
    })
}
