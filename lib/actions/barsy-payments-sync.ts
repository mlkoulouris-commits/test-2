'use server'

import { createClient } from '@/lib/supabase/server'
import { createBarsyClient } from '@/lib/services/barsy-api'

/**
 * Sync Payments from Barsy
 */
export const syncBarsyPayments = async (
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

  console.log(`Fetching payments from ${dateFrom} to ${dateTo}...`)

  const response = await client.getAllPayments(dateFrom, dateTo)

  if (!response.success || !response.data) {
    return { error: response.error || 'Failed to fetch payments' }
  }

  const payments = (response.data as any).Payments_getlist || []
  console.log(`Fetched ${payments.length} payments from Barsy API`)

  if (payments.length === 0) {
    return { success: true, count: 0, dateFrom, dateTo }
  }

  // Log a sample payment to debug field names
  if (payments.length > 0) {
    console.log(`Sample payment fields:`, Object.keys(payments[0]))
  }

  // OPTIMIZED: Transform all payments first, then batch upsert
  // Map Barsy API fields to database columns
  // Note: Barsy API returns date in various fields: ref_date, payment_date, date
  const paymentsToUpsert = payments
    .map((payment: any) => {
      // Try multiple date fields from Barsy API
      const paymentDate = payment.ref_date || payment.payment_date || payment.date || payment.created_at;

      // Skip payments without a valid date (required field)
      if (!paymentDate) {
        console.warn(`Skipping payment ${payment.payment_id}: no date found`);
        return null;
      }

      return {
        location_id: barsyLocationId,
        barsy_payment_id: payment.payment_id || payment.id,
        payment_date: paymentDate,
        amount: payment.paid_sum || payment.amount || 0,
        payment_method_id: payment.paymethod_id,
        payment_method_name: payment.paymethod_name,
        account_id: payment.account_id,
        client_id: payment.client_id,
        user_id: payment.user_id,
        notes: payment.description,
        raw_data: payment,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    })
    .filter((p: any) => p !== null)

  const skippedCount = payments.length - paymentsToUpsert.length
  if (skippedCount > 0) {
    console.warn(`⚠️ Skipped ${skippedCount} payments due to missing date`)
  }

  if (paymentsToUpsert.length === 0) {
    console.log('No valid payments to sync')
    return { success: true, count: 0, dateFrom, dateTo }
  }

  // Batch upsert in chunks of 1000
  let syncedCount = 0
  const batchSize = 1000
  console.log(`📦 Batch upserting ${paymentsToUpsert.length} payments...`)

  for (let i = 0; i < paymentsToUpsert.length; i += batchSize) {
    const batch = paymentsToUpsert.slice(i, i + batchSize)
    const { error } = await supabase
      .from('barsy_payments')
      .upsert(batch, {
        onConflict: 'location_id,barsy_payment_id',
        ignoreDuplicates: false,
      })

    if (!error) {
      syncedCount += batch.length
    } else {
      console.error(`Error in batch ${Math.floor(i / batchSize) + 1}:`, error)
    }
  }

  await logSyncResult(supabase, barsyLocationId, 'payments', syncedCount)

  console.log(`✅ Synced ${syncedCount} payments (batch insert)`)

  return {
    success: true,
    count: syncedCount,
    dateFrom,
    dateTo
  }
}

/**
 * Get payments summary
 */
export const getBarsyPaymentsSummary = async (
  locationId: string,
  dateFrom?: string,
  dateTo?: string
) => {
  const supabase = await createClient()

  let query = supabase
    .from('barsy_payments')
    .select('*')
    .eq('location_id', locationId)

  if (dateFrom) {
    query = query.gte('payment_date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('payment_date', dateTo)
  }

  const { data, error } = await query.order('payment_date', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  // Payment types from raw_data (1 = income, 2 = expense based on Barsy API)
  const payments = data || []
  const income = payments.filter((p: any) => p.raw_data?.payment_type === 1)
  const expense = payments.filter((p: any) => p.raw_data?.payment_type === 2)

  const summary = {
    total: payments.length,
    income: income.length,
    expense: expense.length,
    totalIncome: income.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
    totalExpense: expense.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
  }

  return { data: summary }
}

/**
 * Helper to log sync result
 */
async function logSyncResult(
  supabase: any,
  locationId: string,
  syncType: string,
  recordsSynced: number,
  status: 'success' | 'failed' = 'success',
  errorMessage?: string
) {
  const now = new Date().toISOString()
  await supabase
    .from('barsy_sync_log')
    .insert({
      location_id: locationId,
      sync_type: syncType,
      records_synced: recordsSynced,
      status,
      error_message: errorMessage,
      started_at: now,
      completed_at: now,
    })
}
