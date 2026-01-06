'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BankAccount } from '@/lib/actions/bank-accounts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EditBankAccountDialog } from './edit-bank-account-dialog'
import { Banknote, Wallet, ArrowRight, CreditCard } from 'lucide-react'
import { useCurrency } from '@/lib/i18n/currency'
import { useLanguage } from '@/lib/i18n/context'

interface Location {
  id: number
  name: string
}

interface BanksTableProps {
  accounts: BankAccount[]
  locations: Location[]
}

export const BanksTable = ({ accounts, locations }: BanksTableProps) => {
  const router = useRouter()
  const { t } = useLanguage()
  const { formatAmount, getCurrencySymbol } = useCurrency()
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">{t('banks.type')}</TableHead>
              <TableHead className="w-[250px]">{t('banks.accountName')}</TableHead>
              <TableHead className="w-[180px]">{t('banks.bankName')}</TableHead>
              <TableHead className="w-[150px]">{t('banks.accountNumber')}</TableHead>
              <TableHead className="w-[100px] text-center">{t('banks.currency')}</TableHead>
              <TableHead className="w-[150px] text-right">{t('banks.currentBalance')}</TableHead>
              <TableHead className="w-[100px]">{t('common.status')}</TableHead>
              <TableHead className="w-[120px]">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow 
                key={account.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/admin/banks/${account.id}`)}
              >
                <TableCell>
                  <Badge 
                    variant="secondary" 
                    className={
                      account.account_type === 'cash' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : account.account_type === 'pos'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }
                  >
                    {account.account_type === 'cash' ? (
                      <Wallet className="h-3 w-3 mr-1" />
                    ) : account.account_type === 'pos' ? (
                      <CreditCard className="h-3 w-3 mr-1" />
                    ) : (
                      <Banknote className="h-3 w-3 mr-1" />
                    )}
                    <span className={account.account_type === 'pos' ? 'uppercase' : 'capitalize'}>
                      {account.account_type}
                    </span>
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{account.account_name}</span>
                    {account.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{account.bank_name || '-'}</TableCell>
                <TableCell className="font-mono text-sm">
                  {account.account_number || '-'}
                </TableCell>
                <TableCell className="text-center">{getCurrencySymbol(account.currency)}</TableCell>
                <TableCell className={`text-right font-semibold ${account.current_balance < 0 ? 'text-red-600' : ''}`}>
                  {formatAmount(account.current_balance, account.currency)}
                </TableCell>
                <TableCell>
                  {account.is_active ? (
                    <Badge variant="default" className="bg-green-600">
                      {t('common.active')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t('common.inactive')}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedAccount(account)
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/admin/banks/${account.id}`)
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedAccount && (
        <EditBankAccountDialog
          account={selectedAccount}
          locations={locations}
          open={!!selectedAccount}
          onOpenChange={(open) => {
            if (!open) setSelectedAccount(null)
          }}
        />
      )}
    </>
  )
}

