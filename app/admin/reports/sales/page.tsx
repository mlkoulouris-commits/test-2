import { DailySalesReportView } from '@/components/dashboard/daily-sales-report-view'
import { getAllBarsyLocations } from '@/lib/actions/barsy-locations'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default async function SalesReportPage() {
  const { data: locations } = await getAllBarsyLocations()

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/admin">Admin</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/admin/reports">Reports</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Sales</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold mt-2">Sales Report</h1>
        <p className="text-muted-foreground mt-2">
          Daily sales from Barsy bills/accounts with payment method breakdown
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Data source: barsy_orders (by order_date) with payment methods from barsy_accounts
        </p>
      </div>

      <DailySalesReportView locations={locations || []} />
    </div>
  )
}
