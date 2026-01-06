'use client'

import { CreateUserDialog } from '@/components/admin/create-user-dialog'
import { UsersTable } from '@/components/admin/users-table'
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

interface UsersPageClientProps {
  users: any[]
  locations: any[]
  error?: string
}

export const UsersPageClient = ({ users, locations, error }: UsersPageClientProps) => {
  const { t } = useLanguage()

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
              <BreadcrumbPage>{t('nav.users')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('users.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('users.description')}
            </p>
          </div>
          <CreateUserDialog locations={locations} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : (
            <UsersTable users={users} allLocations={locations} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}


