'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getBillPaymentDetails, type BillPaymentDetails } from '@/lib/actions/bills'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

interface BillPaymentDetailsDialogProps {
  paymentId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const BillPaymentDetailsDialog = ({ paymentId, open, onOpenChange }: BillPaymentDetailsDialogProps) => {
  const [payment, setPayment] = useState<BillPaymentDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPaymentDetails = async () => {
      if (!paymentId || !open) {
        setPayment(null)
        return
      }

      setLoading(true)
      setError(null)
      
      const result = await getBillPaymentDetails(paymentId)
      
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setPayment(result.data)
      }
      
      setLoading(false)
    }

    loadPaymentDetails()
  }, [paymentId, open])

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogDescription>
            View complete payment information and applied bills
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-destructive bg-destructive/10 p-4 rounded-md">
            {error}
          </div>
        )}

        {payment && !loading && (
          <div className="space-y-6">
            {/* Payment Information */}
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm text-muted-foreground">Payment Number</p>
                  <p className="font-medium">{payment.payment_number}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Payment Date</p>
                  <p className="font-medium">{formatDate(payment.payment_date)}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatAmount(payment.total_amount)} лв.
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <div className="mt-1">{getPaymentMethodBadge(payment.payment_method)}</div>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{payment.location_name || '—'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Bank Account</p>
                  <p className="font-medium">{payment.bank_account_name || '—'}</p>
                </div>
                
                {payment.reference_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reference Number</p>
                    <p className="font-medium">{payment.reference_number}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-muted-foreground">Created By</p>
                  <p className="font-medium">{payment.created_by || '—'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Created At</p>
                  <p className="font-medium">{formatDateTime(payment.created_at)}</p>
                </div>
              </div>
              
              {payment.notes && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{payment.notes}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Applied Bills */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">
                Applied to Bills ({payment.applications.length})
              </h3>
              
              {payment.applications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  No bills associated with this payment
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bill #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Bill Total</TableHead>
                        <TableHead className="text-right">Amount Applied</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payment.applications.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell>
                            <Link 
                              href={`/admin/bills`}
                              className="font-medium text-primary hover:underline"
                            >
                              {app.bill.doc_num || `#${app.bill.id}`}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(app.bill.doc_date)}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {app.bill.vendor_name || '—'}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatAmount(app.bill.total_amount)} лв.
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                            {formatAmount(app.amount_applied)} лв.
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell colSpan={4} className="text-right">
                          Total Applied:
                        </TableCell>
                        <TableCell className="text-right text-lg text-green-600 dark:text-green-400">
                          {formatAmount(payment.total_amount)} лв.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

