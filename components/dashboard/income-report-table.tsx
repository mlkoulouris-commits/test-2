import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { BillBreakdownPopover } from './bill-breakdown-popover'
import { TotalBreakdownPopover } from './total-breakdown-popover'
import { format } from 'date-fns'
import { Eye } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'
import { IncomeReport } from '@/lib/types/income-report'

interface IncomeReportTableProps {
  reports: IncomeReport[]
  onViewDetails: (report: IncomeReport) => void
  getTotalAmount: (report: IncomeReport) => number
}

export const IncomeReportTable = ({
  reports,
  onViewDetails,
  getTotalAmount,
}: IncomeReportTableProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()

  const statusLabels = {
    approved: t('billStatus.approved'),
    rejected: t('billStatus.rejected'),
    pending: t('billStatus.pending'),
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('incomeApproval.employee')}</TableHead>
            <TableHead>{t('incomeApproval.date')}</TableHead>
            <TableHead>{t('common.location')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead className="text-right">{t('incomeApproval.cash')}</TableHead>
            <TableHead className="text-right">{t('incomeApproval.tips')}</TableHead>
            <TableHead className="text-right">{t('incomeApproval.cardSales')}</TableHead>
            <TableHead className="text-right">{t('incomeApproval.total')}</TableHead>
            <TableHead className="text-center">{t('incomeApproval.action')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell className="font-medium">
                {report.employee_profile ?
                  `${report.employee_profile.first_name} ${report.employee_profile.last_name}` :
                  t('incomeApproval.unknownEmployee')
                }
              </TableCell>
              <TableCell>
                {format(new Date(report.business_date), 'MMM dd, yyyy')}
              </TableCell>
              <TableCell>{report.locations.name}</TableCell>
              <TableCell>
                <StatusBadge status={report.status} labels={statusLabels} />
              </TableCell>
              <TableCell className="text-right">
                <BillBreakdownPopover
                  billBreakdown={report.bill_breakdown}
                  cashSales={report.cash_sales}
                />
              </TableCell>
              <TableCell className="text-right">
                {formatAmount(report.cash_tips + report.card_tips, 'BGN')}
              </TableCell>
              <TableCell className="text-right">
                {formatAmount(report.card_sales, 'BGN')}
              </TableCell>
              <TableCell className="text-right">
                <TotalBreakdownPopover
                  cashSales={report.cash_sales}
                  cardSales={report.card_sales}
                  cardTips={report.card_tips}
                  cashTips={report.cash_tips}
                  total={getTotalAmount(report)}
                />
              </TableCell>
              <TableCell className="text-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewDetails(report)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {t('incomeApproval.view')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
