'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { History, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { getSalaryPaymentHistory, SalaryPaymentHistoryItem } from '@/lib/actions/salary-payments'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'

interface SalaryPaymentHistoryDialogProps {
  laborCostId: number
  laborCostDescription?: string | null
  trigger?: React.ReactNode
}

export const SalaryPaymentHistoryDialog = ({
  laborCostId,
  laborCostDescription,
  trigger,
}: SalaryPaymentHistoryDialogProps) => {
  const { locale } = useLanguage()
  const { formatAmount } = useCurrency()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<SalaryPaymentHistoryItem[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      loadHistory()
    }
  }, [open, laborCostId])

  const loadHistory = async () => {
    setIsLoading(true)
    setError('')

    const result = await getSalaryPaymentHistory(laborCostId)

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setHistory(result.data)
    }

    setIsLoading(false)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    try {
      return format(new Date(dateString), 'dd MMM yyyy')
    } catch {
      return dateString
    }
  }

  const totalPaid = history.reduce((sum, item) => sum + item.amount_applied, 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <History className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!max-w-3xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            {locale === 'bg' ? 'История на плащанията' : 'Payment History'}
          </DialogTitle>
          <DialogDescription>
            {laborCostDescription || (locale === 'bg' ? 'Запис за разходи за труд' : 'Labor cost entry')} #{laborCostId}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          {!isLoading && !error && history.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {locale === 'bg' ? 'Няма записани плащания' : 'No payments recorded'}
            </div>
          )}

          {!isLoading && !error && history.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === 'bg' ? 'Номер на плащане' : 'Payment #'}</TableHead>
                    <TableHead>{locale === 'bg' ? 'Дата' : 'Date'}</TableHead>
                    <TableHead>{locale === 'bg' ? 'Банкова сметка' : 'Bank Account'}</TableHead>
                    <TableHead>{locale === 'bg' ? 'Референция' : 'Reference'}</TableHead>
                    <TableHead className="text-right">{locale === 'bg' ? 'Обща сума' : 'Total Amount'}</TableHead>
                    <TableHead className="text-right">{locale === 'bg' ? 'Приложено' : 'Applied'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id} className="even:bg-muted/50">
                      <TableCell className="font-medium">
                        {item.payment.payment_number}
                      </TableCell>
                      <TableCell>
                        {formatDate(item.payment.payment_date)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.payment.bank_account_name || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.payment.reference_number || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatAmount(item.payment.total_amount)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                        {formatAmount(item.amount_applied)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={5} className="text-right">
                      {locale === 'bg' ? 'Общо платено:' : 'Total Paid:'}
                    </TableCell>
                    <TableCell className="text-right text-lg text-green-600 dark:text-green-400">
                      {formatAmount(totalPaid)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && !error && history.length > 0 && history[0].payment.notes && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">
                {locale === 'bg' ? 'Бележки към последното плащане:' : 'Notes from last payment:'}
              </p>
              <p className="text-sm text-muted-foreground">{history[0].payment.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
