import { getAllBrands } from '@/lib/actions/brands'
import { BrandsPageClient } from '@/components/admin/brands-page-client'

export default async function BrandsPage() {
  const result = await getAllBrands()

  return (
    <BrandsPageClient 
      brands={result.data || []}
      error={result.error}
    />
  )
}

