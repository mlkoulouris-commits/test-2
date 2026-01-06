'use client'

import { useEffect, useState } from 'react'
import { getAllVendors } from '@/lib/actions/vendors'
import { CreateVendorDialog } from '@/components/admin/create-vendor-dialog'
import { VendorsTable } from '@/components/admin/vendors-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useLanguage } from '@/lib/i18n/context'

interface Vendor {
  id: number
  name: string
  name_bg?: string | null
  tax_id: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  payment_terms: string | null
  is_active: boolean
}

export default function VendorsPage() {
  const { t } = useLanguage()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVendors = async () => {
    setLoading(true)
    setError(null)
    const result = await getAllVendors({ page, pageSize, search })
    
    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setVendors(result.data)
      setTotal(result.total || 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVendors()
    }, 300)

    return () => clearTimeout(timer)
  }, [page, pageSize, search])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
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
            <BreadcrumbPage>{t('nav.vendors')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('vendors.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('vendors.description')}
          </p>
        </div>
        <CreateVendorDialog onSuccess={loadVendors} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('vendors.allVendors')}</CardTitle>
          <CardDescription>
            {total > 0 ? `${total} ${t('vendors.vendor')}` : loading ? t('common.loading') : t('vendors.noVendors')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('vendors.searchPlaceholder')}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8"
            />
          </div>
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : (
            <>
              <VendorsTable vendors={vendors} loading={loading} onRefresh={loadVendors} />
              {!loading && (
                <DataTablePagination
                  currentPage={page}
                  pageSize={pageSize}
                  totalItems={total}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

