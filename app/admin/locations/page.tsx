import { getAllLocations, getAllLocationCategories } from '@/lib/actions/locations'
import { getAllBrands } from '@/lib/actions/brands'
import { getAllBarsyLocations } from '@/lib/actions/barsy-locations'
import { LocationsPageClient } from '@/components/admin/locations-page-client'

export const dynamic = 'force-dynamic'

export default async function LocationsPage() {
  const [locationsResult, categoriesResult, brandsResult, barsyLocationsResult] = await Promise.all([
    getAllLocations(),
    getAllLocationCategories(),
    getAllBrands(),
    getAllBarsyLocations(),
  ])

  return (
    <LocationsPageClient
      locations={locationsResult.data || []}
      categories={categoriesResult.data || []}
      brands={brandsResult.data || []}
      barsyLocations={barsyLocationsResult.data || []}
    />
  )
}

