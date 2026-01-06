import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { format } from 'date-fns'
import { Eye, Info } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { IncomeReport } from '@/lib/types/income-report'

interface IncomeReportMobileCardProps {
  report: IncomeReport
  onViewDetails: (report: IncomeReport) => void
  getTotalAmount: (report: IncomeReport) => number
}

export const IncomeReportMobileCard = ({
  report,
  onViewDetails,
  getTotalAmount,
}: IncomeReportMobileCardProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()

  const statusLabels = {
    approved: t('billStatus.approved'),
    rejected: t('billStatus.rejected'),
    pending: t('billStatus.pending'),
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold">
              {report.employee_profile ? 
                `${report.employee_profile.first_name} ${report.employee_profile.last_name}` : 
                t('incomeApproval.unknownEmployee')
              }
            </p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(report.business_date), 'MMM dd, yyyy')}
            </p>
            <p className="text-sm text-muted-foreground">{report.locations.name}</p>
            <div className="mt-1">
              <StatusBadge status={report.status} labels={statusLabels} />
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Bill Breakdown</h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>{t('incomeApproval.coinsSmallBills')}:</span>
                    <span>{formatAmount(report.bill_breakdown.under_5_total, 'BGN')}</span>
                  </div>
                  {[
                    { value: 5, count: report.bill_breakdown.count_5 },
                    { value: 10, count: report.bill_breakdown.count_10 },
                    { value: 20, count: report.bill_breakdown.count_20 },
                    { value: 50, count: report.bill_breakdown.count_50 },
                    { value: 100, count: report.bill_breakdown.count_100 },
                    { value: 200, count: report.bill_breakdown.count_200 },
                  ].map(({ value, count }) => (
                    count > 0 && (
                      <div key={value} className="flex justify-between">
                        <span>{formatAmount(value, 'BGN')} × {count}:</span>
                        <span>{formatAmount(count * value, 'BGN')}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">{t('incomeApproval.cash')}</p>
            <p className="font-semibold">{formatAmount(report.cash_sales, 'BGN')}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('incomeApproval.tips')}</p>
            <p className="font-semibold">
              {formatAmount(report.cash_tips + report.card_tips, 'BGN')}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('incomeApproval.cardSales')}</p>
            <p className="font-semibold">{formatAmount(report.card_sales, 'BGN')}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('incomeApproval.total')}</p>
            <p className="font-bold text-lg">{formatAmount(getTotalAmount(report), 'BGN')}</p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => onViewDetails(report)}
        >
          <Eye className="h-4 w-4 mr-1" />
          {t('incomeApproval.viewDetails')}
        </Button>
      </CardContent>
    </Card>
  )
}

