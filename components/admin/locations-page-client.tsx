'use client'

import { CreateLocationDialog } from '@/components/admin/create-location-dialog'
import { LocationsTable } from '@/components/admin/locations-table'
import { CreateBarsyLocationDialog } from '@/components/admin/create-barsy-location-dialog'
import { BarsyLocationsTable } from '@/components/admin/barsy-locations-table'
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

interface LocationsPageClientProps {
  locations: any[]
  categories: any[]
  brands: any[]
  barsyLocations: any[]
}

export const LocationsPageClient = ({ locations, categories, brands, barsyLocations }: LocationsPageClientProps) => {
  const { t } = useLanguage()

  const mementoLocations = locations.map(loc => ({ id: loc.id, name: loc.name }))

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
              <BreadcrumbPage>{t('nav.locations')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-2">
          <h1 className="text-2xl sm:text-3xl font-bold">{t('locations.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('locations.description')}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('locations.barsyLocations')}</CardTitle>
            <CardDescription>
              {barsyLocations.length} {t('locations.configured')}
            </CardDescription>
          </div>
          <CreateBarsyLocationDialog mementoLocations={mementoLocations} />
        </CardHeader>
        <CardContent>
          <BarsyLocationsTable 
            locations={barsyLocations}
            mementoLocations={mementoLocations}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('locations.mementoLocations')}</CardTitle>
            <CardDescription>
              {locations.length} location(s)
            </CardDescription>
          </div>
          <CreateLocationDialog 
            categories={categories} 
            brands={brands}
          />
        </CardHeader>
        <CardContent>
          <LocationsTable locations={locations} />
        </CardContent>
      </Card>
    </div>
  )
}


