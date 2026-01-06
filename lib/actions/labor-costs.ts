'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type CostType = 'salary' | 'bonus' | 'overtime' | 'benefits' | 'taxes' | 'other'
export type PaymentStatus = 'pending' | 'partially_paid' | 'paid'

export interface LaborCost {
  id: number
  location_id: number
  profile_id: number | null
  description: string | null
  cost_type: CostType
  amount: number
  period_start: string
  period_end: string
  payment_date: string | null
  account_id: number | null
  notes: string | null
  created_by: number | null
  created_at: string
  updated_at: string
  // Payment tracking fields
  total_paid: number
  status: PaymentStatus
  balance: number
  // Joined fields
  location?: { id: number; name: string } | null
  profile?: { id: number; first_name: string; last_name: string } | null
  account?: { id: number; code: string; name: string } | null
}

export interface CreateLaborCostData {
  locationId: number
  profileId?: number | null
  description?: string
  costType: CostType
  amount: number
  periodStart: string
  periodEnd: string
  paymentDate?: string | null
  accountId?: number | null
  notes?: string
}

export interface UpdateLaborCostData {
  locationId?: number
  profileId?: number | null
  description?: string
  costType?: CostType
  amount?: number
  periodStart?: string
  periodEnd?: string
  paymentDate?: string | null
  accountId?: number | null
  notes?: string
}

/**
 * Get all labor costs with filters
 */
export const getLaborCosts = async (options?: {
  locationId?: number
  profileId?: number
  costType?: CostType
  status?: PaymentStatus
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  search?: string
}) => {
  const supabase = await createClient()
  const page = options?.page || 1
  const pageSize = options?.pageSize || 50

  let query = supabase
    .from('labor_costs')
    .select(`
      *,
      location:locations(id, name),
      profile:profiles!labor_costs_profile_id_fkey(id, first_name, last_name),
      account:chart_of_accounts(id, code, name)
    `)
    .order('period_start', { ascending: false })

  // Apply filters
  if (options?.locationId) {
    query = query.eq('location_id', options.locationId)
  }

  if (options?.profileId) {
    query = query.eq('profile_id', options.profileId)
  }

  if (options?.costType) {
    query = query.eq('cost_type', options.costType)
  }

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  if (options?.dateFrom) {
    query = query.gte('period_start', options.dateFrom)
  }

  if (options?.dateTo) {
    query = query.lte('period_end', options.dateTo)
  }

  if (options?.search) {
    query = query.ilike('description', `%${options.search}%`)
  }

  // Count query
  let countQuery = supabase
    .from('labor_costs')
    .select('*', { count: 'exact', head: true })

  if (options?.locationId) countQuery = countQuery.eq('location_id', options.locationId)
  if (options?.profileId) countQuery = countQuery.eq('profile_id', options.profileId)
  if (options?.costType) countQuery = countQuery.eq('cost_type', options.costType)
  if (options?.status) countQuery = countQuery.eq('status', options.status)
  if (options?.dateFrom) countQuery = countQuery.gte('period_start', options.dateFrom)
  if (options?.dateTo) countQuery = countQuery.lte('period_end', options.dateTo)
  if (options?.search) countQuery = countQuery.ilike('description', `%${options.search}%`)

  const { count } = await countQuery

  // Paginate
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error } = await query.range(from, to)

  if (error) {
    return { error: error.message }
  }

  // Map data with calculated balance
  const mappedData: LaborCost[] = (data || []).map((item: Record<string, unknown>) => ({
    ...item,
    amount: Number(item.amount) || 0,
    total_paid: Number(item.total_paid) || 0,
    status: (item.status as PaymentStatus) || 'pending',
    balance: (Number(item.amount) || 0) - (Number(item.total_paid) || 0),
  })) as LaborCost[]

  return { data: mappedData, total: count || 0 }
}

/**
 * Get a single labor cost by ID
 */
export const getLaborCostById = async (id: number) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('labor_costs')
    .select(`
      *,
      location:locations(id, name),
      profile:profiles!labor_costs_profile_id_fkey(id, first_name, last_name),
      account:chart_of_accounts(id, code, name)
    `)
    .eq('id', id)
    .single()

  if (error) {
    return { error: error.message }
  }

  const item = data as Record<string, unknown>
  const laborCost: LaborCost = {
    ...item,
    amount: Number(item.amount) || 0,
    total_paid: Number(item.total_paid) || 0,
    status: (item.status as PaymentStatus) || 'pending',
    balance: (Number(item.amount) || 0) - (Number(item.total_paid) || 0),
  } as LaborCost

  return { data: laborCost }
}

/**
 * Create a new labor cost entry
 */
export const createLaborCost = async (data: CreateLaborCostData) => {
  const supabase = await createClient()

  // Get current user profile
  const { data: { user } } = await supabase.auth.getUser()
  let createdBy: number | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
    createdBy = profile?.id || null
  }

  const { data: laborCost, error } = await supabase
    .from('labor_costs')
    .insert({
      location_id: data.locationId,
      profile_id: data.profileId || null,
      description: data.description || null,
      cost_type: data.costType,
      amount: data.amount,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      payment_date: data.paymentDate || null,
      account_id: data.accountId || null,
      notes: data.notes || null,
      created_by: createdBy,
      total_paid: 0,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/labor-costs')
  return { success: true, data: laborCost }
}

/**
 * Update an existing labor cost entry
 */
export const updateLaborCost = async (id: number, data: UpdateLaborCostData) => {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  if (data.locationId !== undefined) updateData.location_id = data.locationId
  if (data.profileId !== undefined) updateData.profile_id = data.profileId
  if (data.description !== undefined) updateData.description = data.description
  if (data.costType !== undefined) updateData.cost_type = data.costType
  if (data.amount !== undefined) updateData.amount = data.amount
  if (data.periodStart !== undefined) updateData.period_start = data.periodStart
  if (data.periodEnd !== undefined) updateData.period_end = data.periodEnd
  if (data.paymentDate !== undefined) updateData.payment_date = data.paymentDate
  if (data.accountId !== undefined) updateData.account_id = data.accountId
  if (data.notes !== undefined) updateData.notes = data.notes

  const { error } = await supabase
    .from('labor_costs')
    .update(updateData)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/labor-costs')
  return { success: true }
}

/**
 * Delete a labor cost entry
 */
export const deleteLaborCost = async (id: number) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from('labor_costs')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/labor-costs')
  return { success: true }
}

/**
 * Get labor cost summary by period
 */
export const getLaborCostSummary = async (options: {
  dateFrom: string
  dateTo: string
  locationId?: number
}) => {
  const supabase = await createClient()

  let query = supabase
    .from('labor_costs')
    .select('cost_type, amount, location_id, locations(name)')
    .gte('period_start', options.dateFrom)
    .lte('period_end', options.dateTo)

  if (options.locationId) {
    query = query.eq('location_id', options.locationId)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  // Aggregate by cost type
  const byType: Record<CostType, number> = {
    salary: 0,
    bonus: 0,
    overtime: 0,
    benefits: 0,
    taxes: 0,
    other: 0,
  }

  let total = 0
  data?.forEach(item => {
    byType[item.cost_type as CostType] += Number(item.amount) || 0
    total += Number(item.amount) || 0
  })

  return { data: { byType, total } }
}

/**
 * Get locations for dropdown
 */
export const getLaborCostLocations = async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) {
    return { error: error.message }
  }

  return { data }
}

/**
 * Get staff members for dropdown (optionally filtered by location)
 */
export const getStaffMembers = async (locationId?: number) => {
  const supabase = await createClient()

  if (locationId) {
    // Get staff assigned to this location
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        user_id
      `)
      .order('first_name')

    if (error) {
      return { error: error.message }
    }

    // Get user_ids assigned to this location
    const { data: userLocations } = await supabase
      .from('user_locations')
      .select('user_id')
      .eq('location_id', locationId)

    const assignedUserIds = new Set(userLocations?.map(ul => ul.user_id) || [])

    // Filter profiles to only those assigned to this location
    const filteredData = data?.filter(p => p.user_id && assignedUserIds.has(p.user_id)) || []

    return { data: filteredData.map(p => ({ id: p.id, first_name: p.first_name, last_name: p.last_name })) }
  }

  // No location filter - return all staff
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .order('first_name')

  if (error) {
    return { error: error.message }
  }

  return { data }
}

/**
 * Get personnel expense accounts for dropdown
 */
export const getPersonnelAccounts = async () => {
  const supabase = await createClient()

  // Get accounts under Personnel Costs (code starts with 31)
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, name_bg')
    .eq('is_active', true)
    .eq('level', 3)
    .like('code', '31%')
    .order('code')

  if (error) {
    return { error: error.message }
  }

  return { data }
}
