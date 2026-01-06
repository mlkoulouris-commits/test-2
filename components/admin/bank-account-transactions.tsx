'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { BankAccountTransaction } from '@/lib/actions/bank-account-transactions'
import { BankAccountTransfer } from '@/lib/actions/bank-account-transfers'
import { BillPaymentDetailsDialog } from '@/components/admin/bill-payment-details-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, FileText, TrendingUp, CreditCard, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { DateRange } from 'react-day-picker'

interface BankAccountTransactionsProps {
  accountId: number
  accountName: string
  currency: string
  transactions: BankAccountTransaction[]
  transfers: BankAccountTransfer[]
  fromDate: Date
  toDate: Date
}

export const BankAccountTransactions = ({
  accountId,
  accountName,
  currency,
  transactions,
  transfers,
  fromDate: initialFromDate,
  toDate: initialToDate,
}: BankAccountTransactionsProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [date, setDate] = useState<DateRange | undefined>({
    from: initialFromDate,
    to: initialToDate,
  })
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  const handleDateRangeChange = () => {
    if (date?.from && date?.to) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('from', format(date.from, 'yyyy-MM-dd'))
      params.set('to', format(date.to, 'yyyy-MM-dd'))
      router.push(`/admin/banks/${accountId}?${params.toString()}`)
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount))
  }

  // Merge transactions and transfers into a unified list
  const allItems = [
    ...transactions.map(t => ({ ...t, itemType: 'transaction' as const })),
    ...transfers.map(t => ({
      id: t.id,
      date: t.transfer_date,
      amount: t.from_account_id === accountId ? -t.amount : t.amount,
      type: t.from_account_id === accountId ? 'transfer_out' : 'transfer_in',
      description: t.description || (t.from_account_id === accountId
        ? `Transfer to ${t.to_account?.account_name}`
        : `Transfer from ${t.from_account?.account_name}`),
      reference: null,
      details: null,
      itemType: 'transfer' as const,
      transfer: t,
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalAmount = allItems.reduce((sum, t) => sum + t.amount, 0)
  const totalIncome = allItems.filter(t => t.type === 'income' || t.type === 'transfer_in').reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = Math.abs(allItems.filter(t => t.type === 'payment' || t.type === 'transfer_out').reduce((sum, t) => sum + t.amount, 0))

  // Extract numeric ID from prefixed ID (e.g., "payment-123" -> 123)
  const extractId = (id: string | number): number | null => {
    if (typeof id === 'number') {
      return id
    }
    const match = String(id).match(/\d+$/)
    return match ? parseInt(match[0], 10) : null
  }

  // Handle row click
  const handleRowClick = (item: typeof allItems[0]) => {
    if (item.itemType === 'transaction') {
      if (item.type === 'payment') {
        const paymentId = extractId(item.id)
        if (paymentId) {
          setSelectedPaymentId(paymentId)
          setPaymentDialogOpen(true)
        } else {
          console.error('Failed to extract payment ID from:', item.id)
        }
      } else if (item.type === 'income') {
        const incomeId = extractId(item.id)
        if (incomeId) {
          // Navigate to income approval page
          router.push(`/dashboard/income/approve`)
        } else {
          console.error('Failed to extract income ID from:', item.id)
        }
      }
    }
  }

  // Check if a row should be clickable
  const isRowClickable = (item: typeof allItems[0]): boolean => {
    return item.itemType === 'transaction' && (item.type === 'payment' || item.type === 'income')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transaction History</CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
              <div className="p-3 border-t">
                <Button
                  onClick={handleDateRangeChange}
                  className="w-full"
                  disabled={!date?.from || !date?.to}
                >
                  Apply Filter
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        {allItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No transactions found in this period</p>
            <p className="text-sm mt-1">Select a different date range to see transactions</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allItems.map((item) => {
                    const clickable = isRowClickable(item)

                    return (
                      <TableRow
                        key={`${item.itemType}-${item.id}`}
                        className={cn(
                          clickable && "cursor-pointer hover:bg-muted/50"
                        )}
                        onClick={() => {
                          if (clickable) {
                            handleRowClick(item)
                          }
                        }}
                      >
                        <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            item.type === 'income'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : item.type === 'transfer_in'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : item.type === 'transfer_out'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          )}
                        >
                          {item.type === 'income' ? (
                            <>
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Income
                            </>
                          ) : item.type === 'transfer_in' ? (
                            <>
                              <ArrowDownLeft className="h-3 w-3 mr-1" />
                              Transfer In
                            </>
                          ) : item.type === 'transfer_out' ? (
                            <>
                              <ArrowUpRight className="h-3 w-3 mr-1" />
                              Transfer Out
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-3 w-3 mr-1" />
                              Payment
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(item.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {clickable && item.type === 'payment' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRowClick(item)
                              }}
                              className="font-medium text-primary hover:underline text-left p-0 bg-transparent border-0 cursor-pointer"
                            >
                              {item.description}
                            </button>
                          ) : clickable && item.type === 'income' ? (
                            <Link
                              href="/dashboard/income/approve"
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                              className="font-medium text-primary hover:underline"
                            >
                              {item.description}
                            </Link>
                          ) : (
                            <div className="font-medium">{item.description}</div>
                          )}
                          {item.itemType === 'transaction' && item.type === 'payment' && item.details?.applied_bills?.length > 0 && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {item.details.applied_bills.map((bill: any, idx: number) => (
                                <div key={idx}>
                                  {bill.bill_doc_num && `Invoice ${bill.bill_doc_num}`}
                                  {!bill.bill_doc_num && 'Invoice'}
                                  {' - '}{formatAmount(bill.amount_applied)} {currency}
                                </div>
                              ))}
                            </div>
                          )}
                          {item.itemType === 'transaction' && item.type === 'income' && item.details && (
                            <div className="text-xs text-muted-foreground">
                              Cash: {formatAmount(item.details.cash_sales + item.details.cash_tips)} |
                              Card: {formatAmount(item.details.card_sales + item.details.card_tips)}
                            </div>
                          )}
                          {item.itemType === 'transfer' && item.transfer && (
                            <div className="text-xs text-muted-foreground">
                              {item.transfer.creator && (
                                <div>By: {item.transfer.creator.first_name} {item.transfer.creator.last_name}</div>
                              )}
                              <div>Recorded: {format(new Date(item.transfer.created_at), 'MMM dd, yyyy HH:mm')}</div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.itemType === 'transaction' && item.reference ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {item.reference}
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-semibold",
                        item.amount >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {item.amount >= 0 ? '+' : ''}{formatAmount(item.amount)} {currency}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="text-sm text-muted-foreground">
                {allItems.length} item{allItems.length !== 1 ? 's' : ''} in period
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total Income</div>
                  <div className="text-lg font-bold text-green-600">
                    +{formatAmount(totalIncome)} {currency}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total Expenses</div>
                  <div className="text-lg font-bold text-red-600">
                    -{formatAmount(totalExpenses)} {currency}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Net Change</div>
                  <div className={cn(
                    "text-lg font-bold",
                    totalAmount >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {totalAmount >= 0 ? '+' : ''}{formatAmount(totalAmount)} {currency}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <BillPaymentDetailsDialog
        paymentId={selectedPaymentId}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />
    </Card>
  )
}
