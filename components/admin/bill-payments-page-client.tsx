'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { BillPaymentsTable } from '@/components/admin/bill-payments-table'
import { BillPaymentsFilters } from '@/components/admin/bill-payments-filters'
import { CreditCard, DollarSign, Banknote, Wallet } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'

interface BillPaymentsPageClientProps {
  payments: any[]
  stats: {
    totalPayments: number
    totalAmount: number
    byMethod: Record<string, { count: number; amount: number }>
  }
  locations: any[]
  bankAccounts: any[]
  currentPage: number
  error?: string
}

export const BillPaymentsPageClient = ({
  payments,
  stats,
  locations,
  bankAccounts,
  currentPage,
  error
}: BillPaymentsPageClientProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()

  const methodStats = Object.entries(stats.byMethod)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 2)

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      bank_transfer: t('billPayments.bankTransfer'),
      cash: t('billPayments.cash'),
      card: t('billPayments.card'),
    }
    return labels[method] || method.replace('_', ' ')
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">{t('common.admin')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/bills">{t('nav.bills')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('bills.payments')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('billPayments.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('billPayments.description')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('billPayments.totalPayments')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPayments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('billPayments.totalAmount')}</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatAmount(stats.totalAmount, 'BGN')}
            </div>
          </CardContent>
        </Card>

        {methodStats.map(([method, data], index) => (
          <Card key={method}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {getMethodLabel(method)}
              </CardTitle>
              {index === 0 ? (
                <Banknote className="h-4 w-4 text-blue-500" />
              ) : (
                <Wallet className="h-4 w-4 text-purple-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(data.amount, 'BGN')}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.count} {t('billPayments.payments')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <BillPaymentsFilters locations={locations} bankAccounts={bankAccounts} />
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : (
            <BillPaymentsTable payments={payments} currentPage={currentPage} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}


