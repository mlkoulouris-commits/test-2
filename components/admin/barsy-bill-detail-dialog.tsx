'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { approveBarsyBill, rejectBarsyBill, getBarsyBillItems, BarsyBill } from '@/lib/actions/barsy-bills-approval'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'
import { useDateFormatter } from '@/lib/i18n/date-formatter'

interface BillItem {
  id: number
  barsy_article_id: number | null
  article_name: string | null
  quantity: number
  unit_price: number
  total_price: number
  amount_type: string | null
  vat_rate?: number | null
  vat_amount?: number | null
}

interface BarsyBillDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bill: BarsyBill | null
  allBills: BarsyBill[]
  onNavigate: (bill: BarsyBill) => void
  showApproved?: boolean
}

export const BarsyBillDetailDialog = ({
  open,
  onOpenChange,
  bill,
  allBills,
  onNavigate,
  showApproved = false
}: BarsyBillDetailDialogProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()
  const { formatDate: formatDateLocale } = useDateFormatter()
  const router = useRouter()
  const [items, setItems] = useState<BillItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)

  useEffect(() => {
    if (open && bill) {
      setLoading(true)
      setError(null)
      getBarsyBillItems(bill.id)
        .then(result => {
          if (result.data) {
            setItems(result.data)
          } else if (result.error) {
            setError(result.error)
          }
        })
        .finally(() => setLoading(false))
    } else {
      setItems([])
      setError(null)
    }
  }, [open, bill])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return formatDateLocale(date, 'MMM d, yyyy')
  }

  const itemsTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0)
  const itemsVatTotal = items.reduce((sum, item) => sum + (Number(item.vat_amount || 0) || 0), 0)
  const hasItemVat = items.some((item) => item.vat_amount !== null && item.vat_amount !== undefined)

  // During dialog open/close and navigation, `bill` can temporarily be null.
  // Guard before reading any bill fields.
  if (!bill) return null

  const netTotal =
    bill.total_sum_net !== null && bill.total_sum_net !== undefined
      ? Number(bill.total_sum_net)
      : itemsTotal

  const vatAmount =
    bill.has_vat
      ? (bill.vat_amount !== null && bill.vat_amount !== undefined
          ? Number(bill.vat_amount)
          : (hasItemVat ? itemsVatTotal : 0))
      : 0

  const grossTotal =
    bill.total_sum_gross !== null && bill.total_sum_gross !== undefined
      ? Number(bill.total_sum_gross)
      : bill.has_vat
      ? netTotal + vatAmount
      : Number(bill.total_sum || 0)

  const currentIndex = bill ? allBills.findIndex(b => b.id === bill.id) : -1
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < allBills.length - 1

  const handlePrevious = () => {
    if (hasPrevious && bill) {
      const prevBill = allBills[currentIndex - 1]
      onNavigate(prevBill)
    }
  }

  const handleNext = () => {
    if (hasNext && bill) {
      const nextBill = allBills[currentIndex + 1]
      onNavigate(nextBill)
    }
  }

  const handleApprove = async () => {
    if (!bill) return

    setIsProcessing(true)
    setError(null)
    const result = await approveBarsyBill(bill.id)

    if (result.error) {
      setError(result.error)
      setIsProcessing(false)
    } else {
      router.refresh()
      // Auto-navigate to next bill if available
      if (hasNext) {
        handleNext()
      } else {
        onOpenChange(false)
      }
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!bill) return

    setIsProcessing(true)
    setError(null)
    const result = await rejectBarsyBill(bill.id, 'Rejected by user')

    if (result.error) {
      setError(result.error)
      setIsProcessing(false)
    } else {
      router.refresh()
      setRejectDialogOpen(false)
      // Auto-navigate to next bill if available
      if (hasNext) {
        handleNext()
      } else {
        onOpenChange(false)
      }
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-7xl w-[90vw] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl">
                  {t('billDialog.bill')} {bill.doc_num || `#${bill.store_load_id}`}
                  <Badge variant="secondary" className="ml-3">{t('barsyDetail.pendingApproval')}</Badge>
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('barsyDetail.reviewDetails')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={!hasPrevious || isProcessing}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentIndex + 1} / {allBills.length}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleNext}
                  disabled={!hasNext || isProcessing}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
          ) : (
            <div className="space-y-6 overflow-y-auto overflow-x-hidden pr-2">
              {/* Bill Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground">{t('barsyDetail.vendorSupplier')}</div>
                  <div className="font-medium text-sm">
                    {bill.vendor_name || bill.supplier_name || '—'}
                    {!bill.vendor_id && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        {t('barsyTable.noVendorLinked')}
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">{t('billDialog.location')}</div>
                  <div className="font-medium text-sm">{bill.location_name || '—'}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">{t('billDialog.source')}</div>
                  <div className="font-medium text-sm">{t('billDialog.sourceBarsy')}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">{t('billDialog.billDate')}</div>
                  <div className="font-medium text-sm">{formatDate(bill.doc_date)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">{t('billDialog.dueDate')}</div>
                  <div className="font-medium text-sm">{formatDate(bill.paid_due_date)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">{t('common.status')}</div>
                  <Badge variant="secondary">{t('barsyDetail.barsyStatus')}: {bill.status}</Badge>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    {bill.has_vat ? t('barsyDetail.totalIncludingVat') : t('billDialog.totalAmount')}
                  </div>
                  <div className="font-semibold text-base">{formatAmount(grossTotal, 'BGN')}</div>
                </div>

                {bill.has_vat && (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">{t('barsyDetail.netAmount')}</div>
                      <div className="font-semibold text-base">{formatAmount(netTotal, 'BGN')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {t('billsTable.vat')}
                        {bill.vat_rate ? ` (${Number(bill.vat_rate).toFixed(2)}%)` : ''}
                      </div>
                      <div className="font-semibold text-base text-amber-600 dark:text-amber-400">
                        {formatAmount(vatAmount, 'BGN')}
                      </div>
                    </div>
                  </>
                )}

                {bill.description && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <div className="text-xs text-muted-foreground">{t('billDialog.description')}</div>
                    <div className="font-medium text-sm">{bill.description}</div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Line Items */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('barsyDetail.lineItems')}</h3>

                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('barsyDetail.noLineItems')}
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr className="border-b">
                            <th className="p-4 text-left text-sm font-medium">#</th>
                            <th className="p-4 text-left text-sm font-medium">{t('barsyDetail.item')}</th>
                            <th className="p-4 text-right text-sm font-medium">{t('billDialog.quantity')}</th>
                            <th className="p-4 text-left text-sm font-medium">{t('billDialog.unit')}</th>
                            <th className="p-4 text-right text-sm font-medium">{t('billDialog.unitPrice')}</th>
                            <th className="p-4 text-right text-sm font-medium">{t('billDialog.total')}</th>
                            {hasItemVat && (
                              <th className="p-4 text-right text-sm font-medium">{t('billsTable.vat')}</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <tr key={item.id} className="border-b last:border-b-0">
                              <td className="p-4 align-middle text-sm text-muted-foreground">
                                {index + 1}
                              </td>
                              <td className="p-4 align-middle">
                                <div className="text-sm font-medium">
                                  {item.article_name || '—'}
                                </div>
                              </td>
                              <td className="p-4 align-middle text-sm text-right">
                                {Number(item.quantity || 0).toFixed(2)}
                              </td>
                              <td className="p-4 align-middle text-sm">
                                {item.amount_type || '—'}
                              </td>
                              <td className="p-4 align-middle text-sm text-right whitespace-nowrap">
                                {formatAmount(Number(item.unit_price || 0), 'BGN')}
                              </td>
                              <td className="p-4 align-middle text-sm text-right font-medium whitespace-nowrap">
                                {formatAmount(Number(item.total_price || 0), 'BGN')}
                              </td>
                              {hasItemVat && (
                                <td className="p-4 align-middle text-sm text-right whitespace-nowrap">
                                  {item.vat_amount !== null && item.vat_amount !== undefined
                                    ? formatAmount(Number(item.vat_amount || 0), 'BGN')
                                    : '—'}
                                </td>
                              )}
                            </tr>
                          ))}
                          {hasItemVat ? (
                            <>
                              <tr className="bg-muted/50 font-semibold border-b">
                                <td colSpan={5} className="p-4 align-middle text-sm text-right">
                                  {t('barsyDetail.netAmount')}:
                                </td>
                                <td className="p-4 align-middle text-base text-right whitespace-nowrap">
                                  {formatAmount(itemsTotal, 'BGN')}
                                </td>
                                <td className="p-4 align-middle text-base text-right whitespace-nowrap">
                                  {formatAmount(itemsVatTotal, 'BGN')}
                                </td>
                              </tr>
                              <tr className="bg-muted/50 font-semibold border-b">
                                <td colSpan={hasItemVat ? 6 : 5} className="p-4 align-middle text-sm text-right">
                                  {t('barsyDetail.totalIncludingVat')}:
                                </td>
                                <td className="p-4 align-middle text-base text-right whitespace-nowrap">
                                  {formatAmount(itemsTotal + itemsVatTotal, 'BGN')}
                                </td>
                              </tr>
                            </>
                          ) : (
                            <tr className="bg-muted/50 font-semibold border-b">
                              <td colSpan={5} className="p-4 align-middle text-sm text-right">
                                {t('billDialog.total')}:
                              </td>
                              <td className="p-4 align-middle text-base text-right whitespace-nowrap">
                                {formatAmount(itemsTotal, 'BGN')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-shrink-0 p-4 bg-background border-t mt-4">
            {showApproved ? (
              <div className="flex items-center justify-center w-full gap-4">
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-base py-2 px-4">
                  {t('barsyDetail.alreadyApproved')}
                </Badge>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  {t('barsyDetail.close')}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full gap-4">
                <div className="text-sm text-muted-foreground">
                  {!bill.vendor_id && (
                    <span className="text-destructive">{t('barsyDetail.linkSupplierWarning')}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isProcessing}
                  >
                    {t('barsyDetail.close')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('barsyDetail.reject')}
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleApprove}
                    disabled={isProcessing || !bill.vendor_id}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {isProcessing ? t('barsyDetail.approving') : t('barsyDetail.approve')}
                  </Button>
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('barsyDetail.rejectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('barsyDetail.rejectDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? t('barsyDetail.rejecting') : t('barsyDetail.rejectBill')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
