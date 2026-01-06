'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { BillPaymentDetailsDialog } from '@/components/admin/bill-payment-details-dialog'
import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface BillPayment {
  id: number
  payment_number: string
  payment_date: string
  total_amount: number
  payment_method: string | null
  reference_number: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  bank_account_id: number | null
  location_id: number | null
  applied_to_bills_count: number
  bank_account_name?: string
  location_name?: string
}

interface BillPaymentsTableProps {
  payments: BillPayment[]
  currentPage: number
}

const ITEMS_PER_PAGE = 20

export const BillPaymentsTable = ({ payments, currentPage }: BillPaymentsTableProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE)
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentPayments = payments.slice(startIndex, endIndex)

  const handleRowClick = (paymentId: number) => {
    setSelectedPaymentId(paymentId)
    setDetailsOpen(true)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/admin/bill-payments?${params.toString()}`)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    router.push(`/admin/bill-payments?${params.toString()}`)
  }

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getPaymentMethodBadge = (method: string | null) => {
    if (!method) return <Badge variant="outline">Unspecified</Badge>

    const methodMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      bank_transfer: { label: 'Bank Transfer', variant: 'default' },
      cash: { label: 'Cash', variant: 'secondary' },
      credit_card: { label: 'Credit Card', variant: 'default' },
      other: { label: 'Other', variant: 'outline' },
    }

    const methodInfo = methodMap[method] || { label: method, variant: 'outline' as const }
    
    return (
      <Badge variant={methodInfo.variant} className="capitalize">
        {methodInfo.label}
      </Badge>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No payments found
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Payment #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Bank Account</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-center">Bills Applied</TableHead>
            <TableHead>Created By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentPayments.map((payment) => (
            <TableRow 
              key={payment.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleRowClick(payment.id)}
            >
              <TableCell className="font-medium">
                {payment.payment_number}
              </TableCell>
              <TableCell>{formatDate(payment.payment_date)}</TableCell>
              <TableCell className="font-semibold text-green-600 dark:text-green-400">
                {formatAmount(payment.total_amount)} лв.
              </TableCell>
              <TableCell>{getPaymentMethodBadge(payment.payment_method)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {payment.location_name || '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {payment.bank_account_name || '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {payment.reference_number || '—'}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary">{payment.applied_to_bills_count}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {payment.created_by || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DataTablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={payments.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <BillPaymentDetailsDialog
        paymentId={selectedPaymentId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  )
}

