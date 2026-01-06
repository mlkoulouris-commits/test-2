import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useCurrency } from '@/lib/i18n/currency'
import { useLanguage } from '@/lib/i18n/context'

interface BillBreakdown {
  under_5_total: number
  count_5: number
  count_10: number
  count_20: number
  count_50: number
  count_100: number
  count_200: number
}

interface BillBreakdownPopoverProps {
  billBreakdown: BillBreakdown
  trigger?: React.ReactNode
  cashSales?: number
}

export const BillBreakdownPopover = ({ 
  billBreakdown, 
  trigger,
  cashSales 
}: BillBreakdownPopoverProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()

  const defaultTrigger = (
    <Button variant="link" className="p-0 h-auto font-normal">
      {cashSales !== undefined ? formatAmount(cashSales, 'BGN') : t('incomeApproval.viewBreakdown')}
    </Button>
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{t('incomeApproval.billBreakdown')}</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>{t('incomeApproval.coinsSmallBills')}:</span>
              <span>{formatAmount(billBreakdown.under_5_total, 'BGN')}</span>
            </div>
            {[
              { value: 5, count: billBreakdown.count_5 },
              { value: 10, count: billBreakdown.count_10 },
              { value: 20, count: billBreakdown.count_20 },
              { value: 50, count: billBreakdown.count_50 },
              { value: 100, count: billBreakdown.count_100 },
              { value: 200, count: billBreakdown.count_200 },
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
  )
}

