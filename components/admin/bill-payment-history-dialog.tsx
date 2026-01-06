'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getBillPaymentHistory } from '@/lib/actions/bills'
import { Receipt } from 'lucide-react'

interface PaymentHistoryItem {
  id: number
  amount_applied: number
  created_at: string
  bill_payments: {
    id: number
    payment_number: string
    payment_date: string
    total_amount: number
    payment_method: string | null
    reference_number: string | null
    notes: string | null
    created_by: string | null
  } | null
}

interface BillPaymentHistoryDialogProps {
  billId: number
  billNumber: string
}

export const BillPaymentHistoryDialog = ({ billId, billNumber }: BillPaymentHistoryDialogProps) => {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<PaymentHistoryItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadHistory()
    }
  }, [open, billId])

  const loadHistory = async () => {
    setLoading(true)
    const result = await getBillPaymentHistory(billId)
    if (result.data) {
      const transformedData = result.data.map((item: any) => ({
        ...item,
        bill_payments: Array.isArray(item.bill_payments) ? item.bill_payments[0] : item.bill_payments
      }))
      setHistory(transformedData)
    }
    setLoading(false)
  }

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const totalPaid = history.reduce((sum, item) => sum + Number(item.amount_applied), 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0"
              >
                <Receipt className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Payment History</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="!max-w-5xl w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Payment History - Bill {billNumber}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No payments recorded for this bill
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto">
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Payment Total</TableHead>
                    <TableHead className="text-right">Applied to Bill</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => {
                    if (!item.bill_payments) return null
                    const payment = item.bill_payments
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {payment.payment_number}
                        </TableCell>
                        <TableCell>
                          {formatDate(payment.payment_date)}
                        </TableCell>
                        <TableCell>
                          {payment.payment_method ? (
                            <Badge variant="outline" className="capitalize">
                              {payment.payment_method.replace('_', ' ')}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.reference_number || '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatAmount(payment.total_amount)} лв.
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                          {formatAmount(item.amount_applied)} лв.
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.created_by || '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={5} className="text-right">
                      Total Paid:
                    </TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">
                      {formatAmount(totalPaid)} лв.
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Show notes if any payment has notes */}
            {history.some(item => item.bill_payments?.notes) && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Payment Notes:</h4>
                {history
                  .filter(item => item.bill_payments?.notes)
                  .map((item) => {
                    if (!item.bill_payments) return null
                    const payment = item.bill_payments
                    return (
                      <div key={item.id} className="p-3 bg-muted/30 rounded-md text-sm">
                        <div className="font-medium text-muted-foreground mb-1">
                          {payment.payment_number} - {formatDate(payment.payment_date)}
                        </div>
                        <div>{payment.notes}</div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

