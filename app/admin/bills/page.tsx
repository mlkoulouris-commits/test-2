import { BillsPageClient } from "@/components/admin/bills-page-client";
import {
  getBillLocations,
  getBills,
  getBillStats,
  getBillVendors,
} from "@/lib/actions/bills";
import { getPendingBillsCount } from "@/lib/actions/recurring-bills";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    location?: string;
    vendor?: string;
    showVoided?: string;
    page?: string;
  }>;
}

export default async function BillsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    status: params.status,
    locationId: params.location,
    vendorId: params.vendor ? parseInt(params.vendor) : undefined,
    showVoided: params.showVoided === "true",
  };
  const currentPage = params.page ? parseInt(params.page) : 1;

  const [
    billsResult,
    statsResult,
    vendorsResult,
    locationsResult,
    pendingResult,
  ] = await Promise.all([
    getBills(filters),
    getBillStats(),
    getBillVendors(),
    getBillLocations(),
    getPendingBillsCount(),
  ]);

  return (
    <BillsPageClient
      bills={billsResult.data || []}
      stats={
        statsResult.data || {
          totalUnpaid: 0,
          partiallyPaid: 0,
          outstanding: 0,
          overdue: 0,
          dueThisMonth: 0,
        }
      }
      vendors={vendorsResult.data || []}
      locations={locationsResult.data || []}
      currentPage={currentPage}
      error={billsResult.error}
      pendingRecurringCount={pendingResult.count}
    />
  );
}
