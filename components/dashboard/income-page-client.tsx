'use client'

import Link from 'next/link'
import { IncomeTabs } from '@/components/dashboard/income-tabs'
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

interface IncomePageClientProps {
  locations: Location[]
}

export const IncomePageClient = ({ locations }: IncomePageClientProps) => {
  const { t } = useLanguage()

  if (locations.length === 0) {
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
                <BreadcrumbPage>{t('income.recordSales')}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl sm:text-3xl font-bold mt-2">{t('income.recordSales')}</h1>
        </div>
        <p className="text-muted-foreground">
          {t('income.noLocations')}
        </p>
      </div>
    )
  }

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
              <BreadcrumbPage>{t('income.recordSales')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">{t('income.recordSales')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('income.reportSales')}
        </p>
      </div>

      <IncomeTabs locations={locations} />
    </div>
  )
}


