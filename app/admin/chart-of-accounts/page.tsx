'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useLanguage } from '@/lib/i18n/context'
import { ChartOfAccountsTable } from '@/components/admin/chart-of-accounts-table'
import { AccountDialog } from '@/components/admin/account-dialog'
import { HardcodedMappingsTable } from '@/components/admin/hardcoded-mappings-table'
import { ChartOfAccount, getAllAccounts } from '@/lib/actions/chart-of-accounts'

export default function ChartOfAccountsPage() {
  const { locale, t } = useLanguage()
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null)
  const [parentAccount, setParentAccount] = useState<ChartOfAccount | null>(null)

  const loadAccounts = async () => {
    setLoading(true)
    setError(null)
    const result = await getAllAccounts({ includeInactive: true })

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setAccounts(result.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const handleAddNew = () => {
    setEditingAccount(null)
    setParentAccount(null)
    setDialogOpen(true)
  }

  const handleEdit = (account: ChartOfAccount) => {
    setEditingAccount(account)
    setParentAccount(null)
    setDialogOpen(true)
  }

  const handleAddChild = (parent: ChartOfAccount) => {
    setEditingAccount(null)
    setParentAccount(parent)
    setDialogOpen(true)
  }

  const handleDialogSuccess = () => {
    loadAccounts()
  }

  // Count accounts
  const totalAccounts = accounts.reduce((sum, acc) => {
    let count = 1
    const countChildren = (a: ChartOfAccount): number => {
      return 1 + (a.children?.reduce((s, c) => s + countChildren(c), 0) || 0)
    }
    return sum + countChildren(acc)
  }, 0)

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">{t('common.admin')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {locale === 'bg' ? 'Сметкоплан' : 'Chart of Accounts'}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {locale === 'bg' ? 'Сметкоплан' : 'Chart of Accounts'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {locale === 'bg'
              ? 'Управление на сметкоплана за финансови отчети'
              : 'Manage chart of accounts for financial reporting'}
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          {locale === 'bg' ? 'Нова сметка' : 'Add Account'}
        </Button>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">
            {locale === 'bg' ? 'Сметки' : 'Accounts'}
          </TabsTrigger>
          <TabsTrigger value="categories">
            <a href="/admin/chart-of-accounts/categories">
              {locale === 'bg' ? 'Категории' : 'Categories'}
            </a>
          </TabsTrigger>
          <TabsTrigger value="articles">
            <a href="/admin/chart-of-accounts/articles">
              {locale === 'bg' ? 'Артикули' : 'Articles'}
            </a>
          </TabsTrigger>
          <TabsTrigger value="effective">
            <a href="/admin/chart-of-accounts/effective">
              {locale === 'bg' ? 'Ефективни' : 'Effective'}
            </a>
          </TabsTrigger>
          <TabsTrigger value="hardcoded">
            {locale === 'bg' ? 'Хардкодирани' : 'Hardcoded'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {locale === 'bg' ? 'Всички сметки' : 'All Accounts'}
              </CardTitle>
              <CardDescription>
                {totalAccounts > 0
                  ? `${totalAccounts} ${locale === 'bg' ? 'сметки' : 'accounts'}`
                  : loading
                    ? (locale === 'bg' ? 'Зареждане...' : 'Loading...')
                    : (locale === 'bg' ? 'Няма сметки' : 'No accounts')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error ? (
                <p className="text-destructive">{error}</p>
              ) : (
                <ChartOfAccountsTable
                  accounts={accounts}
                  loading={loading}
                  onEdit={handleEdit}
                  onAddChild={handleAddChild}
                  onRefresh={loadAccounts}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hardcoded" className="mt-6">
          <HardcodedMappingsTable />
        </TabsContent>
      </Tabs>

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        parentAccount={parentAccount}
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}
