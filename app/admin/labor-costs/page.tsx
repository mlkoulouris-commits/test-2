'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Plus, Search, Pencil, Trash2, Users, History, CreditCard, RefreshCw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { useCurrency } from '@/lib/i18n/currency'
import { LaborCostDialog } from '@/components/admin/labor-cost-dialog'
import { RecordSalaryPaymentDialog } from '@/components/admin/record-salary-payment-dialog'
import { SalaryPaymentHistoryDialog } from '@/components/admin/salary-payment-history-dialog'
import { RecurringSalaryDialog } from '@/components/admin/recurring-salary-dialog'
import {
  LaborCost,
  CostType,
  PaymentStatus,
  getLaborCosts,
  deleteLaborCost,
  getLaborCostLocations,
} from '@/lib/actions/labor-costs'
import {
  RecurringSalaryTemplate,
  PendingRecurringSalary,
  getRecurringSalaryTemplates,
  deleteRecurringSalaryTemplate,
  getPendingRecurringSalaries,
  generateRecurringSalaries,
  getPendingSalariesCount,
} from '@/lib/actions/recurring-salaries'
import { toast } from 'sonner'

const costTypeLabels: Record<CostType, { en: string; bg: string }> = {
  salary: { en: 'Salary', bg: 'Заплата' },
  bonus: { en: 'Bonus', bg: 'Бонус' },
  overtime: { en: 'Overtime', bg: 'Извънреден труд' },
  benefits: { en: 'Benefits', bg: 'Придобивки' },
  taxes: { en: 'Payroll Taxes', bg: 'Осигуровки' },
  other: { en: 'Other', bg: 'Друго' },
}

const costTypeColors: Record<CostType, string> = {
  salary: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  bonus: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  overtime: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  benefits: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  taxes: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

const statusColors: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  partially_paid: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

const statusLabels: Record<PaymentStatus, { en: string; bg: string }> = {
  pending: { en: 'Pending', bg: 'Чакащ' },
  partially_paid: { en: 'Partial', bg: 'Частично' },
  paid: { en: 'Paid', bg: 'Платено' },
}

const frequencyLabels: Record<string, { en: string; bg: string }> = {
  weekly: { en: 'Weekly', bg: 'Седмично' },
  monthly: { en: 'Monthly', bg: 'Месечно' },
  bimonthly: { en: 'Bi-Monthly', bg: 'На два месеца' },
}

export default function LaborCostsPage() {
  const { locale, t } = useLanguage()
  const { formatAmount } = useCurrency()
  const [laborCosts, setLaborCosts] = useState<LaborCost[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [locationId, setLocationId] = useState<string>('')
  const [costType, setCostType] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])

  // Summary stats
  const [summaryTotal, setSummaryTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCost, setEditingCost] = useState<LaborCost | null>(null)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [costToDelete, setCostToDelete] = useState<LaborCost | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Recurring templates state
  const [templates, setTemplates] = useState<RecurringSalaryTemplate[]>([])
  const [pendingSalaries, setPendingSalaries] = useState<PendingRecurringSalary[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<RecurringSalaryTemplate | null>(null)
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<RecurringSalaryTemplate | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    loadLocations()
    loadPendingCount()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLaborCosts()
    }, 300)

    return () => clearTimeout(timer)
  }, [page, pageSize, search, locationId, costType, statusFilter])

  const loadLocations = async () => {
    const result = await getLaborCostLocations()
    if (result.data) {
      setLocations(result.data)
    }
  }

  const loadPendingCount = async () => {
    const result = await getPendingSalariesCount()
    setPendingCount(result.count)
  }

  const loadLaborCosts = async () => {
    setLoading(true)

    const result = await getLaborCosts({
      page,
      pageSize,
      search,
      locationId: locationId ? parseInt(locationId) : undefined,
      costType: costType as CostType || undefined,
      status: statusFilter as PaymentStatus || undefined,
    })

    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setLaborCosts(result.data)
      setTotal(result.total || 0)

      // Calculate page total
      const pageTotal = result.data.reduce((sum, item) => sum + Number(item.amount), 0)
      setSummaryTotal(pageTotal)
    }
    setLoading(false)
  }

  const loadTemplates = async () => {
    setTemplatesLoading(true)
    const [templatesResult, pendingResult] = await Promise.all([
      getRecurringSalaryTemplates(),
      getPendingRecurringSalaries(),
    ])

    if (templatesResult.data) setTemplates(templatesResult.data)
    if (pendingResult.data) setPendingSalaries(pendingResult.data)
    setTemplatesLoading(false)
  }

  const handleAddNew = () => {
    setEditingCost(null)
    setDialogOpen(true)
  }

  const handleEdit = (cost: LaborCost) => {
    setEditingCost(cost)
    setDialogOpen(true)
  }

  const handleDelete = (cost: LaborCost) => {
    setCostToDelete(cost)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!costToDelete) return

    setIsDeleting(true)
    const result = await deleteLaborCost(costToDelete.id)
    setIsDeleting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(locale === 'bg' ? 'Записът е изтрит' : 'Entry deleted')
      loadLaborCosts()
    }

    setDeleteDialogOpen(false)
    setCostToDelete(null)
  }

  const handleSuccess = () => {
    loadLaborCosts()
    loadPendingCount()
  }

  const handleAddTemplate = () => {
    setEditingTemplate(null)
    setTemplateDialogOpen(true)
  }

  const handleEditTemplate = (template: RecurringSalaryTemplate) => {
    setEditingTemplate(template)
    setTemplateDialogOpen(true)
  }

  const handleDeleteTemplate = (template: RecurringSalaryTemplate) => {
    setTemplateToDelete(template)
    setDeleteTemplateDialogOpen(true)
  }

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return

    setIsDeleting(true)
    const result = await deleteRecurringSalaryTemplate(templateToDelete.id)
    setIsDeleting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(locale === 'bg' ? 'Шаблонът е изтрит' : 'Template deleted')
      loadTemplates()
    }

    setDeleteTemplateDialogOpen(false)
    setTemplateToDelete(null)
  }

  const handleTemplateSuccess = () => {
    loadTemplates()
    loadPendingCount()
  }

  const handleGenerateSalaries = async () => {
    const pendingToGenerate = pendingSalaries.filter(p => !p.already_exists)
    if (pendingToGenerate.length === 0) {
      toast.info(locale === 'bg' ? 'Няма нови записи за генериране' : 'No new entries to generate')
      return
    }

    setIsGenerating(true)
    const result = await generateRecurringSalaries(pendingToGenerate.map(p => p.template.id))
    setIsGenerating(false)

    if (result.errors.length > 0) {
      toast.error(`${result.errors.length} errors occurred`)
    }

    if (result.generated > 0) {
      toast.success(
        locale === 'bg'
          ? `Генерирани ${result.generated} записа`
          : `Generated ${result.generated} entries`
      )
      loadLaborCosts()
      loadTemplates()
      loadPendingCount()
    }
  }

  const costTypes: CostType[] = ['salary', 'bonus', 'overtime', 'benefits', 'taxes', 'other']
  const statuses: PaymentStatus[] = ['pending', 'partially_paid', 'paid']

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">{t('common.admin')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {locale === 'bg' ? 'Разходи за труд' : 'Labor Costs'}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {locale === 'bg' ? 'Разходи за труд' : 'Labor Costs'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {locale === 'bg'
              ? 'Управление на заплати и разходи за персонал'
              : 'Manage salaries and personnel expenses'}
          </p>
        </div>
        <div className="flex gap-2">
          <RecordSalaryPaymentDialog onSuccess={handleSuccess} />
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            {locale === 'bg' ? 'Нов разход' : 'Add Entry'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === 'bg' ? 'Брой записи' : 'Total Entries'}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === 'bg' ? 'Общо на страница' : 'Page Total'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(summaryTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === 'bg' ? 'Чакащи за генериране' : 'Pending Generation'}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="entries" className="space-y-4" onValueChange={(tab) => {
        if (tab === 'templates') loadTemplates()
      }}>
        <TabsList>
          <TabsTrigger value="entries">
            {locale === 'bg' ? 'Записи' : 'Entries'}
          </TabsTrigger>
          <TabsTrigger value="templates" className="relative">
            {locale === 'bg' ? 'Шаблони' : 'Recurring Templates'}
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] px-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <CardTitle>
                {locale === 'bg' ? 'Всички записи' : 'All Entries'}
              </CardTitle>
              <CardDescription>
                {total > 0
                  ? `${total} ${locale === 'bg' ? 'записа' : 'entries'}`
                  : loading
                    ? (locale === 'bg' ? 'Зареждане...' : 'Loading...')
                    : (locale === 'bg' ? 'Няма записи' : 'No entries')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={locale === 'bg' ? 'Търсене по описание...' : 'Search by description...'}
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
                      <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={costType}
                  onValueChange={(v) => {
                    setCostType(v === 'all' ? '' : v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={locale === 'bg' ? 'Всички типове' : 'All types'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {locale === 'bg' ? 'Всички типове' : 'All types'}
                    </SelectItem>
                    {costTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {costTypeLabels[type][locale as 'en' | 'bg']}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v === 'all' ? '' : v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder={locale === 'bg' ? 'Всички статуси' : 'All statuses'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {locale === 'bg' ? 'Всички статуси' : 'All statuses'}
                    </SelectItem>
                    {statuses.map(status => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status][locale as 'en' | 'bg']}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{locale === 'bg' ? 'Период' : 'Period'}</TableHead>
                      <TableHead>{locale === 'bg' ? 'Локация' : 'Location'}</TableHead>
                      <TableHead>{locale === 'bg' ? 'Служител' : 'Staff Member'}</TableHead>
                      <TableHead className="text-center">{locale === 'bg' ? 'Тип' : 'Type'}</TableHead>
                      <TableHead className="text-right">{locale === 'bg' ? 'Сума' : 'Amount'}</TableHead>
                      <TableHead className="text-right">{locale === 'bg' ? 'Платено' : 'Paid'}</TableHead>
                      <TableHead className="text-right">{locale === 'bg' ? 'Остатък' : 'Balance'}</TableHead>
                      <TableHead className="text-center">{locale === 'bg' ? 'Статус' : 'Status'}</TableHead>
                      <TableHead className="w-[120px] text-center">{locale === 'bg' ? 'Действия' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          {locale === 'bg' ? 'Зареждане...' : 'Loading...'}
                        </TableCell>
                      </TableRow>
                    ) : laborCosts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          {locale === 'bg' ? 'Няма записи' : 'No entries found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      laborCosts.map((cost) => (
                        <TableRow key={cost.id} className="even:bg-muted/50">
                          <TableCell className="font-medium whitespace-nowrap">
                            {format(new Date(cost.period_start), 'dd MMM')} - {format(new Date(cost.period_end), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell>
                            {cost.location?.name || '—'}
                          </TableCell>
                          <TableCell>
                            {cost.profile ? (
                              <span>{cost.profile.first_name} {cost.profile.last_name}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={costTypeColors[cost.cost_type]}>
                              {costTypeLabels[cost.cost_type][locale as 'en' | 'bg']}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatAmount(Number(cost.amount))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                            {formatAmount(Number(cost.total_paid))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600 dark:text-orange-400">
                            {formatAmount(Number(cost.balance))}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={statusColors[cost.status]}>
                              {statusLabels[cost.status][locale as 'en' | 'bg']}
                            </Badge>
                          </TableCell>
<TableCell className="text-center">
                                            <div className="flex gap-1 justify-center">
                                              {cost.total_paid > 0 ? (
                                                <SalaryPaymentHistoryDialog
                                                  laborCostId={cost.id}
                                                  laborCostDescription={cost.description}
                                                />
                                              ) : (
                                                <div className="w-8 h-8" />
                                              )}
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEdit(cost)}
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(cost)}
                                                className="text-destructive hover:text-destructive"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </TableCell>
                        </TableRow>
                      ))
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
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {locale === 'bg' ? 'Шаблони за периодични заплати' : 'Recurring Salary Templates'}
                  </CardTitle>
                  <CardDescription>
                    {locale === 'bg'
                      ? 'Автоматично генериране на записи за заплати по график'
                      : 'Auto-generate salary entries on schedule'}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {pendingSalaries.filter(p => !p.already_exists).length > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleGenerateSalaries}
                      disabled={isGenerating}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                      {locale === 'bg'
                        ? `Генерирай (${pendingSalaries.filter(p => !p.already_exists).length})`
                        : `Generate (${pendingSalaries.filter(p => !p.already_exists).length})`}
                    </Button>
                  )}
                  <Button onClick={handleAddTemplate}>
                    <Plus className="mr-2 h-4 w-4" />
                    {locale === 'bg' ? 'Нов шаблон' : 'Add Template'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  {locale === 'bg' ? 'Зареждане...' : 'Loading...'}
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {locale === 'bg' ? 'Няма шаблони' : 'No templates found'}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{locale === 'bg' ? 'Локация' : 'Location'}</TableHead>
                        <TableHead>{locale === 'bg' ? 'Служител' : 'Employee'}</TableHead>
                        <TableHead className="text-center">{locale === 'bg' ? 'Тип' : 'Type'}</TableHead>
                        <TableHead>{locale === 'bg' ? 'Честота' : 'Frequency'}</TableHead>
                        <TableHead className="text-right">{locale === 'bg' ? 'Сума' : 'Amount'}</TableHead>
                        <TableHead>{locale === 'bg' ? 'Следващо генериране' : 'Next Generation'}</TableHead>
                        <TableHead className="text-center">{locale === 'bg' ? 'Статус' : 'Status'}</TableHead>
                        <TableHead className="w-[100px] text-center">{locale === 'bg' ? 'Действия' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((template) => (
                        <TableRow key={template.id} className="even:bg-muted/50">
                          <TableCell>{template.location_name}</TableCell>
                          <TableCell className="font-medium">{template.profile_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={costTypeColors[template.cost_type]}>
                              {costTypeLabels[template.cost_type][locale as 'en' | 'bg']}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {frequencyLabels[template.frequency]?.[locale as 'en' | 'bg'] || template.frequency}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatAmount(template.default_amount)}
                          </TableCell>
                          <TableCell>
                            {template.next_generation_date
                              ? format(new Date(template.next_generation_date), 'dd MMM yyyy')
                              : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={template.is_active ? 'default' : 'secondary'}>
                              {template.is_active
                                ? (locale === 'bg' ? 'Активен' : 'Active')
                                : (locale === 'bg' ? 'Спрян' : 'Paused')}
                            </Badge>
                          </TableCell>
<TableCell className="text-center">
                                            <div className="flex gap-1 justify-center">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEditTemplate(template)}
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteTemplate(template)}
                                                className="text-destructive hover:text-destructive"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <LaborCostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        laborCost={editingCost}
        onSuccess={handleSuccess}
      />

      <RecurringSalaryDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        template={editingTemplate}
        onSuccess={handleTemplateSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === 'bg' ? 'Изтриване на запис' : 'Delete Entry'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === 'bg'
                ? 'Сигурни ли сте, че искате да изтриете този запис? Това действие е необратимо.'
                : 'Are you sure you want to delete this entry? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {locale === 'bg' ? 'Отказ' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting
                ? (locale === 'bg' ? 'Изтриване...' : 'Deleting...')
                : (locale === 'bg' ? 'Изтрий' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === 'bg' ? 'Изтриване на шаблон' : 'Delete Template'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === 'bg'
                ? 'Сигурни ли сте, че искате да изтриете този шаблон? Това действие е необратимо.'
                : 'Are you sure you want to delete this template? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {locale === 'bg' ? 'Отказ' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTemplate} disabled={isDeleting}>
              {isDeleting
                ? (locale === 'bg' ? 'Изтриване...' : 'Deleting...')
                : (locale === 'bg' ? 'Изтрий' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
