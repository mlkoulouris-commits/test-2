import { getAllBankAccounts } from '@/lib/actions/bank-accounts'
import { getAllLocations } from '@/lib/actions/locations'
import { BanksPageClient } from '@/components/admin/banks-page-client'

interface PageProps {
  searchParams: Promise<{
    location?: string
    type?: string
    showPos?: string
  }>
}

export default async function BanksPage({ searchParams }: PageProps) {
  const params = await searchParams
  const locationFilter = params.location
  const typeFilter = params.type
  const showPos = params.showPos === 'true'

  const [bankAccountsResult, locationsResult] = await Promise.all([
    getAllBankAccounts(),
    getAllLocations(),
  ])

  const bankAccounts = bankAccountsResult.data || []
  const locations = locationsResult.data || []

  // Apply filters
  let filteredAccounts = bankAccounts

  if (locationFilter) {
    filteredAccounts = filteredAccounts.filter(account => account.location_id === parseInt(locationFilter))
  }

  if (typeFilter && typeFilter !== 'all') {
    filteredAccounts = filteredAccounts.filter(account => account.account_type === typeFilter)
  }

  // Filter out POS accounts unless showPos is true
  if (!showPos) {
    filteredAccounts = filteredAccounts.filter(account => 
      !account.account_name.toUpperCase().includes('POS')
    )
  }

  return (
    <BanksPageClient 
      filteredAccounts={filteredAccounts}
      locations={locations}
      bankAccounts={bankAccounts}
      showPos={showPos}
    />
  )
}

