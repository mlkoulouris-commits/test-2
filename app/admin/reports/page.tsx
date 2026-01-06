import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    // Redirect shareholders to sales report
    if (profile?.role === 'shareholder') {
      redirect('/admin/reports/sales')
    }
  }
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
              <BreadcrumbPage>Reports</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold mt-2">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-2">
          View sales, COGS, labor, and profitability reports
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Reports</CardTitle>
            <CardDescription>Daily sales breakdown by payment method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Daily/weekly/monthly sales trends</li>
              <li>Sales by location and brand</li>
              <li>Cash vs card breakdown</li>
              <li>Interactive charts</li>
            </ul>
            <Link href="/admin/reports/sales">
              <Button className="w-full">
                View Sales Report
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>COGS & Profitability</CardTitle>
            <CardDescription>Feature coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Actual COGS from invoices</li>
              <li>Projected vs actual usage</li>
              <li>Gross profit margins</li>
              <li>Profitability by location</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Labor Reports</CardTitle>
            <CardDescription>Feature coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Hours worked by employee</li>
              <li>Labor cost per location</li>
              <li>Scheduled vs actual variance</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Reports</CardTitle>
            <CardDescription>Feature coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Expenses by category and location</li>
              <li>Capital vs operational expenses</li>
              <li>Depreciation schedules</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

