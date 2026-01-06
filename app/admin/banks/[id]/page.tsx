import { getBankAccountById, getBankAccountsByLocation } from '@/lib/actions/bank-accounts'
import { getBankAccountTransactions } from '@/lib/actions/bank-account-transactions'
import { getBankTransfers } from '@/lib/actions/bank-account-transfers'
import { BankAccountTransactions } from '@/components/admin/bank-account-transactions'
import { RecordTransferDialog } from '@/components/admin/record-transfer-dialog'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Banknote, Wallet, CreditCard } from 'lucide-react'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    from?: string
    to?: string
  }>
}

export default async function BankAccountDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { from, to } = await searchParams
  
  const accountId = parseInt(id)
  if (isNaN(accountId)) {
    notFound()
  }

  const accountResult = await getBankAccountById(accountId)
  if (!accountResult.data) {
    notFound()
  }

  const account = accountResult.data

  // Default date range: last 30 days
  const toDate = to ? new Date(to) : new Date()
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [transactionsResult, transfersResult, locationAccountsResult] = await Promise.all([
    getBankAccountTransactions(accountId, fromDate, toDate),
    getBankTransfers(accountId),
    getBankAccountsByLocation(account.location_id), // Get all accounts for the location
  ])
  
  const transactions = transactionsResult.data || []
  const transfers = transfersResult.data || []
  const locationAccounts = locationAccountsResult.data || []
  
  if (transactionsResult.error) {
    console.error('Transaction fetch error:', transactionsResult.error)
  }
  if (transfersResult.error) {
    console.error('Transfers fetch error:', transfersResult.error)
  }
  
  // Filter transfers by date range
  const filteredTransfers = transfers.filter(t => {
    const tDate = new Date(t.transfer_date)
    return tDate >= fromDate && tDate <= toDate
  })

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/banks">Banks</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{account.account_name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{account.account_name}</h1>
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
                <>
                  <Wallet className="h-3 w-3 mr-1" />
                  Cash
                </>
              ) : account.account_type === 'pos' ? (
                <>
                  <CreditCard className="h-3 w-3 mr-1" />
                  POS
                </>
              ) : (
                <>
                  <Banknote className="h-3 w-3 mr-1" />
                  Bank
                </>
              )}
            </Badge>
            {account.is_default && (
              <Badge variant="outline">Default</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {account.location?.name}
          </p>
        </div>
        <RecordTransferDialog 
          accounts={locationAccounts} 
          defaultFromAccount={accountId}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(account.opening_balance)} {account.currency}
            </div>
            <p className="text-xs text-muted-foreground">
              As of {new Date(account.opening_date).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${account.current_balance < 0 ? 'text-red-600' : ''}`}>
              {formatAmount(account.current_balance)} {account.currency}
            </div>
            <p className="text-xs text-muted-foreground">
              {account.current_balance < 0 ? 'Overdraft' : 'Available'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Change</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              account.current_balance - account.opening_balance >= 0 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {account.current_balance - account.opening_balance >= 0 ? '+' : ''}
              {formatAmount(account.current_balance - account.opening_balance)} {account.currency}
            </div>
            <p className="text-xs text-muted-foreground">
              Since {new Date(account.opening_date).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {(account.account_type === 'bank' || account.account_type === 'pos') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Bank Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {account.bank_name && (
              <div>
                <span className="text-sm text-muted-foreground">Bank: </span>
                <span className="text-sm font-medium">{account.bank_name}</span>
              </div>
            )}
            {account.account_number && (
              <div>
                <span className="text-sm text-muted-foreground">Account Number: </span>
                <code className="text-sm bg-muted px-2 py-1 rounded">{account.account_number}</code>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <BankAccountTransactions
        accountId={accountId}
        accountName={account.account_name}
        currency={account.currency}
        transactions={transactions}
        transfers={filteredTransfers}
        fromDate={fromDate}
        toDate={toDate}
      />
    </div>
  )
}

