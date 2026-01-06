'use client'

import Link from 'next/link'
import { IncomeApprovalDashboard } from '@/components/dashboard/income-approval-dashboard'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { useLanguage } from '@/lib/i18n/context'

interface Location {
  id: number
  name: string
}

interface IncomeApprovalPageClientProps {
  locations: Location[]
}

export const IncomeApprovalPageClient = ({ locations }: IncomeApprovalPageClientProps) => {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard">{t('common.dashboard')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('incomeApproval.reviewSales')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">{t('incomeApproval.reviewSales')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('incomeApproval.reviewDescription')}
        </p>
      </div>

      <IncomeApprovalDashboard locations={locations} />
    </div>
  )
}


