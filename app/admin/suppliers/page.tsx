'use client'

import { useEffect, useState } from 'react'
import { getAllSuppliers, getSupplierLocations } from '@/lib/actions/suppliers'
import { SuppliersTable } from '@/components/admin/suppliers-table'
import { LinkSuppliersDialog } from '@/components/admin/link-suppliers-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Link as LinkIcon, X } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface Supplier {
  id: number
  barsy_location_id: string
  supplier_id: number
  supplier_name: string
  bulstat: string | null
  vat_number: string | null
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  contact_person: string | null
  is_active: boolean
  payment_terms_days: number | null
  vendor_id: number | null
  location_name?: string
  vendor_name?: string
}

interface Location {
  id: string
  name: string
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [linkedFilter, setLinkedFilter] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)

  const loadSuppliers = async () => {
    setLoading(true)
    setError(null)
    const result = await getAllSuppliers({
      page,
      pageSize,
      search,
      locationId: locationFilter === 'all' ? undefined : locationFilter,
      linkedStatus: linkedFilter,
    })

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setSuppliers(result.data)
      setTotal(result.total || 0)
    }
    setLoading(false)
  }

  const loadLocations = async () => {
    const result = await getSupplierLocations()
    if (result.data) {
      setLocations(result.data)
    }
  }

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuppliers()
    }, 300)

    return () => clearTimeout(timer)
  }, [page, pageSize, search, locationFilter, linkedFilter])

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

  const handleLocationFilterChange = (value: string) => {
    setLocationFilter(value)
    setPage(1)
  }

  const handleLinkedFilterChange = (value: 'all' | 'linked' | 'unlinked') => {
    setLinkedFilter(value)
    setPage(1)
  }

  const handleRefresh = () => {
    setSelectedIds([])
    loadSuppliers()
  }

  const handleLinkSuccess = () => {
    setSelectedIds([])
    loadSuppliers()
  }

  const handleClearFilters = () => {
    setSearch('')
    setLocationFilter('all')
    setLinkedFilter('all')
    setPage(1)
  }

  const hasActiveFilters = search !== '' || locationFilter !== 'all' || linkedFilter !== 'all'
  const selectedSuppliers = suppliers.filter(s => selectedIds.includes(s.id))
  const unlinkedCount = suppliers.filter(s => !s.vendor_id).length

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Suppliers</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Supplier Management</h1>
          <p className="text-muted-foreground mt-2">
            Link Barsy suppliers to vendor master records
          </p>
        </div>
        {selectedIds.length > 0 && (
          <Button onClick={() => setLinkDialogOpen(true)} className="gap-2">
            <LinkIcon className="h-4 w-4" />
            Link {selectedIds.length} Supplier{selectedIds.length > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
          <CardDescription>
            {total > 0 ? `${total} supplier(s)` : loading ? 'Loading...' : 'No suppliers'}
            {linkedFilter === 'unlinked' && unlinkedCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unlinkedCount} unlinked
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, bulstat..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={locationFilter} onValueChange={handleLocationFilterChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={linkedFilter} onValueChange={handleLinkedFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                <SelectItem value="linked">Linked Only</SelectItem>
                <SelectItem value="unlinked">Unlinked Only</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="gap-2 w-full sm:w-auto"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>

          {error ? (
            <p className="text-destructive">{error}</p>
          ) : (
            <>
              <SuppliersTable
                suppliers={suppliers}
                loading={loading}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onRefresh={handleRefresh}
              />
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

      <LinkSuppliersDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        supplierIds={selectedIds}
        supplierNames={selectedSuppliers.map(s => s.supplier_name)}
        onSuccess={handleLinkSuccess}
      />
    </div>
  )
}

