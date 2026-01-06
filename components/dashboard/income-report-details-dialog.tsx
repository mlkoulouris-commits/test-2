import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { CheckCircle2, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'
import { IncomeReport } from '@/lib/types/income-report'

interface IncomeReportDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: IncomeReport | null
  onApprove?: (report: IncomeReport) => void
  onReject?: (report: IncomeReport) => void
  getTotalAmount: (report: IncomeReport) => number
}

export const IncomeReportDetailsDialog = ({
  open,
  onOpenChange,
  report,
  onApprove,
  onReject,
  getTotalAmount,
}: IncomeReportDetailsDialogProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()

  if (!report) return null

  const statusLabels = {
    approved: t('billStatus.approved'),
    rejected: t('billStatus.rejected'),
    pending: t('billStatus.pending'),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('incomeApproval.reportDetails')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Report Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
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
                  <p className="text-sm text-muted-foreground">{t('incomeApproval.businessDate')}</p>
                  <p className="font-semibold">
                    {format(new Date(report.business_date), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.location')}</p>
                  <p className="font-semibold">{report.locations.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.status')}</p>
                  <div className="mt-1">
                    <StatusBadge status={report.status} labels={statusLabels} />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('incomeApproval.submittedAt')}</p>
                  <p className="font-semibold">
                    {format(new Date(report.submitted_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
                {report.approved_at && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {report.status === 'approved' ? t('incomeApproval.approvedBy') : t('incomeApproval.rejectedBy')}
                      </p>
                      <p className="font-semibold">
                        {report.approved_by_profile 
                          ? `${report.approved_by_profile.first_name} ${report.approved_by_profile.last_name}`
                          : t('incomeApproval.unknownEmployee')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {report.status === 'approved' ? t('incomeApproval.approvedAt') : t('incomeApproval.rejectedAt')}
                      </p>
                      <p className="font-semibold">
                        {format(new Date(report.approved_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </>
                )}
              </div>
              {report.rejected_reason && (
                <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm font-semibold text-destructive mb-1">{t('incomeApproval.rejectionReason')}:</p>
                  <p className="text-sm">{report.rejected_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bill Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('incomeApproval.cashBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('incomeApproval.coinsSmallBills')}</span>
                <span className="font-semibold">
                  {formatAmount(report.bill_breakdown.under_5_total, 'BGN')}
                </span>
              </div>
              {[
                { label: t('incomeApproval.bills5'), count: report.bill_breakdown.count_5, value: 5 },
                { label: t('incomeApproval.bills10'), count: report.bill_breakdown.count_10, value: 10 },
                { label: t('incomeApproval.bills20'), count: report.bill_breakdown.count_20, value: 20 },
                { label: t('incomeApproval.bills50'), count: report.bill_breakdown.count_50, value: 50 },
                { label: t('incomeApproval.bills100'), count: report.bill_breakdown.count_100, value: 100 },
                { label: t('incomeApproval.bills200'), count: report.bill_breakdown.count_200, value: 200 },
              ].map(({ label, count, value }) => (
                count > 0 && (
                  <div key={label} className="flex justify-between text-sm">
                    <span>{label} × {count}</span>
                    <span className="font-semibold">{formatAmount(count * value, 'BGN')}</span>
                  </div>
                )
              ))}
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span>{t('incomeApproval.cashSalesTotal')}</span>
                <span>{formatAmount(report.cash_sales, 'BGN')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Tips & Card Sales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('incomeApproval.tipsCardSales')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('incomeApproval.cashTips')}</span>
                <span className="font-semibold">{formatAmount(report.cash_tips, 'BGN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t('incomeApproval.cardPosSales')}</span>
                <span className="font-semibold">{formatAmount(report.card_sales, 'BGN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t('incomeApproval.cardPosTips')}</span>
                <span className="font-semibold">{formatAmount(report.card_tips, 'BGN')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Submission Metadata */}
          {report.submission_metadata && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('incomeApproval.submissionDetails')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.submission_metadata.device && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('incomeApproval.device')}</span>
                    <span className="font-medium">{report.submission_metadata.device}</span>
                  </div>
                )}
                {report.submission_metadata.browser && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('incomeApproval.browser')}</span>
                    <span className="font-medium">{report.submission_metadata.browser}</span>
                  </div>
                )}
                {report.submission_metadata.screen_resolution && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('incomeApproval.screen')}</span>
                    <span className="font-medium">{report.submission_metadata.screen_resolution}</span>
                  </div>
                )}
                {report.submission_metadata.timezone && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('incomeApproval.timezone')}</span>
                    <span className="font-medium">{report.submission_metadata.timezone}</span>
                  </div>
                )}
                {report.submission_metadata.geolocation && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t('incomeApproval.locationGeo')}: </span>
                    <a 
                      href={`https://www.google.com/maps?q=${report.submission_metadata.geolocation.latitude},${report.submission_metadata.geolocation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      {report.submission_metadata.geolocation.latitude.toFixed(6)}, {report.submission_metadata.geolocation.longitude.toFixed(6)}
                    </a>
                    <span className="text-muted-foreground text-xs ml-2">
                      (±{Math.round(report.submission_metadata.geolocation.accuracy)}m)
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Grand Total */}
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">{t('incomeApproval.totalIncome')}</span>
                <span className="text-2xl font-bold">
                  {formatAmount(getTotalAmount(report), 'BGN')}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          {report.status === 'pending' && onApprove && onReject && (
            <>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onApprove(report)
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {t('common.approve')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onOpenChange(false)
                  onReject(report)
                }}
              >
                <XCircle className="h-4 w-4 mr-1" />
                {t('common.reject')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

