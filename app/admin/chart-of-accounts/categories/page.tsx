'use client'

import { useEffect, useState } from 'react'
import { Link2, Search, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { useLanguage } from '@/lib/i18n/context'
import { LinkCategoryToAccountDialog } from '@/components/admin/link-category-to-account-dialog'
import { CoaAccountBadge } from '@/components/admin/coa-account-badge'
import {
  BarsyCategoryWithMapping,
  getCategoriesWithMappings,
  getBarsyLocations,
  unlinkCategory,
} from '@/lib/actions/barsy-account-mappings'
import { toast } from 'sonner'

export default function CategoryMappingsPage() {
  const { locale, t } = useLanguage()
  const [categories, setCategories] = useState<BarsyCategoryWithMapping[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [locationId, setLocationId] = useState<string>('')
  const [linkedStatus, setLinkedStatus] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [categoriesToLink, setCategoriesToLink] = useState<BarsyCategoryWithMapping[]>([])

  const loadLocations = async () => {
    const result = await getBarsyLocations()
    if (result.data) {
      setLocations(result.data)
    }
  }

  const loadCategories = async () => {
    setLoading(true)
    const result = await getCategoriesWithMappings({
      page,
      pageSize,
      search,
      locationId: locationId || undefined,
      linkedStatus,
    })

    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setCategories(result.data)
      setTotal(result.total || 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCategories()
      setSelectedIds(new Set())
    }, 300)

    return () => clearTimeout(timer)
  }, [page, pageSize, search, locationId, linkedStatus])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(categories.map(c => `${c.location_id}-${c.barsy_category_id}`))
      setSelectedIds(allIds)
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (category: BarsyCategoryWithMapping, checked: boolean) => {
    const key = `${category.location_id}-${category.barsy_category_id}`
    const newIds = new Set(selectedIds)
    if (checked) {
      newIds.add(key)
    } else {
      newIds.delete(key)
    }
    setSelectedIds(newIds)
  }

  const handleLinkSelected = () => {
    const selected = categories.filter(c =>
      selectedIds.has(`${c.location_id}-${c.barsy_category_id}`)
    )
    setCategoriesToLink(selected)
    setLinkDialogOpen(true)
  }

  const handleLinkOne = (category: BarsyCategoryWithMapping) => {
    setCategoriesToLink([category])
    setLinkDialogOpen(true)
  }

  const handleUnlink = async (category: BarsyCategoryWithMapping) => {
    const result = await unlinkCategory(category.location_id, category.barsy_category_id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(locale === 'bg' ? 'Връзката е премахната' : 'Link removed')
      loadCategories()
    }
  }

  const selectedCount = selectedIds.size
  const allSelected = categories.length > 0 && selectedIds.size === categories.length

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">{t('common.admin')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/chart-of-accounts">
              {locale === 'bg' ? 'Сметкоплан' : 'Chart of Accounts'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {locale === 'bg' ? 'Категории' : 'Categories'}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {locale === 'bg' ? 'Свързване на категории' : 'Category Mappings'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {locale === 'bg'
              ? 'Свържете Barsy категории със сметки за приходи'
              : 'Link Barsy categories to revenue accounts'}
          </p>
        </div>
        {selectedCount > 0 && (
          <Button onClick={handleLinkSelected}>
            <Link2 className="mr-2 h-4 w-4" />
            {locale === 'bg'
              ? `Свържи ${selectedCount} избрани`
              : `Link ${selectedCount} selected`}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === 'bg' ? 'Barsy категории' : 'Barsy Categories'}
          </CardTitle>
          <CardDescription>
            {total > 0
              ? `${total} ${locale === 'bg' ? 'категории' : 'categories'}`
              : loading
                ? (locale === 'bg' ? 'Зареждане...' : 'Loading...')
                : (locale === 'bg' ? 'Няма категории' : 'No categories')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={locale === 'bg' ? 'Търсене по име...' : 'Search by name...'}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-8"
              />
            </div>

            <Select
              value={locationId}
              onValueChange={(v) => {
                setLocationId(v === 'all' ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={locale === 'bg' ? 'Всички локации' : 'All locations'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === 'bg' ? 'Всички локации' : 'All locations'}
                </SelectItem>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={linkedStatus}
              onValueChange={(v) => {
                setLinkedStatus(v as any)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{locale === 'bg' ? 'Всички' : 'All'}</SelectItem>
                <SelectItem value="linked">{locale === 'bg' ? 'Свързани' : 'Linked'}</SelectItem>
                <SelectItem value="unlinked">{locale === 'bg' ? 'Несвързани' : 'Unlinked'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{locale === 'bg' ? 'Категория' : 'Category'}</TableHead>
                  <TableHead>{locale === 'bg' ? 'Локация' : 'Location'}</TableHead>
                  <TableHead>{locale === 'bg' ? 'Сметка за приходи' : 'Revenue Account'}</TableHead>
                  <TableHead>{locale === 'bg' ? 'Сметка за себестойност' : 'COGS Account'}</TableHead>
                  <TableHead className="w-[100px]">{locale === 'bg' ? 'Действия' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {locale === 'bg' ? 'Зареждане...' : 'Loading...'}
                    </TableCell>
                  </TableRow>
                ) : categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {locale === 'bg' ? 'Няма категории. Синхронизирайте от Barsy.' : 'No categories. Sync from Barsy first.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((cat) => {
                    const key = `${cat.location_id}-${cat.barsy_category_id}`
                    const isLinked = cat.revenue_account_id || cat.cogs_account_id

                    return (
                      <TableRow key={key}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(key)}
                            onCheckedChange={(checked) => handleSelectOne(cat, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {cat.category_name}
                          {!cat.is_active && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {locale === 'bg' ? 'Неактивна' : 'Inactive'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {cat.location_name}
                        </TableCell>
                        <TableCell>
                          <CoaAccountBadge
                            code={cat.revenue_account_code}
                            name={cat.revenue_account_name}
                            variant="outline"
                          />
                        </TableCell>
                        <TableCell>
                          <CoaAccountBadge
                            code={cat.cogs_account_code}
                            name={cat.cogs_account_name}
                            variant="outline"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLinkOne(cat)}
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                            {isLinked && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnlink(cat)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && total > 0 && (
            <DataTablePagination
              currentPage={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          )}
        </CardContent>
      </Card>

      <LinkCategoryToAccountDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        categories={categoriesToLink}
        onSuccess={loadCategories}
      />
    </div>
  )
}
