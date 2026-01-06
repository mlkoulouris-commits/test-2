'use client'

import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { CalendarIcon, ChevronDown, ChevronRight, Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useLanguage } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import {
  ProfitLossData,
  PLLineItem,
  PLSection,
  PLSourceDetail,
  getProfitLossData,
  getPLLocations,
} from '@/lib/actions/profit-loss'
import { useCurrency } from '@/lib/i18n/currency'
import * as XLSX from 'xlsx'

export default function ProfitLossPage() {
  const { locale, t } = useLanguage()
  const { formatAmount } = useCurrency()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ProfitLossData | null>(null)
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])

  // Filters
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()))
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()))
  const [locationId, setLocationId] = useState<string>('')

  // Display options
  const [excludeVat, setExcludeVat] = useState(true)
  const [showPercentages, setShowPercentages] = useState(true)
  const [useFiscalDate, setUseFiscalDate] = useState(true)

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['revenue', 'cogs', 'labor', 'operating_expense', 'non_operating'])
  )
  const [excludedSalesExpanded, setExcludedSalesExpanded] = useState(false)
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    loadData()
  }, [dateFrom, dateTo, locationId, useFiscalDate])

  const loadLocations = async () => {
    const result = await getPLLocations()
    if (result.data) {
      setLocations(result.data)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)

    const result = await getProfitLossData({
      dateFrom: format(dateFrom, 'yyyy-MM-dd'),
      dateTo: format(dateTo, 'yyyy-MM-dd'),
      locationId: locationId || undefined,
      useFiscalDate,
    })

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setData(result.data)
      // All collapsed by default
      setExpandedAccounts(new Set())
    }
    setLoading(false)
  }

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const toggleAccount = (accountId: number) => {
    const newExpanded = new Set(expandedAccounts)
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId)
    } else {
      newExpanded.add(accountId)
    }
    setExpandedAccounts(newExpanded)
  }

  const setQuickDate = (period: 'this-month' | 'last-month' | 'ytd') => {
    const now = new Date()
    switch (period) {
      case 'this-month':
        setDateFrom(startOfMonth(now))
        setDateTo(endOfMonth(now))
        break
      case 'last-month':
        const lastMonth = subMonths(now, 1)
        setDateFrom(startOfMonth(lastMonth))
        setDateTo(endOfMonth(lastMonth))
        break
      case 'ytd':
        setDateFrom(new Date(now.getFullYear(), 0, 1))
        setDateTo(now)
        break
    }
  }

  // Get adjusted revenue for percentage calculations (base for all percentages)
  const getBaseRevenue = (): number => {
    if (!data) return 0
    return excludeVat ? data.revenue.netTotal : data.revenue.total
  }

  // Calculate percentage of revenue using the appropriate amount (net or gross)
  const calcPercentage = (amount: number, netAmount: number): string => {
    const baseRevenue = getBaseRevenue()
    if (baseRevenue === 0) return '0.0%'
    const displayAmount = excludeVat ? netAmount : amount
    const pct = (displayAmount / baseRevenue) * 100
    return `${pct.toFixed(1)}%`
  }

  // Helper to get display amount based on excludeVat setting
  const getDisplayAmount = (amount: number, netAmount: number): number => {
    return excludeVat ? netAmount : amount
  }

  type ExportRow = {
    code: string
    name: string
    percentage: string
    amount: number
  }

  const buildExportRows = (): ExportRow[] => {
    if (!data) return []

    const rows: ExportRow[] = []

    const addItemRows = (items: PLLineItem[], indent: number) => {
      items.forEach((item) => {
        const indentStr = '  '.repeat(indent)
        const itemName = locale === 'bg' && item.nameBg ? item.nameBg : item.name

        rows.push({
          code: item.code,
          name: `${indentStr}${itemName}`,
          percentage: calcPercentage(item.amount, item.netAmount),
          amount: getDisplayAmount(item.amount, item.netAmount),
        })

        if (item.children?.length) {
          addItemRows(item.children, indent + 1)
        }

        if (item.sourceDetails?.length) {
          item.sourceDetails.forEach((detail: PLSourceDetail) => {
            const detailIndent = '  '.repeat(indent + 1)
            const parentAmount = excludeVat ? item.netAmount : item.amount
            const detailAmount = excludeVat ? detail.netAmount : detail.amount
            const pctOfParent =
              parentAmount !== 0 ? ((detailAmount / parentAmount) * 100).toFixed(1) : '0.0'

            rows.push({
              code: '',
              name: `${detailIndent}${detail.name}`,
              percentage: `${pctOfParent}%`,
              amount: getDisplayAmount(detail.amount, detail.netAmount),
            })
          })
        }
      })
    }

    const addSectionRows = (section: PLSection, sectionName: string) => {
      rows.push({
        code: '',
        name: sectionName,
        percentage: calcPercentage(section.total, section.netTotal),
        amount: getDisplayAmount(section.total, section.netTotal),
      })

      addItemRows(section.items, 1)
    }

    // Add excluded sales info if any
    if (data.excludedSales && data.excludedSales.total.count > 0) {
      rows.push({
        code: '',
        name: locale === 'bg' ? 'Изключени продажби' : 'Excluded Sales',
        percentage: '',
        amount: getDisplayAmount(data.excludedSales.total.amount, data.excludedSales.total.netAmount),
      })
      if (data.excludedSales.voids.count > 0) {
        rows.push({
          code: '',
          name: `  ${locale === 'bg' ? 'Анулирани продажби' : 'Voided Sales'} (${data.excludedSales.voids.count})`,
          percentage: '',
          amount: getDisplayAmount(data.excludedSales.voids.amount, data.excludedSales.voids.netAmount),
        })
      }
      if (data.excludedSales.noPaymentMethod.count > 0) {
        rows.push({
          code: '',
          name: `  ${locale === 'bg' ? 'Без метод на плащане' : 'No Payment Method'} (${data.excludedSales.noPaymentMethod.count})`,
          percentage: '',
          amount: getDisplayAmount(data.excludedSales.noPaymentMethod.amount, data.excludedSales.noPaymentMethod.netAmount),
        })
      }
      if (data.excludedSales.tips.count > 0) {
        rows.push({
          code: '',
          name: `  ${locale === 'bg' ? 'Бакшиши/Типсове' : 'Tips/Gratuities'} (${data.excludedSales.tips.count})`,
          percentage: '',
          amount: getDisplayAmount(data.excludedSales.tips.amount, data.excludedSales.tips.netAmount),
        })
      }
      rows.push({ code: '', name: '', percentage: '', amount: 0 }) // Empty row separator
    }

    addSectionRows(data.revenue, locale === 'bg' ? 'Приходи' : 'Revenue')
    addSectionRows(
      data.cogs,
      locale === 'bg' ? 'Себестойност на продадените стоки' : 'Cost of Goods Sold'
    )
    rows.push({
      code: '',
      name: locale === 'bg' ? 'Брутна печалба' : 'Gross Profit',
      percentage: calcPercentage(data.grossProfit, data.netGrossProfit),
      amount: getDisplayAmount(data.grossProfit, data.netGrossProfit),
    })
    addSectionRows(data.labor, locale === 'bg' ? 'Разходи за труд' : 'Labor Costs')
    addSectionRows(data.operatingExpenses, locale === 'bg' ? 'Оперативни разходи' : 'Operating Expenses')
    rows.push({
      code: '',
      name: locale === 'bg' ? 'Оперативна печалба' : 'Operating Income',
      percentage: calcPercentage(data.operatingIncome, data.netOperatingIncome),
      amount: getDisplayAmount(data.operatingIncome, data.netOperatingIncome),
    })
    addSectionRows(data.nonOperating, locale === 'bg' ? 'Неоперативни позиции' : 'Non-Operating Items')
    rows.push({
      code: '',
      name: locale === 'bg' ? 'Нетна печалба' : 'Net Income',
      percentage: calcPercentage(data.netIncome, data.netNetIncome),
      amount: getDisplayAmount(data.netIncome, data.netNetIncome),
    })

    return rows
  }

  const exportToExcel = () => {
    if (!data) return

    const rows = buildExportRows()
    const headers = [
      locale === 'bg' ? 'Код' : 'Code',
      locale === 'bg' ? 'Описание' : 'Description',
      locale === 'bg' ? '% от приходи' : '% of Revenue',
      excludeVat ? (locale === 'bg' ? 'Нето (BGN)' : 'Net (BGN)') : (locale === 'bg' ? 'Сума (BGN)' : 'Amount (BGN)'),
    ]

    const title = locale === 'bg' ? 'Отчет за приходи и разходи' : 'Profit & Loss Statement'
    const subtitle = `${data.locationName || (locale === 'bg' ? 'Всички локации' : 'All locations')} • ${format(dateFrom, 'dd MMM yyyy')} - ${format(dateTo, 'dd MMM yyyy')}`

    const wsData: Array<Array<string | number>> = [
      [title],
      [subtitle],
      [],
      headers,
      ...rows.map((row) => [row.code, row.name, row.percentage, row.amount]),
    ]

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 10 }, { wch: 56 }, { wch: 12 }, { wch: 16 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'P&L')

    const fileName = `profit-loss_${format(dateFrom, 'yyyy-MM-dd')}_${format(dateTo, 'yyyy-MM-dd')}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  const exportToCSV = () => {
    if (!data) return

    const rows = buildExportRows()
    const headers = [
      locale === 'bg' ? 'Код' : 'Code',
      locale === 'bg' ? 'Описание' : 'Description',
      locale === 'bg' ? '% от приходи' : '% of Revenue',
      excludeVat ? (locale === 'bg' ? 'Нето (BGN)' : 'Net (BGN)') : (locale === 'bg' ? 'Сума (BGN)' : 'Amount (BGN)'),
    ]

    const escapeCSV = (val: string | number): string => {
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const csvRows = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => [row.code, row.name, row.percentage, row.amount.toFixed(2)].map(escapeCSV).join(',')),
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `profit-loss_${format(dateFrom, 'yyyy-MM-dd')}_${format(dateTo, 'yyyy-MM-dd')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const isExportAvailable = !!data && !loading && !error

  const renderLineItem = (item: PLLineItem, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const hasSourceDetails = item.sourceDetails && item.sourceDetails.length > 0
    const isExpandable = hasChildren || hasSourceDetails
    const isExpanded = expandedAccounts.has(item.accountId)
    const paddingLeft = depth * 24 + 16
    const displayAmount = getDisplayAmount(item.amount, item.netAmount)

    return (
      <div key={item.accountId}>
        <div
          className={cn(
            'flex items-center justify-between py-2 px-4 hover:bg-muted/50',
            item.level === 1 && 'font-semibold bg-muted/30',
            item.level === 2 && 'font-medium'
          )}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          <div className="flex items-center gap-2">
            {isExpandable ? (
              <button
                onClick={() => toggleAccount(item.accountId)}
                className="h-5 w-5 flex items-center justify-center"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className="font-mono text-xs text-muted-foreground mr-2">
              {item.code}
            </span>
            <span>
              {locale === 'bg' && item.nameBg ? item.nameBg : item.name}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {showPercentages && (
              <span className="font-mono tabular-nums text-muted-foreground text-sm w-16 text-right">
                {calcPercentage(item.amount, item.netAmount)}
              </span>
            )}
            <span className={cn(
              'font-mono tabular-nums w-36 text-right',
              displayAmount < 0 && 'text-red-600 dark:text-red-400'
            )}>
              {formatAmount(displayAmount)}
            </span>
          </div>
        </div>
        {/* Render children if account has children */}
        {hasChildren && isExpanded && item.children?.map(child => renderLineItem(child, depth + 1))}
        {/* Render source details (articles/vendors) for leaf nodes */}
        {!hasChildren && hasSourceDetails && isExpanded && (
          <div className="border-l-2 border-muted ml-8">
            {item.sourceDetails?.slice(0, 20).map((detail) => {
              const detailAmount = getDisplayAmount(detail.amount, detail.netAmount)
              const parentAmount = excludeVat ? item.netAmount : item.amount
              const detailAmountForPct = excludeVat ? detail.netAmount : detail.amount
              const pctOfParent = parentAmount !== 0
                ? ((detailAmountForPct / parentAmount) * 100).toFixed(1)
                : '0.0'

              return (
                <div
                  key={detail.id}
                  className="flex items-center justify-between py-1.5 px-4 text-sm text-muted-foreground hover:bg-muted/30"
                  style={{ paddingLeft: `${paddingLeft + 32}px` }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted capitalize">
                      {detail.type === 'article'
                        ? (locale === 'bg' ? 'арт.' : 'art.')
                        : detail.type === 'vendor'
                        ? (locale === 'bg' ? 'дост.' : 'vnd.')
                        : detail.type === 'labor'
                        ? (locale === 'bg' ? 'труд' : 'labor')
                        : detail.type}
                    </span>
                    <span className="truncate">{detail.name}</span>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {showPercentages && (
                      <span className="font-mono tabular-nums text-xs w-16 text-right">
                        {pctOfParent}%
                      </span>
                    )}
                    <span className={cn(
                      'font-mono tabular-nums w-36 text-right',
                      detailAmount < 0 && 'text-red-600 dark:text-red-400'
                    )}>
                      {formatAmount(detailAmount)}
                    </span>
                  </div>
                </div>
              )
            })}
            {item.sourceDetails && item.sourceDetails.length > 20 && (
              <div
                className="py-1.5 px-4 text-xs text-muted-foreground italic"
                style={{ paddingLeft: `${paddingLeft + 32}px` }}
              >
                {locale === 'bg'
                  ? `... и още ${item.sourceDetails.length - 20} позиции`
                  : `... and ${item.sourceDetails.length - 20} more items`}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderSection = (section: PLSection) => {
    const isExpanded = expandedSections.has(section.id)
    const displayTotal = getDisplayAmount(section.total, section.netTotal)

    return (
      <div className="border-b last:border-b-0">
        <button
          onClick={() => toggleSection(section.id)}
          className="w-full flex items-center justify-between py-3 px-4 bg-muted/50 hover:bg-muted font-semibold"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
            <span className="text-lg">
              {locale === 'bg' ? section.nameBg : section.name}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {showPercentages && (
              <span className="font-mono tabular-nums text-muted-foreground w-16 text-right">
                {calcPercentage(section.total, section.netTotal)}
              </span>
            )}
            <span className={cn(
              'font-mono tabular-nums text-lg w-36 text-right',
              displayTotal < 0 && 'text-red-600 dark:text-red-400'
            )}>
              {formatAmount(displayTotal)}
            </span>
          </div>
        </button>
        {isExpanded && (
          <div className="border-t">
            {section.items.length > 0 ? (
              section.items.map(item => renderLineItem(item))
            ) : (
              <div className="py-4 px-8 text-muted-foreground text-sm">
                {locale === 'bg' ? 'Няма данни за този период' : 'No data for this period'}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderSubtotal = (label: string, labelBg: string, amount: number, netAmount: number, highlight?: boolean) => {
    const displayAmount = getDisplayAmount(amount, netAmount)

    return (
      <div className={cn(
        'flex items-center justify-between py-3 px-4 font-bold',
        highlight ? 'bg-primary/10 text-lg' : 'bg-muted/30 border-b'
      )}>
        <span>{locale === 'bg' ? labelBg : label}</span>
        <div className="flex items-center gap-4">
          {showPercentages && (
            <span className={cn(
              'font-mono tabular-nums w-16 text-right',
              highlight ? 'text-lg' : 'text-muted-foreground'
            )}>
              {calcPercentage(amount, netAmount)}
            </span>
          )}
          <span className={cn(
            'font-mono tabular-nums w-36 text-right',
            displayAmount < 0 && 'text-red-600 dark:text-red-400',
            displayAmount > 0 && highlight && 'text-green-600 dark:text-green-400'
          )}>
            {formatAmount(displayAmount)}
          </span>
        </div>
      </div>
    )
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
            <BreadcrumbPage>
              {locale === 'bg' ? 'Отчет за приходи и разходи' : 'Profit & Loss'}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {locale === 'bg' ? 'Отчет за приходи и разходи' : 'Profit & Loss Statement'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {locale === 'bg'
              ? 'Финансов отчет за избрания период'
              : 'Financial report for the selected period'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={!isExportAvailable}>
            <Download className="mr-2 h-4 w-4" />
            {locale === 'bg' ? 'Excel' : 'Excel'}
          </Button>
          <Button variant="outline" onClick={exportToCSV} disabled={!isExportAvailable}>
            <Download className="mr-2 h-4 w-4" />
            {locale === 'bg' ? 'CSV' : 'CSV'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date From */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {locale === 'bg' ? 'От дата' : 'From Date'}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, 'dd MMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => d && setDateFrom(d)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {locale === 'bg' ? 'До дата' : 'To Date'}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, 'dd MMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => d && setDateTo(d)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {locale === 'bg' ? 'Локация' : 'Location'}
              </label>
              <Select
                value={locationId}
                onValueChange={(v) => setLocationId(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-full">
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
            </div>

            {/* Quick Date Buttons */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {locale === 'bg' ? 'Бърз избор' : 'Quick Select'}
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setQuickDate('this-month')}
                >
                  {locale === 'bg' ? 'Този м.' : 'This Mo.'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setQuickDate('last-month')}
                >
                  {locale === 'bg' ? 'Мин. м.' : 'Last Mo.'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setQuickDate('ytd')}
                >
                  {locale === 'bg' ? 'YTD' : 'YTD'}
                </Button>
              </div>
            </div>
          </div>

          {/* Display Options */}
          <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t">
            <div className="flex items-center gap-3">
              <Switch
                id="exclude-vat"
                checked={excludeVat}
                onCheckedChange={setExcludeVat}
              />
              <Label htmlFor="exclude-vat" className="text-sm cursor-pointer">
                {locale === 'bg' ? 'Без ДДС (нето)' : 'Exclude VAT (net)'}
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="show-percentages"
                checked={showPercentages}
                onCheckedChange={setShowPercentages}
              />
              <Label htmlFor="show-percentages" className="text-sm cursor-pointer">
                {locale === 'bg' ? '% от приходи' : '% of Revenue'}
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="fiscal-date"
                checked={useFiscalDate}
                onCheckedChange={setUseFiscalDate}
              />
              <Label htmlFor="fiscal-date" className="text-sm cursor-pointer">
                {locale === 'bg' ? 'Фискална дата' : 'Fiscal Period'}
              </Label>
              <span className="text-xs text-muted-foreground">
                {useFiscalDate ? (locale === 'bg' ? '(6:45 AM)' : '(6:45 AM)') : ''}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* P&L Statement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {locale === 'bg' ? 'Отчет за приходи и разходи' : 'Profit & Loss Statement'}
          </CardTitle>
          <CardDescription>
            {data?.locationName
              ? `${data.locationName} • `
              : (locale === 'bg' ? 'Всички локации • ' : 'All locations • ')}
            {format(dateFrom, 'dd MMM yyyy')} - {format(dateTo, 'dd MMM yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              {locale === 'bg' ? 'Зареждане...' : 'Loading...'}
            </div>
          ) : error ? (
            <div className="py-12 text-center text-destructive">{error}</div>
          ) : data ? (
            <div className="divide-y">
              {/* Column headers */}
              <div className="flex items-center justify-end py-2 px-4 bg-muted/80 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {showPercentages && (
                  <span className="w-16 text-right mr-4">
                    {locale === 'bg' ? '% прих.' : '% Rev'}
                  </span>
                )}
                <span className="w-36 text-right">
                  {excludeVat
                    ? (locale === 'bg' ? 'Нето (BGN)' : 'Net (BGN)')
                    : (locale === 'bg' ? 'Сума (BGN)' : 'Amount (BGN)')}
                </span>
              </div>
              {/* Excluded Sales Info */}
              {data.excludedSales && data.excludedSales.total.count > 0 && (
                <div className="border-b border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
                  <button
                    onClick={() => setExcludedSalesExpanded(!excludedSalesExpanded)}
                    className="w-full flex items-center justify-between py-3 px-4 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 font-semibold"
                  >
                    <div className="flex items-center gap-2">
                      {excludedSalesExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                      <span className="text-base">
                        {locale === 'bg' ? 'Изключени продажби' : 'Excluded Sales'}
                      </span>
                      <span className="text-xs text-muted-foreground font-normal">
                        ({data.excludedSales.total.count})
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {showPercentages && (
                        <span className="font-mono tabular-nums text-muted-foreground text-sm w-16 text-right">
                          -
                        </span>
                      )}
                      <span className="font-mono tabular-nums text-sm w-36 text-right">
                        {formatAmount(excludeVat ? data.excludedSales.total.netAmount : data.excludedSales.total.amount)}
                      </span>
                    </div>
                  </button>
                  {excludedSalesExpanded && (
                    <div className="border-t border-amber-200 dark:border-amber-900 px-4 py-3 space-y-3">
                      {data.excludedSales.voids.count > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {locale === 'bg' ? 'Анулирани продажби' : 'Voided Sales'} ({data.excludedSales.voids.count})
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatAmount(excludeVat ? data.excludedSales.voids.netAmount : data.excludedSales.voids.amount)}
                          </span>
                        </div>
                      )}
                      {data.excludedSales.noPaymentMethod.count > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {locale === 'bg' ? 'Без метод на плащане' : 'No Payment Method'} ({data.excludedSales.noPaymentMethod.count})
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatAmount(excludeVat ? data.excludedSales.noPaymentMethod.netAmount : data.excludedSales.noPaymentMethod.amount)}
                          </span>
                        </div>
                      )}
                      {data.excludedSales.tips.count > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {locale === 'bg' ? 'Бакшиши/Типсове' : 'Tips/Gratuities'} ({data.excludedSales.tips.count})
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatAmount(excludeVat ? data.excludedSales.tips.netAmount : data.excludedSales.tips.amount)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-900 font-medium">
                        <span>
                          {locale === 'bg' ? 'Общо изключени' : 'Total Excluded'} ({data.excludedSales.total.count})
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatAmount(excludeVat ? data.excludedSales.total.netAmount : data.excludedSales.total.amount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Revenue */}
              {renderSection(data.revenue)}

              {/* COGS */}
              {renderSection(data.cogs)}

              {/* Gross Profit */}
              {renderSubtotal('Gross Profit', 'Брутна печалба', data.grossProfit, data.netGrossProfit)}

              {/* Labor Costs */}
              {renderSection(data.labor)}

              {/* Operating Expenses */}
              {renderSection(data.operatingExpenses)}

              {/* Operating Income */}
              {renderSubtotal('Operating Income', 'Оперативна печалба', data.operatingIncome, data.netOperatingIncome)}

              {/* Non-Operating Items */}
              {renderSection(data.nonOperating)}

              {/* Net Income */}
              {renderSubtotal('Net Income', 'Нетна печалба', data.netIncome, data.netNetIncome, true)}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              {locale === 'bg' ? 'Няма данни' : 'No data available'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
