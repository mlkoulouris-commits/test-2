import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useCurrency } from '@/lib/i18n/currency'
import { useLanguage } from '@/lib/i18n/context'

interface TotalBreakdownPopoverProps {
  cashSales: number
  cardSales: number
  cardTips: number
  cashTips: number
  total: number
}

export const TotalBreakdownPopover = ({
  cashSales,
  cardSales,
  cardTips,
  cashTips,
  total,
}: TotalBreakdownPopoverProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="link" className="p-0 h-auto font-bold">
          {formatAmount(total, 'BGN')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">{t('incomeApproval.totalBreakdown')}</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>{t('incomeApproval.cashSales')}</span>
              <span>{formatAmount(cashSales, 'BGN')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('incomeApproval.cardPosSales')}</span>
              <span>{formatAmount(cardSales, 'BGN')}</span>
            </div>
            {cardTips > 0 && (
              <div className="flex justify-between">
                <span>{t('incomeApproval.cardPosTips')}</span>
                <span>{formatAmount(cardTips, 'BGN')}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>{t('incomeApproval.total')}</span>
              <span>{formatAmount(total, 'BGN')}</span>
            </div>
          </div>
          {cashTips > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <span className="font-medium">{t('incomeApproval.cashTips')}: </span>
              {formatAmount(cashTips, 'BGN')} ({t('common.recorded')})
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
