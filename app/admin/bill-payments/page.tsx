import { getBillPayments, getPaymentStats, getBillLocations, getBankAccounts } from '@/lib/actions/bills'
import { BillPaymentsPageClient } from '@/components/admin/bill-payments-page-client'

interface PageProps {
  searchParams: Promise<{
    startDate?: string
    endDate?: string
    method?: string
    location?: string
    bankAccount?: string
    page?: string
  }>
}

export default async function BillPaymentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filters = {
    startDate: params.startDate,
    endDate: params.endDate,
    paymentMethod: params.method,
    locationId: params.location,
    bankAccountId: params.bankAccount ? parseInt(params.bankAccount) : undefined,
  }
  const currentPage = params.page ? parseInt(params.page) : 1

  const [paymentsResult, statsResult, locationsResult, bankAccountsResult] = await Promise.all([
    getBillPayments(filters),
    getPaymentStats(),
    getBillLocations(),
    getBankAccounts(),
  ])

  return (
    <BillPaymentsPageClient
      payments={paymentsResult.data || []}
      stats={statsResult.data || { totalPayments: 0, totalAmount: 0, byMethod: {} }}
      locations={locationsResult.data || []}
      bankAccounts={bankAccountsResult.data || []}
      currentPage={currentPage}
      error={paymentsResult.error}
    />
  )
}

