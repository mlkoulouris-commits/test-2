'use client'

import { useEffect, useState } from 'react'
import { Link2, Search, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { LinkArticleToAccountDialog } from '@/components/admin/link-article-to-account-dialog'
import { CoaAccountBadge } from '@/components/admin/coa-account-badge'
import {
  BarsyArticleWithMapping,
  getArticlesWithMappings,
  getBarsyLocations,
  getCategoriesByLocation,
  unlinkArticle,
} from '@/lib/actions/barsy-account-mappings'
import { toast } from 'sonner'

export default function ArticleMappingsPage() {
  const { locale, t } = useLanguage()
  const [articles, setArticles] = useState<BarsyArticleWithMapping[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [locationId, setLocationId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [linkedStatus, setLinkedStatus] = useState<'all' | 'linked' | 'unlinked' | 'inherited'>('all')
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])
  const [categories, setCategories] = useState<Array<{ barsy_category_id: number; category_name: string }>>([])

  // Dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [articleToLink, setArticleToLink] = useState<BarsyArticleWithMapping | null>(null)

  const loadLocations = async () => {
    const result = await getBarsyLocations()
    if (result.data) {
      setLocations(result.data)
    }
  }

  const loadCategories = async (locId: string) => {
    if (!locId) {
      setCategories([])
      return
    }
    const result = await getCategoriesByLocation(locId)
    if (result.data) {
      setCategories(result.data)
    }
  }

  const loadArticles = async () => {
    setLoading(true)
    const result = await getArticlesWithMappings({
      page,
      pageSize,
      search,
      locationId: locationId || undefined,
      categoryId: categoryId || undefined,
      linkedStatus,
    })

    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setArticles(result.data)
      setTotal(result.total || 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    loadCategories(locationId)
    setCategoryId(null)
  }, [locationId])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadArticles()
    }, 300)

    return () => clearTimeout(timer)
  }, [page, pageSize, search, locationId, categoryId, linkedStatus])

  const handleLinkOne = (article: BarsyArticleWithMapping) => {
    setArticleToLink(article)
    setLinkDialogOpen(true)
  }

  const handleUnlink = async (article: BarsyArticleWithMapping) => {
    const result = await unlinkArticle(article.location_id, article.barsy_article_id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(locale === 'bg' ? 'Специалната връзка е премахната' : 'Override removed')
      loadArticles()
    }
  }

  const getAccountDisplay = (article: BarsyArticleWithMapping, type: 'revenue' | 'cogs') => {
    const directCode = type === 'revenue' ? article.revenue_account_code : article.cogs_account_code
    const directName = type === 'revenue' ? article.revenue_account_name : article.cogs_account_name
    const inheritedCode =
      type === 'revenue'
        ? article.inherited_revenue_account_code
        : article.inherited_cogs_account_code
    const inheritedName =
      type === 'revenue'
        ? article.inherited_revenue_account_name
        : article.inherited_cogs_account_name

    if (directCode) {
      return (
        <CoaAccountBadge
          code={directCode}
          name={directName}
          variant="default"
        />
      )
    }

    if (inheritedCode) {
      return (
        <CoaAccountBadge
          code={inheritedCode}
          name={inheritedName}
          variant="secondary"
          suffix={
            <span className="ml-1 text-xs opacity-70">
              ({locale === 'bg' ? 'от кат.' : 'cat.'})
            </span>
          }
        />
      )
    }

    return <span className="text-muted-foreground">—</span>
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
            <BreadcrumbLink href="/admin/chart-of-accounts">
              {locale === 'bg' ? 'Сметкоплан' : 'Chart of Accounts'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {locale === 'bg' ? 'Артикули' : 'Articles'}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">
          {locale === 'bg' ? 'Свързване на артикули' : 'Article Mappings'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {locale === 'bg'
            ? 'Задайте специални сметки за отделни артикули (по избор - наследяват от категория)'
            : 'Override account mappings for specific articles (optional - inherits from category)'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === 'bg' ? 'Barsy артикули' : 'Barsy Articles'}
          </CardTitle>
          <CardDescription>
            {total > 0
              ? `${total} ${locale === 'bg' ? 'артикули' : 'articles'}`
              : loading
                ? (locale === 'bg' ? 'Зареждане...' : 'Loading...')
                : (locale === 'bg' ? 'Няма артикули' : 'No articles')}
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

            {locationId && categories.length > 0 && (
              <Select
                value={categoryId?.toString() || 'all'}
                onValueChange={(v) => {
                  setCategoryId(v === 'all' ? null : parseInt(v))
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={locale === 'bg' ? 'Всички категории' : 'All categories'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {locale === 'bg' ? 'Всички категории' : 'All categories'}
                  </SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.barsy_category_id} value={cat.barsy_category_id.toString()}>
                      {cat.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

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
                <SelectItem value="linked">{locale === 'bg' ? 'Със специална връзка' : 'With override'}</SelectItem>
                <SelectItem value="inherited">{locale === 'bg' ? 'Наследени' : 'Inherited'}</SelectItem>
                <SelectItem value="unlinked">{locale === 'bg' ? 'Без връзка' : 'No mapping'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{locale === 'bg' ? 'Артикул' : 'Article'}</TableHead>
                  <TableHead>{locale === 'bg' ? 'Категория' : 'Category'}</TableHead>
                  <TableHead>{locale === 'bg' ? 'Локация' : 'Location'}</TableHead>
                  <TableHead>{locale === 'bg' ? 'Приходи' : 'Revenue'}</TableHead>
                  <TableHead>{locale === 'bg' ? 'Себестойност' : 'COGS'}</TableHead>
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
                ) : articles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {locale === 'bg' ? 'Няма артикули. Синхронизирайте от Barsy.' : 'No articles. Sync from Barsy first.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  articles.map((art) => {
                    const hasOverride = art.revenue_account_id || art.cogs_account_id

                    return (
                      <TableRow key={art.id}>
                        <TableCell className="font-medium">
                          {art.article_name}
                          {!art.is_active && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {locale === 'bg' ? 'Неактивен' : 'Inactive'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {art.category_name || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {art.location_name}
                        </TableCell>
                        <TableCell>
                          {getAccountDisplay(art, 'revenue')}
                        </TableCell>
                        <TableCell>
                          {getAccountDisplay(art, 'cogs')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLinkOne(art)}
                              title={hasOverride
                                ? (locale === 'bg' ? 'Редактирай' : 'Edit')
                                : (locale === 'bg' ? 'Задай специална връзка' : 'Set override')}
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                            {hasOverride && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnlink(art)}
                                className="text-destructive hover:text-destructive"
                                title={locale === 'bg' ? 'Премахни специалната връзка' : 'Remove override'}
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

      <LinkArticleToAccountDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        article={articleToLink}
        onSuccess={loadArticles}
      />
    </div>
  )
}
