'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarsyBillsTable } from '@/components/admin/barsy-bills-table'
import { BarsyBillsFilters } from '@/components/admin/barsy-bills-filters'
import { SyncBarsyBillsButton } from '@/components/admin/sync-barsy-bills-button'
import { FileCheck, Clock } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'
import type { BarsyBill } from '@/lib/actions/barsy-bills-approval'

interface Vendor {
  id: number
  name: string
}

interface Location {
  id: number
  name: string
}

interface BarsyBillsPageClientProps {
  bills: BarsyBill[]
  vendors: Vendor[]
  locations: Location[]
  showApproved: boolean
  showUnlinkedOnly: boolean
  showRejected: boolean
}

export const BarsyBillsPageClient = ({
  bills,
  vendors,
  locations,
  showApproved,
  showUnlinkedOnly,
  showRejected
}: BarsyBillsPageClientProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()

  const getCardTitle = () => {
    if (showRejected) return t('barsyBills.rejectedBills')
    if (showUnlinkedOnly) return t('barsyBills.unlinkedBills')
    if (showApproved) return t('barsyBills.approvedBills')
    return t('barsyBills.pendingApproval')
  }

  const getCardDescription = () => {
    if (showRejected) return t('barsyBills.billsRejected')
    if (showUnlinkedOnly) return t('barsyBills.billsWithoutVendor')
    if (showApproved) return t('barsyBills.billsApproved')
    return t('barsyBills.billsWaitingReview')
  }

  const getTableTitle = () => {
    if (showRejected) return t('barsyBills.rejectedBills')
    if (showUnlinkedOnly) return t('barsyBills.unlinkedBills')
    if (showApproved) return t('barsyBills.approvedBills')
    return t('barsyBills.pendingBills')
  }

  const getTableDescription = () => {
    if (showRejected) return t('barsyBills.rejectedDescription')
    if (showUnlinkedOnly) return t('barsyBills.unlinkedDescription')
    if (showApproved) return t('barsyBills.approvedDescription')
    return t('barsyBills.reviewBills')
  }

  const totalAmount = bills.reduce((sum, b) => sum + b.total_sum, 0)

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/admin">{t('common.admin')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Barsy {t('nav.bills')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('barsyBills.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('barsyBills.description')}
            </p>
          </div>
          <SyncBarsyBillsButton />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {getCardTitle()}
            </CardTitle>
            {showApproved ? (
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bills.length}</div>
            <p className="text-xs text-muted-foreground">
              {getCardDescription()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('billPayments.totalAmount')}</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(totalAmount, 'BGN')}
            </div>
            <p className="text-xs text-muted-foreground">
              {showApproved ? t('barsyBills.acrossApproved') : t('barsyBills.acrossPending')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {getTableTitle()}
              </CardTitle>
              <CardDescription>
                {getTableDescription()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <BarsyBillsTable
            bills={bills}
            showApproved={showApproved}
            searchSlot={
              <BarsyBillsFilters
                vendors={vendors}
                locations={locations}
                showApproved={showApproved}
                showUnlinkedOnly={showUnlinkedOnly}
                showRejected={showRejected}
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
