'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DollarSign } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/context'

interface StaffMemberDashboardProps {
  firstName: string
  lastName: string
}

export const StaffMemberDashboard = ({ firstName, lastName }: StaffMemberDashboardProps) => {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('common.dashboard')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('staffDashboard.welcomeBack')}, {firstName} {lastName}
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t('staffDashboard.reportYourIncome')}</CardTitle>
          <CardDescription>
            {t('staffDashboard.submitDailyReport')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/income">
            <Button className="w-full" size="lg">
              <DollarSign className="mr-2 h-5 w-5" />
              {t('staffDashboard.goToIncomeReport')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
