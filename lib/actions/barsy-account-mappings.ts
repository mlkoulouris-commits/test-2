'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BarsyCategoryWithMapping {
  id: number
  location_id: string
  barsy_category_id: number
  category_name: string
  parent_id: number | null
  is_active: boolean
  location_name: string
  revenue_account_id: number | null
  revenue_account_code: string | null
  revenue_account_name: string | null
  cogs_account_id: number | null
  cogs_account_code: string | null
  cogs_account_name: string | null
}

export interface BarsyArticleWithMapping {
  id: string
  location_id: string
  barsy_article_id: number
  article_name: string
  category_id: number | null
  category_name: string | null
  is_active: boolean
  location_name: string
  revenue_account_id: number | null
  revenue_account_code: string | null
  revenue_account_name: string | null
  cogs_account_id: number | null
  cogs_account_code: string | null
  cogs_account_name: string | null
  // Inherited from category
  inherited_revenue_account_id: number | null
  inherited_revenue_account_code: string | null
  inherited_revenue_account_name: string | null
  inherited_cogs_account_id: number | null
  inherited_cogs_account_code: string | null
  inherited_cogs_account_name: string | null
}

/**
 * Get all Barsy categories with their account mappings
 */
export const getCategoriesWithMappings = async (options?: {
  locationId?: string
  linkedStatus?: 'all' | 'linked' | 'unlinked'
  page?: number
  pageSize?: number
  search?: string
}) => {
  const supabase = await createClient()
  const page = options?.page || 1
  const pageSize = options?.pageSize || 50
  const search = options?.search?.trim()
  const locationId = options?.locationId
  const linkedStatus = options?.linkedStatus || 'all'

  // Build the query
  let query = supabase
    .from('barsy_categories')
    .select(`
      id,
      location_id,
      barsy_category_id,
      category_name,
      parent_id,
      is_active,
      barsy_locations!inner(name)
    `)
    .order('category_name')

  // Apply filters
  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  if (search) {
    query = query.ilike('category_name', `%${search}%`)
  }

  // Get total count
  let countQuery = supabase
    .from('barsy_categories')
    .select('*', { count: 'exact', head: true })

  if (locationId) {
    countQuery = countQuery.eq('location_id', locationId)
  }
  if (search) {
    countQuery = countQuery.ilike('category_name', `%${search}%`)
  }

  const { count } = await countQuery

  // Get paginated data
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: categories, error } = await query.range(from, to)

  if (error) {
    return { error: error.message }
  }

  if (!categories || categories.length === 0) {
    return { data: [], total: 0 }
  }

  // Get mappings for these categories
  const categoryIds = categories.map((c: any) => c.barsy_category_id)
  const locationIds = [...new Set(categories.map((c: any) => c.location_id))]

  const { data: mappings } = await supabase
    .from('barsy_category_account_mapping')
    .select(`
      barsy_location_id,
      barsy_category_id,
      revenue_account_id,
      cogs_account_id,
      revenue_account:chart_of_accounts!barsy_category_account_mapping_revenue_account_id_fkey(code, name),
      cogs_account:chart_of_accounts!barsy_category_account_mapping_cogs_account_id_fkey(code, name)
    `)
    .in('barsy_location_id', locationIds)
    .in('barsy_category_id', categoryIds)

  // Merge categories with mappings
  const mappingsMap = new Map<string, any>()
  mappings?.forEach((m: any) => {
    const key = `${m.barsy_location_id}-${m.barsy_category_id}`
    mappingsMap.set(key, m)
  })

  let result: BarsyCategoryWithMapping[] = categories.map((cat: any) => {
    const key = `${cat.location_id}-${cat.barsy_category_id}`
    const mapping = mappingsMap.get(key)

    return {
      id: cat.id,
      location_id: cat.location_id,
      barsy_category_id: cat.barsy_category_id,
      category_name: cat.category_name,
      parent_id: cat.parent_id,
      is_active: cat.is_active,
      location_name: cat.barsy_locations?.name || 'Unknown',
      revenue_account_id: mapping?.revenue_account_id || null,
      revenue_account_code: mapping?.revenue_account?.code || null,
      revenue_account_name: mapping?.revenue_account?.name || null,
      cogs_account_id: mapping?.cogs_account_id || null,
      cogs_account_code: mapping?.cogs_account?.code || null,
      cogs_account_name: mapping?.cogs_account?.name || null,
    }
  })

  // Filter by linked status
  if (linkedStatus === 'linked') {
    result = result.filter(r => r.revenue_account_id !== null || r.cogs_account_id !== null)
  } else if (linkedStatus === 'unlinked') {
    result = result.filter(r => r.revenue_account_id === null && r.cogs_account_id === null)
  }

  return { data: result, total: count || 0 }
}

/**
 * Get all Barsy articles with their account mappings
 */
export const getArticlesWithMappings = async (options?: {
  locationId?: string
  categoryId?: number
  linkedStatus?: 'all' | 'linked' | 'unlinked' | 'inherited'
  page?: number
  pageSize?: number
  search?: string
}) => {
  const supabase = await createClient()
  const page = options?.page || 1
  const pageSize = options?.pageSize || 50
  const search = options?.search?.trim()
  const locationId = options?.locationId
  const categoryId = options?.categoryId
  const linkedStatus = options?.linkedStatus || 'all'

  // Build the query for articles
  let query = supabase
    .from('barsy_articles')
    .select(`
      id,
      location_id,
      barsy_article_id,
      article_name,
      category_id,
      is_active,
      barsy_locations!inner(name)
    `)
    .order('article_name')

  // Apply filters
  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  if (search) {
    query = query.ilike('article_name', `%${search}%`)
  }

  // Get total count
  let countQuery = supabase
    .from('barsy_articles')
    .select('*', { count: 'exact', head: true })

  if (locationId) {
    countQuery = countQuery.eq('location_id', locationId)
  }
  if (categoryId) {
    countQuery = countQuery.eq('category_id', categoryId)
  }
  if (search) {
    countQuery = countQuery.ilike('article_name', `%${search}%`)
  }

  const { count } = await countQuery

  // Get paginated data
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: articles, error } = await query.range(from, to)

  if (error) {
    return { error: error.message }
  }

  if (!articles || articles.length === 0) {
    return { data: [], total: 0 }
  }

  // Get article mappings
  const articleIds = articles.map((a: any) => a.barsy_article_id)
  const locationIds = [...new Set(articles.map((a: any) => a.location_id))]

  const { data: articleMappings } = await supabase
    .from('barsy_article_account_mapping')
    .select(`
      barsy_location_id,
      barsy_article_id,
      revenue_account_id,
      cogs_account_id,
      revenue_account:chart_of_accounts!barsy_article_account_mapping_revenue_account_id_fkey(code, name),
      cogs_account:chart_of_accounts!barsy_article_account_mapping_cogs_account_id_fkey(code, name)
    `)
    .in('barsy_location_id', locationIds)
    .in('barsy_article_id', articleIds)

  // Get category mappings for inheritance
  const categoryIds = [...new Set(articles.map((a: any) => a.category_id).filter(Boolean))]

  const { data: categoryMappings } = await supabase
    .from('barsy_category_account_mapping')
    .select(`
      barsy_location_id,
      barsy_category_id,
      revenue_account_id,
      cogs_account_id,
      revenue_account:chart_of_accounts!barsy_category_account_mapping_revenue_account_id_fkey(code, name),
      cogs_account:chart_of_accounts!barsy_category_account_mapping_cogs_account_id_fkey(code, name)
    `)
    .in('barsy_location_id', locationIds)
    .in('barsy_category_id', categoryIds)

  // Get category names
  const { data: categories } = await supabase
    .from('barsy_categories')
    .select('location_id, barsy_category_id, category_name')
    .in('location_id', locationIds)
    .in('barsy_category_id', categoryIds)

  // Build lookup maps
  const articleMappingsMap = new Map<string, any>()
  articleMappings?.forEach((m: any) => {
    const key = `${m.barsy_location_id}-${m.barsy_article_id}`
    articleMappingsMap.set(key, m)
  })

  const categoryMappingsMap = new Map<string, any>()
  categoryMappings?.forEach((m: any) => {
    const key = `${m.barsy_location_id}-${m.barsy_category_id}`
    categoryMappingsMap.set(key, m)
  })

  const categoryNamesMap = new Map<string, string>()
  categories?.forEach((c: any) => {
    const key = `${c.location_id}-${c.barsy_category_id}`
    categoryNamesMap.set(key, c.category_name)
  })

  // Merge articles with mappings
  let result: BarsyArticleWithMapping[] = articles.map((art: any) => {
    const articleKey = `${art.location_id}-${art.barsy_article_id}`
    const categoryKey = art.category_id ? `${art.location_id}-${art.category_id}` : null

    const articleMapping = articleMappingsMap.get(articleKey)
    const categoryMapping = categoryKey ? categoryMappingsMap.get(categoryKey) : null
    const categoryName = categoryKey ? categoryNamesMap.get(categoryKey) : null

    return {
      id: art.id,
      location_id: art.location_id,
      barsy_article_id: art.barsy_article_id,
      article_name: art.article_name,
      category_id: art.category_id,
      category_name: categoryName || null,
      is_active: art.is_active,
      location_name: art.barsy_locations?.name || 'Unknown',
      revenue_account_id: articleMapping?.revenue_account_id || null,
      revenue_account_code: articleMapping?.revenue_account?.code || null,
      revenue_account_name: articleMapping?.revenue_account?.name || null,
      cogs_account_id: articleMapping?.cogs_account_id || null,
      cogs_account_code: articleMapping?.cogs_account?.code || null,
      cogs_account_name: articleMapping?.cogs_account?.name || null,
      inherited_revenue_account_id: categoryMapping?.revenue_account_id || null,
      inherited_revenue_account_code: categoryMapping?.revenue_account?.code || null,
      inherited_revenue_account_name: categoryMapping?.revenue_account?.name || null,
      inherited_cogs_account_id: categoryMapping?.cogs_account_id || null,
      inherited_cogs_account_code: categoryMapping?.cogs_account?.code || null,
      inherited_cogs_account_name: categoryMapping?.cogs_account?.name || null,
    }
  })

  // Filter by linked status
  if (linkedStatus === 'linked') {
    result = result.filter(r => r.revenue_account_id !== null || r.cogs_account_id !== null)
  } else if (linkedStatus === 'unlinked') {
    result = result.filter(r =>
      r.revenue_account_id === null &&
      r.cogs_account_id === null &&
      r.inherited_revenue_account_id === null &&
      r.inherited_cogs_account_id === null
    )
  } else if (linkedStatus === 'inherited') {
    result = result.filter(r =>
      (r.revenue_account_id === null && r.inherited_revenue_account_id !== null) ||
      (r.cogs_account_id === null && r.inherited_cogs_account_id !== null)
    )
  }

  return { data: result, total: count || 0 }
}

/**
 * Link a Barsy category to chart of accounts
 */
export const linkCategoryToAccounts = async (
  locationId: string,
  categoryId: number,
  revenueAccountId: number | null,
  cogsAccountId: number | null
) => {
  const supabase = await createClient()

  // If both are null, remove the mapping
  if (revenueAccountId === null && cogsAccountId === null) {
    const { error } = await supabase
      .from('barsy_category_account_mapping')
      .delete()
      .eq('barsy_location_id', locationId)
      .eq('barsy_category_id', categoryId)

    if (error && error.code !== 'PGRST116') {
      return { error: error.message }
    }

    revalidatePath('/admin/chart-of-accounts')
    return { success: true }
  }

  // Upsert the mapping
  const { error } = await supabase
    .from('barsy_category_account_mapping')
    .upsert({
      barsy_location_id: locationId,
      barsy_category_id: categoryId,
      revenue_account_id: revenueAccountId,
      cogs_account_id: cogsAccountId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'barsy_location_id,barsy_category_id',
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/chart-of-accounts')
  return { success: true }
}

/**
 * Bulk link multiple categories to accounts
 */
export const bulkLinkCategoriesToAccounts = async (
  mappings: Array<{
    locationId: string
    categoryId: number
    revenueAccountId: number | null
    cogsAccountId: number | null
  }>
) => {
  const supabase = await createClient()

  const upsertData = mappings
    .filter(m => m.revenueAccountId !== null || m.cogsAccountId !== null)
    .map(m => ({
      barsy_location_id: m.locationId,
      barsy_category_id: m.categoryId,
      revenue_account_id: m.revenueAccountId,
      cogs_account_id: m.cogsAccountId,
      updated_at: new Date().toISOString(),
    }))

  if (upsertData.length > 0) {
    const { error } = await supabase
      .from('barsy_category_account_mapping')
      .upsert(upsertData, {
        onConflict: 'barsy_location_id,barsy_category_id',
      })

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath('/admin/chart-of-accounts')
  return { success: true, count: upsertData.length }
}

/**
 * Link a Barsy article to chart of accounts (override)
 */
export const linkArticleToAccounts = async (
  locationId: string,
  articleId: number,
  revenueAccountId: number | null,
  cogsAccountId: number | null
) => {
  const supabase = await createClient()

  // If both are null, remove the mapping (use inherited from category)
  if (revenueAccountId === null && cogsAccountId === null) {
    const { error } = await supabase
      .from('barsy_article_account_mapping')
      .delete()
      .eq('barsy_location_id', locationId)
      .eq('barsy_article_id', articleId)

    if (error && error.code !== 'PGRST116') {
      return { error: error.message }
    }

    revalidatePath('/admin/chart-of-accounts')
    return { success: true }
  }

  // Upsert the mapping
  const { error } = await supabase
    .from('barsy_article_account_mapping')
    .upsert({
      barsy_location_id: locationId,
      barsy_article_id: articleId,
      revenue_account_id: revenueAccountId,
      cogs_account_id: cogsAccountId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'barsy_location_id,barsy_article_id',
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/chart-of-accounts')
  return { success: true }
}

/**
 * Unlink a category from accounts
 */
export const unlinkCategory = async (locationId: string, categoryId: number) => {
  return linkCategoryToAccounts(locationId, categoryId, null, null)
}

/**
 * Unlink an article from accounts (will inherit from category)
 */
export const unlinkArticle = async (locationId: string, articleId: number) => {
  return linkArticleToAccounts(locationId, articleId, null, null)
}

/**
 * Get Barsy locations for filter dropdowns
 */
export const getBarsyLocations = async () => {
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

/**
 * Get categories for a specific location (for filter dropdown)
 */
export const getCategoriesByLocation = async (locationId: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('barsy_categories')
    .select('barsy_category_id, category_name')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('category_name')

  if (error) {
    return { error: error.message }
  }

  return { data }
}

/**
 * Set vendor default account
 */
export const setVendorDefaultAccount = async (vendorId: number, accountId: number | null) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from('vendors')
    .update({
      default_account_id: accountId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', vendorId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/vendors')
  revalidatePath(`/admin/vendors/${vendorId}`)
  return { success: true }
}

/**
 * Set bill item account
 */
export const setBillItemAccount = async (billItemId: number, accountId: number | null) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from('bill_items')
    .update({ account_id: accountId })
    .eq('id', billItemId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/bills')
  return { success: true }
}

/**
 * Bulk set account for bill items
 */
export const bulkSetBillItemsAccount = async (billItemIds: number[], accountId: number) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from('bill_items')
    .update({ account_id: accountId })
    .in('id', billItemIds)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/bills')
  return { success: true, count: billItemIds.length }
}

/**
 * Get unclassified bill items
 */
export const getUnclassifiedBillItems = async (options?: {
  vendorId?: number
  locationId?: number
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}) => {
  const supabase = await createClient()
  const page = options?.page || 1
  const pageSize = options?.pageSize || 50

  let query = supabase
    .from('bill_items')
    .select(`
      id,
      description,
      quantity,
      unit_price,
      total_amount,
      bills!inner(
        id,
        doc_num,
        doc_date,
        vendor_id,
        location_id,
        vendors(name),
        locations(name)
      )
    `)
    .is('account_id', null)
    .order('id', { ascending: false })

  // Apply filters via bills
  if (options?.vendorId) {
    query = query.eq('bills.vendor_id', options.vendorId)
  }

  if (options?.locationId) {
    query = query.eq('bills.location_id', options.locationId)
  }

  if (options?.dateFrom) {
    query = query.gte('bills.doc_date', options.dateFrom)
  }

  if (options?.dateTo) {
    query = query.lte('bills.doc_date', options.dateTo)
  }

  // Count query
  let countQuery = supabase
    .from('bill_items')
    .select('*', { count: 'exact', head: true })
    .is('account_id', null)

  const { count } = await countQuery

  // Paginated data
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error } = await query.range(from, to)

  if (error) {
    return { error: error.message }
  }

  return { data, total: count || 0 }
}
