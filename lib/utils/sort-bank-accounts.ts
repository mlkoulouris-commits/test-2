import { BankAccount } from '@/lib/actions/bank-accounts'

const ACCOUNT_TYPE_ORDER: Record<string, number> = {
  'bank': 1,
  'pos': 2,
  'cash': 3,
}

export const sortBankAccounts = (accounts: BankAccount[]): BankAccount[] => {
  return [...accounts].sort((a, b) => {
    // First sort by location name
    const locationA = a.location?.name || ''
    const locationB = b.location?.name || ''
    
    if (locationA !== locationB) {
      return locationA.localeCompare(locationB)
    }
    
    // Then by account type (bank -> pos -> cash)
    const typeOrderA = ACCOUNT_TYPE_ORDER[a.account_type] || 999
    const typeOrderB = ACCOUNT_TYPE_ORDER[b.account_type] || 999
    
    if (typeOrderA !== typeOrderB) {
      return typeOrderA - typeOrderB
    }
    
    // Finally by account name
    return a.account_name.localeCompare(b.account_name)
  })
}


