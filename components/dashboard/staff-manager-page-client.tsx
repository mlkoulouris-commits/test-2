'use client'

import { CreateStaffDialog } from '@/components/dashboard/create-staff-dialog'
import { StaffManagerTable } from '@/components/dashboard/staff-manager-table'
import { Card, CardContent } from '@/components/ui/card'
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

interface StaffMember {
  id: number
  user_id: string
  first_name: string
  last_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  user_locations?: Array<{
    location_id: number
    locations: {
      id: number
      name: string
    }
  }>
}

interface StaffManagerPageClientProps {
  staff: StaffMember[]
  locations: Array<{ id: number; name: string }>
  error?: string
}

export const StaffManagerPageClient = ({ staff, locations, error }: StaffManagerPageClientProps) => {
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
              <BreadcrumbPage>{t('nav.staffManager')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('staffManager.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('staffManager.description')}
            </p>
          </div>
          <CreateStaffDialog locations={locations} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : (
            <StaffManagerTable staff={staff} locations={locations} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
