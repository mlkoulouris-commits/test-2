'use client'

import { CreateBrandDialog } from '@/components/admin/create-brand-dialog'
import { BrandsTable } from '@/components/admin/brands-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

interface Brand {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

interface BrandsPageClientProps {
  brands: Brand[]
  error?: string
}

export const BrandsPageClient = ({ brands, error }: BrandsPageClientProps) => {
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
              <BreadcrumbLink asChild>
                <Link href="/admin/settings">{t('nav.settings')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('nav.brands')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('brands.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('brands.description')}
            </p>
          </div>
          <CreateBrandDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('brands.allBrands')}</CardTitle>
          <CardDescription>
            {brands.length} brand{brands.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : (
            <BrandsTable brands={brands} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}


