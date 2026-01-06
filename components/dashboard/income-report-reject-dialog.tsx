import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'
import { IncomeReport } from '@/lib/types/income-report'

interface IncomeReportRejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: IncomeReport | null
  rejectReason: string
  onRejectReasonChange: (reason: string) => void
  onConfirm: () => void
  isSubmitting: boolean
  error: string
  success: string
  getTotalAmount: (report: IncomeReport) => number
}

export const IncomeReportRejectDialog = ({
  open,
  onOpenChange,
  report,
  rejectReason,
  onRejectReasonChange,
  onConfirm,
  isSubmitting,
  error,
  success,
  getTotalAmount,
}: IncomeReportRejectDialogProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()

  if (!report) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('incomeApproval.rejectReport')}</DialogTitle>
          <DialogDescription>
            {t('incomeApproval.provideReason')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-secondary rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">{t('incomeApproval.employee')}</p>
              <p className="font-semibold">
                {report.employee_profile ? 
                  `${report.employee_profile.first_name} ${report.employee_profile.last_name}` : 
                  t('incomeApproval.unknownEmployee')
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('incomeApproval.totalAmount')}</p>
              <p className="font-bold text-lg">{formatAmount(getTotalAmount(report), 'BGN')}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('incomeApproval.reasonForRejection')}</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => onRejectReasonChange(e.target.value)}
              placeholder={t('incomeApproval.enterReason')}
              rows={4}
            />
          </div>
        </div>
        
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            {success}
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? t('incomeApproval.rejecting') : t('common.reject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

