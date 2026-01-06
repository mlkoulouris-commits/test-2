'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BankAccountTransfer {
  id: number
  from_account_id: number
  to_account_id: number
  amount: number
  transfer_date: string
  description: string | null
  created_by: string | null
  created_at: string
  from_account?: {
    id: number
    account_name: string
    account_type: string
  }
  to_account?: {
    id: number
    account_name: string
    account_type: string
  }
  creator?: {
    first_name: string
    last_name: string
  }
}

export const createBankTransfer = async (
  fromAccountId: number,
  toAccountId: number,
  amount: number,
  transferDate: Date,
  description?: string
) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Validate accounts exist and have sufficient balance
  const { data: fromAccount } = await supabase
    .from('bank_accounts')
    .select('current_balance, location_id, account_type, location:locations(name)')
    .eq('id', fromAccountId)
    .single()

  const { data: toAccount } = await supabase
    .from('bank_accounts')
    .select('location_id, account_type, location:locations(name)')
    .eq('id', toAccountId)
    .single()

  if (!fromAccount || !toAccount) {
    return { error: 'Invalid accounts selected' }
  }

  if (fromAccount.current_balance < amount) {
    return { error: 'Insufficient balance in source account' }
  }

  // Validate transfer rules
  const fromType = fromAccount.account_type
  const toType = toAccount.account_type
  const fromLocationName = (fromAccount.location as any)?.name
  const toLocationName = (toAccount.location as any)?.name
  const isHQInvolved = fromLocationName === 'Memento Group HQ' || toLocationName === 'Memento Group HQ'

  // POS or Cash can only transfer to/from Bank at same location
  if (fromType === 'pos' || fromType === 'cash') {
    if (toType !== 'bank' || fromAccount.location_id !== toAccount.location_id) {
      return { error: `${fromType.toUpperCase()} accounts can only transfer to Bank accounts at the same location` }
    }
  }

  // Bank receiving from POS/Cash must be same location
  if (toType === 'pos' || toType === 'cash') {
    if (fromType !== 'bank' || fromAccount.location_id !== toAccount.location_id) {
      return { error: `${toType.toUpperCase()} accounts can only receive from Bank accounts at the same location` }
    }
  }

  // Bank to Bank: same location OR to/from HQ
  if (fromType === 'bank' && toType === 'bank') {
    if (fromAccount.location_id !== toAccount.location_id && !isHQInvolved) {
      return { error: 'Bank to Bank transfers must be within the same location or involve HQ' }
    }
  }

  const { data, error } = await supabase
    .from('bank_account_transfers')
    .insert({
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount,
      transfer_date: transferDate.toISOString().split('T')[0],
      description,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/banks')
  return { data }
}

export const getBankTransfers = async (accountId?: number) => {
  const supabase = await createClient()

  let query = supabase
    .from('bank_account_transfers')
    .select(`
      *,
      from_account:bank_accounts!from_account_id(id, account_name, account_type),
      to_account:bank_accounts!to_account_id(id, account_name, account_type),
      creator:profiles!created_by(first_name, last_name)
    `)
    .order('transfer_date', { ascending: false })

  if (accountId) {
    query = query.or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  return { data: data as BankAccountTransfer[] }
}

export const deleteBankTransfer = async (transferId: number) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('bank_account_transfers')
    .delete()
    .eq('id', transferId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/banks')
  return { success: true }
}

