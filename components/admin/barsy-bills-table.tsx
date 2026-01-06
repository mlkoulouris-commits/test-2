'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Check, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react'
import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { bulkApproveBarsyBills, BarsyBill } from '@/lib/actions/barsy-bills-approval'
import { BarsyBillDetailDialog } from './barsy-bill-detail-dialog'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'
import { useDateFormatter } from '@/lib/i18n/date-formatter'

interface BarsyBillsTableProps {
  bills: BarsyBill[]
  showApproved?: boolean
  searchSlot?: React.ReactNode
}

type SortField = 'doc_num' | 'vendor_name' | 'location_name' | 'doc_date' | 'paid_due_date' | 'total_sum'
type SortDirection = 'asc' | 'desc' | null

export const BarsyBillsTable = ({ bills, showApproved = false, searchSlot }: BarsyBillsTableProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()
  const { formatDate: formatDateLocale } = useDateFormatter()
  const router = useRouter()
  const [selectedBills, setSelectedBills] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedBill, setSelectedBill] = useState<BarsyBill | null>(null)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection('asc')
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1" />
    }
    return <ArrowDown className="h-4 w-4 ml-1" />
  }

  const filteredBills = useMemo(() => {
    if (!searchQuery.trim()) return bills

    const query = searchQuery.toLowerCase()
    return bills.filter(bill => {
      const billNum = (bill.doc_num || bill.store_load_id.toString()).toLowerCase()
      const vendor = (bill.vendor_name || bill.supplier_name || '').toLowerCase()
      const location = (bill.location_name || '').toLowerCase()
      const amount = bill.total_sum.toString()
      const vat = bill.vat_amount ? bill.vat_amount.toString() : ''
      const totalWithVat =
        (bill.total_sum_gross ?? (bill.total_sum + (bill.vat_amount ?? 0))).toString()

      return (
        billNum.includes(query) ||
        vendor.includes(query) ||
        location.includes(query) ||
        amount.includes(query) ||
        vat.includes(query) ||
        totalWithVat.includes(query)
      )
    })
  }, [bills, searchQuery])

  const sortedBills = useMemo(() => {
    const billsToSort = filteredBills

    if (!sortField || !sortDirection) return billsToSort

    return [...billsToSort].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'doc_num':
          aValue = a.doc_num || a.store_load_id.toString()
          bValue = b.doc_num || b.store_load_id.toString()
          break
        case 'vendor_name':
          aValue = (a.vendor_name || a.supplier_name || '').toLowerCase()
          bValue = (b.vendor_name || b.supplier_name || '').toLowerCase()
          break
        case 'location_name':
          aValue = (a.location_name || '').toLowerCase()
          bValue = (b.location_name || '').toLowerCase()
          break
        case 'doc_date':
          aValue = a.doc_date ? new Date(a.doc_date).getTime() : 0
          bValue = b.doc_date ? new Date(b.doc_date).getTime() : 0
          break
        case 'paid_due_date':
          aValue = a.paid_due_date ? new Date(a.paid_due_date).getTime() : 0
          bValue = b.paid_due_date ? new Date(b.paid_due_date).getTime() : 0
          break
        case 'total_sum':
          aValue = a.total_sum
          bValue = b.total_sum
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredBills, sortField, sortDirection])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return formatDateLocale(date, 'MM/dd/yyyy')
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBills(new Set(sortedBills.map(b => b.id)))
    } else {
      setSelectedBills(new Set())
    }
  }

  const handleSelectBill = (billId: number, checked: boolean) => {
    const newSelected = new Set(selectedBills)
    if (checked) {
      newSelected.add(billId)
    } else {
      newSelected.delete(billId)
    }
    setSelectedBills(newSelected)
  }

  const handleRowClick = (bill: BarsyBill) => {
    setSelectedBill(bill)
    setDetailDialogOpen(true)
  }

  const handleNavigate = (bill: BarsyBill) => {
    setSelectedBill(bill)
  }

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleBulkApprove = async () => {
    if (selectedBills.size === 0) return

    setIsLoading(true)
    setError(null)
    const result = await bulkApproveBarsyBills(Array.from(selectedBills))

    if (result.data.failed.length > 0) {
      setError(`Failed to approve ${result.data.failed.length} bills. Check console for details.`)
      console.error('Failed approvals:', result.data.failed)
    }

    setSelectedBills(new Set())
    router.refresh()
    setIsLoading(false)
  }


  const allSelected = sortedBills.length > 0 && selectedBills.size === sortedBills.length
  const someSelected = selectedBills.size > 0 && selectedBills.size < sortedBills.length

  return (
    <div className="space-y-4">
      {searchSlot ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('barsyTable.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex-shrink-0">
            {searchSlot}
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('barsyTable.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {!showApproved && selectedBills.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
          <span className="text-sm font-medium">{selectedBills.size} {t('barsyTable.billsSelected')}</span>
          <Button
            size="sm"
            onClick={handleBulkApprove}
            disabled={isLoading}
            className="ml-auto"
          >
            <Check className="h-4 w-4 mr-2" />
            {t('barsyTable.approveSelected')}
          </Button>
        </div>
      )}

      {error && (
        <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">{error}</div>
      )}

      {sortedBills.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">
            {searchQuery ? t('barsyTable.noBillsFound') : (showApproved ? t('barsyTable.noApproved') : t('barsyTable.noPending'))}
          </p>
          <p className="text-sm mt-1">
            {searchQuery
              ? t('barsyTable.adjustSearch')
              : (showApproved
                ? t('barsyTable.noApprovedYet')
                : t('barsyTable.allProcessed'))
            }
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {!showApproved && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={allSelected || someSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                      disabled={isLoading}
                    />
                  </TableHead>
                )}
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 hover:bg-transparent"
                    onClick={() => handleSort('doc_num')}
                  >
                    <span>{t('barsyTable.billNumber')}</span>
                    {getSortIcon('doc_num')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 hover:bg-transparent"
                    onClick={() => handleSort('vendor_name')}
                  >
                    <span>{t('barsyTable.vendorSupplier')}</span>
                    {getSortIcon('vendor_name')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 hover:bg-transparent"
                    onClick={() => handleSort('location_name')}
                  >
                    <span>{t('common.location')}</span>
                    {getSortIcon('location_name')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 hover:bg-transparent"
                    onClick={() => handleSort('doc_date')}
                  >
                    <span>{t('barsyTable.date')}</span>
                    {getSortIcon('doc_date')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 hover:bg-transparent"
                    onClick={() => handleSort('paid_due_date')}
                  >
                    <span>{t('billDialog.dueDate')}</span>
                    {getSortIcon('paid_due_date')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 hover:bg-transparent"
                    onClick={() => handleSort('total_sum')}
                  >
                    <span>{t('billsTable.amount')}</span>
                    {getSortIcon('total_sum')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">{t('billsTable.vat')}</TableHead>
                <TableHead className="text-right">{t('barsyTable.totalIncludingVat')}</TableHead>
                <TableHead className="text-center">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBills.map((bill, index) => (
                <TableRow
                  key={bill.id}
                  className={`cursor-pointer hover:bg-muted/50 ${index % 2 === 1 ? 'bg-muted/30' : ''}`}
                  onClick={() => handleRowClick(bill)}
                >
                  {!showApproved && (
                    <TableCell onClick={handleActionClick}>
                      <Checkbox
                        checked={selectedBills.has(bill.id)}
                        onCheckedChange={(checked) => handleSelectBill(bill.id, checked as boolean)}
                        disabled={isLoading}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    {bill.doc_num || `#${bill.store_load_id}`}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{bill.vendor_name || bill.supplier_name || '—'}</div>
                      {!bill.vendor_id && (
                        <Badge variant="destructive" className="text-xs mt-1">
                          {t('barsyTable.noVendorLinked')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {bill.location_name || '—'}
                  </TableCell>
                  <TableCell>{formatDate(bill.doc_date)}</TableCell>
                  <TableCell>{formatDate(bill.paid_due_date)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(bill.total_sum, 'BGN')}
                  </TableCell>
                  <TableCell className="text-right">
                    {bill.has_vat ? formatAmount(bill.vat_amount ?? 0, 'BGN') : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(
                      bill.total_sum_gross ?? (bill.total_sum + (bill.vat_amount ?? 0)),
                      'BGN'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {showApproved ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        {t('barsyTable.approved')}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t('barsyTable.clickReview')}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BarsyBillDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        bill={selectedBill}
        allBills={sortedBills}
        onNavigate={handleNavigate}
        showApproved={showApproved}
      />
    </div>
  )
}
