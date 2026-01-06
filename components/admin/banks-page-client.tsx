'use client'

import { BanksTable } from '@/components/admin/banks-table'
import { CreateBankAccountDialog } from '@/components/admin/create-bank-account-dialog'
import { RecordTransferDialog } from '@/components/admin/record-transfer-dialog'
import { BanksFilter } from '@/components/admin/banks-filter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Banknote, Wallet, CreditCard } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'
import { BankAccount } from '@/lib/actions/bank-accounts'

interface Location {
  id: number
  name: string
}

interface BanksPageClientProps {
  filteredAccounts: BankAccount[]
  locations: Location[]
  bankAccounts: BankAccount[]
  showPos: boolean
}

export const BanksPageClient = ({ 
  filteredAccounts, 
  locations, 
  bankAccounts,
  showPos 
}: BanksPageClientProps) => {
  const { t } = useLanguage()
  const { formatAmount } = useCurrency()

  const bankAccountsCount = filteredAccounts.filter(a => a.account_type === 'bank').length
  const cashAccountsCount = filteredAccounts.filter(a => a.account_type === 'cash').length
  const posAccountsCount = filteredAccounts.filter(a => a.account_type === 'pos').length
  const totalBankBalance = filteredAccounts
    .filter(a => a.account_type === 'bank')
    .reduce((sum, a) => sum + a.current_balance, 0)
  const totalCashBalance = filteredAccounts
    .filter(a => a.account_type === 'cash')
    .reduce((sum, a) => sum + a.current_balance, 0)
  const totalPosBalance = filteredAccounts
    .filter(a => a.account_type === 'pos')
    .reduce((sum, a) => sum + a.current_balance, 0)

  const accountsByLocation = filteredAccounts.reduce((acc, account) => {
    const locationName = account.location?.name || 'Unknown Location'
    if (!acc[locationName]) {
      acc[locationName] = []
    }
    acc[locationName].push(account)
    return acc
  }, {} as Record<string, typeof filteredAccounts>)

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">{t('common.admin')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('nav.banks')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('banks.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('banks.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <RecordTransferDialog accounts={bankAccounts} />
          <CreateBankAccountDialog locations={locations} />
        </div>
      </div>

      <BanksFilter 
        locations={locations.map(loc => ({ id: loc.id.toString(), name: loc.name }))}
        showPos={showPos}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-200 dark:border-blue-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-blue-50 dark:bg-blue-950/20">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">{t('banks.bankAccount')}s</CardTitle>
            <Banknote className="h-4 w-4 text-blue-700 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${totalBankBalance < 0 ? 'text-red-600' : ''}`}>
              {formatAmount(totalBankBalance, 'BGN')}
            </div>
            <p className="text-xs text-muted-foreground">
              {bankAccountsCount} account{bankAccountsCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-green-50 dark:bg-green-950/20">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">{t('banks.cashAccount')}s</CardTitle>
            <Wallet className="h-4 w-4 text-green-700 dark:text-green-400" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${totalCashBalance < 0 ? 'text-red-600' : ''}`}>
              {formatAmount(totalCashBalance, 'BGN')}
            </div>
            <p className="text-xs text-muted-foreground">
              {cashAccountsCount} account{cashAccountsCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        {showPos && (
          <Card className="border-purple-200 dark:border-purple-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-purple-50 dark:bg-purple-950/20">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">{t('banks.posAccount')}s</CardTitle>
              <CreditCard className="h-4 w-4 text-purple-700 dark:text-purple-400" />
            </CardHeader>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${totalPosBalance < 0 ? 'text-red-600' : ''}`}>
                {formatAmount(totalPosBalance, 'BGN')}
              </div>
              <p className="text-xs text-muted-foreground">
                {posAccountsCount} account{posAccountsCount !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('banks.combinedBalance')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${totalBankBalance + totalCashBalance + totalPosBalance < 0 ? 'text-red-600' : ''}`}>
              {formatAmount(totalBankBalance + totalCashBalance + totalPosBalance, 'BGN')}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('banks.allAccountsCombined')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        {Object.entries(accountsByLocation)
          .sort(([a], [b]) => {
            if (a === 'Memento Group HQ') return -1
            if (b === 'Memento Group HQ') return 1
            return a.localeCompare(b)
          })
          .map(([locationName, accounts]) => {
            const locationTotal = accounts.reduce((sum, acc) => sum + acc.current_balance, 0)
            
            return (
              <div key={locationName} className="space-y-4">
                <h2 className="text-xl font-semibold">{locationName}</h2>
                <BanksTable accounts={accounts} locations={locations} />
                <div className="flex justify-end border-t pt-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{t('banks.totalBalance')}</p>
                    <p className={`text-lg font-bold ${locationTotal < 0 ? 'text-red-600' : ''}`}>
                      {formatAmount(locationTotal, 'BGN')}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}

        {Object.keys(accountsByLocation).length === 0 && (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground">{t('banks.noAccounts')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('banks.noAccountsDescription')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

