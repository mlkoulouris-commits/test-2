'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChartOfAccount, AccountType, toggleAccountStatus, deleteAccount } from '@/lib/actions/chart-of-accounts'
import { useLanguage } from '@/lib/i18n/context'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface ChartOfAccountsTableProps {
  accounts: ChartOfAccount[]
  loading?: boolean
  onEdit: (account: ChartOfAccount) => void
  onAddChild: (parent: ChartOfAccount) => void
  onRefresh: () => void
}

const accountTypeColors: Record<AccountType, string> = {
  revenue: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cogs: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  labor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  operating_expense: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  non_operating: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

const accountTypeLabels: Record<AccountType, { en: string; bg: string }> = {
  revenue: { en: 'Revenue', bg: 'Приходи' },
  cogs: { en: 'COGS', bg: 'Себестойност' },
  labor: { en: 'Labor', bg: 'Труд' },
  operating_expense: { en: 'OpEx', bg: 'Оперативни' },
  non_operating: { en: 'Non-Op', bg: 'Неоперативни' },
}

interface AccountRowProps {
  account: ChartOfAccount
  expandedIds: Set<number>
  onToggleExpand: (id: number) => void
  onEdit: (account: ChartOfAccount) => void
  onAddChild: (parent: ChartOfAccount) => void
  onDelete: (account: ChartOfAccount) => void
  onToggleStatus: (account: ChartOfAccount) => void
  locale: 'en' | 'bg'
}

const AccountRow = ({
  account,
  expandedIds,
  onToggleExpand,
  onEdit,
  onAddChild,
  onDelete,
  onToggleStatus,
  locale,
}: AccountRowProps) => {
  const hasChildren = account.children && account.children.length > 0
  const isExpanded = expandedIds.has(account.id)
  const paddingLeft = (account.level - 1) * 24

  return (
    <>
      <TableRow className={cn(
        account.level === 1 && 'bg-muted/50 font-semibold',
        account.level === 2 && 'bg-muted/25',
        !account.is_active && 'opacity-50'
      )}>
        <TableCell style={{ paddingLeft: `${paddingLeft + 16}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onToggleExpand(account.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <span className="w-6" />
            )}
            <span className="font-mono text-sm text-muted-foreground">{account.code}</span>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <span className={cn(account.level === 1 && 'font-semibold')}>
              {account.name}
            </span>
            {account.name_bg && (
              <div className="text-xs text-muted-foreground">{account.name_bg}</div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge className={cn('text-xs', accountTypeColors[account.account_type])}>
            {accountTypeLabels[account.account_type][locale]}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant={account.is_active ? 'default' : 'secondary'}>
            {account.is_active ? (locale === 'bg' ? 'Активен' : 'Active') : (locale === 'bg' ? 'Неактивен' : 'Inactive')}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(account)}
              title={locale === 'bg' ? 'Редактирай' : 'Edit'}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {account.level < 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddChild(account)}
                title={locale === 'bg' ? 'Добави подсметка' : 'Add child'}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleStatus(account)}
              title={account.is_active ? (locale === 'bg' ? 'Деактивирай' : 'Deactivate') : (locale === 'bg' ? 'Активирай' : 'Activate')}
            >
              {account.is_active ? '🔒' : '🔓'}
            </Button>
            {!hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(account)}
                title={locale === 'bg' ? 'Изтрий' : 'Delete'}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {hasChildren && isExpanded && account.children?.map(child => (
        <AccountRow
          key={child.id}
          account={child}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onToggleStatus={onToggleStatus}
          locale={locale}
        />
      ))}
    </>
  )
}

export const ChartOfAccountsTable = ({
  accounts,
  loading,
  onEdit,
  onAddChild,
  onRefresh,
}: ChartOfAccountsTableProps) => {
  const { locale, t } = useLanguage()
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    // Expand all level 1 accounts by default
    const ids = new Set<number>()
    accounts.forEach(acc => {
      if (acc.level === 1) ids.add(acc.id)
    })
    return ids
  })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<ChartOfAccount | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleToggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExpandAll = () => {
    const allIds = new Set<number>()
    const collectIds = (accounts: ChartOfAccount[]) => {
      accounts.forEach(acc => {
        allIds.add(acc.id)
        if (acc.children) collectIds(acc.children)
      })
    }
    collectIds(accounts)
    setExpandedIds(allIds)
  }

  const handleCollapseAll = () => {
    setExpandedIds(new Set())
  }

  const handleDelete = (account: ChartOfAccount) => {
    setAccountToDelete(account)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!accountToDelete) return

    setIsDeleting(true)
    const result = await deleteAccount(accountToDelete.id)
    setIsDeleting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(locale === 'bg' ? 'Сметката е изтрита' : 'Account deleted')
      onRefresh()
    }

    setDeleteDialogOpen(false)
    setAccountToDelete(null)
  }

  const handleToggleStatus = async (account: ChartOfAccount) => {
    const result = await toggleAccountStatus(account.id, !account.is_active)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(
        account.is_active
          ? (locale === 'bg' ? 'Сметката е деактивирана' : 'Account deactivated')
          : (locale === 'bg' ? 'Сметката е активирана' : 'Account activated')
      )
      onRefresh()
    }
  }

  return (
    <>
      <div className="flex justify-end gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={handleExpandAll}>
          {locale === 'bg' ? 'Разгъни всички' : 'Expand All'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleCollapseAll}>
          {locale === 'bg' ? 'Свий всички' : 'Collapse All'}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">{locale === 'bg' ? 'Код' : 'Code'}</TableHead>
              <TableHead>{locale === 'bg' ? 'Име' : 'Name'}</TableHead>
              <TableHead className="w-[120px]">{locale === 'bg' ? 'Тип' : 'Type'}</TableHead>
              <TableHead className="w-[100px]">{locale === 'bg' ? 'Статус' : 'Status'}</TableHead>
              <TableHead className="w-[150px]">{locale === 'bg' ? 'Действия' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t('common.loading')}
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {locale === 'bg' ? 'Няма намерени сметки' : 'No accounts found'}
                </TableCell>
              </TableRow>
            ) : (
              accounts.map(account => (
                <AccountRow
                  key={account.id}
                  account={account}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                  onEdit={onEdit}
                  onAddChild={onAddChild}
                  onDelete={handleDelete}
                  onToggleStatus={handleToggleStatus}
                  locale={locale as 'en' | 'bg'}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === 'bg' ? 'Изтриване на сметка' : 'Delete Account'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === 'bg'
                ? `Сигурни ли сте, че искате да изтриете сметка "${accountToDelete?.code} - ${accountToDelete?.name}"?`
                : `Are you sure you want to delete account "${accountToDelete?.code} - ${accountToDelete?.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {locale === 'bg' ? 'Отказ' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting
                ? (locale === 'bg' ? 'Изтриване...' : 'Deleting...')
                : (locale === 'bg' ? 'Изтрий' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}



































