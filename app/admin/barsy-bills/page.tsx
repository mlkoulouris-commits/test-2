import { getPendingBarsyBills } from '@/lib/actions/barsy-bills-approval'
import { getBillVendors, getBillLocations } from '@/lib/actions/bills'
import { BarsyBillsPageClient } from '@/components/admin/barsy-bills-page-client'

interface PageProps {
  searchParams: Promise<{
    location?: string
    vendor?: string
    showApproved?: string
    showUnlinked?: string
    showRejected?: string
  }>
}

export default async function BarsyBillsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const showApproved = params.showApproved === 'true'
  const showUnlinkedOnly = params.showUnlinked === 'true'
  const showRejected = params.showRejected === 'true'
  const locationId = params.location ? Number.parseInt(params.location, 10) : undefined
  const resolvedLocationId = Number.isFinite(locationId) ? locationId : undefined
  const filters = {
    locationId: resolvedLocationId,
    vendorId: params.vendor ? parseInt(params.vendor) : undefined,
    showApproved: showApproved,
    showUnlinkedOnly: showUnlinkedOnly,
    showRejected: showRejected,
  }

  const [billsResult, vendorsResult, locationsResult] = await Promise.all([
    getPendingBarsyBills(filters),
    getBillVendors(),
    getBillLocations(),
  ])

  return (
    <BarsyBillsPageClient
      bills={billsResult.data || []}
      vendors={vendorsResult.data || []}
      locations={locationsResult.data || []}
      showApproved={showApproved}
      showUnlinkedOnly={showUnlinkedOnly}
      showRejected={showRejected}
    />
  )
}
