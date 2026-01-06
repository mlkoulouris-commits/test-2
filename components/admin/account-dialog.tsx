'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLanguage } from '@/lib/i18n/context'
import {
  ChartOfAccount,
  AccountType,
  createAccount,
  updateAccount,
  getAccountsByLevel,
} from '@/lib/actions/chart-of-accounts'
import { toast } from 'sonner'

interface AccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: ChartOfAccount | null
  parentAccount?: ChartOfAccount | null
  onSuccess: () => void
}

const accountTypes: AccountType[] = ['revenue', 'cogs', 'labor', 'operating_expense', 'non_operating']

const accountTypeLabels: Record<AccountType, { en: string; bg: string }> = {
  revenue: { en: 'Revenue', bg: 'Приходи' },
  cogs: { en: 'Cost of Goods Sold', bg: 'Себестойност на продадените стоки' },
  labor: { en: 'Labor Costs', bg: 'Разходи за труд' },
  operating_expense: { en: 'Operating Expense', bg: 'Оперативни разходи' },
  non_operating: { en: 'Non-Operating', bg: 'Неоперативни позиции' },
}

export const AccountDialog = ({
  open,
  onOpenChange,
  account,
  parentAccount,
  onSuccess,
}: AccountDialogProps) => {
  const { locale } = useLanguage()
  const isEditing = !!account
  const [saving, setSaving] = useState(false)

  // Form state
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [nameBg, setNameBg] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('revenue')
  const [parentId, setParentId] = useState<number | null>(null)
  const [sortOrder, setSortOrder] = useState(0)
  const [description, setDescription] = useState('')

  // Parent accounts for dropdown
  const [parentOptions, setParentOptions] = useState<Array<{ id: number; code: string; name: string }>>([])

  // Determine the level for new accounts
  const newLevel = parentAccount ? parentAccount.level + 1 : 1

  useEffect(() => {
    if (open) {
      if (account) {
        // Editing existing account
        setCode(account.code)
        setName(account.name)
        setNameBg(account.name_bg || '')
        setAccountType(account.account_type)
        setParentId(account.parent_id)
        setSortOrder(account.sort_order)
        setDescription(account.description || '')
      } else if (parentAccount) {
        // Creating child account
        setCode('')
        setName('')
        setNameBg('')
        setAccountType(parentAccount.account_type)
        setParentId(parentAccount.id)
        setSortOrder(0)
        setDescription('')
      } else {
        // Creating new top-level account
        setCode('')
        setName('')
        setNameBg('')
        setAccountType('revenue')
        setParentId(null)
        setSortOrder(0)
        setDescription('')
      }

      // Load parent options if editing or creating level 2/3
      loadParentOptions()
    }
  }, [open, account, parentAccount])

  const loadParentOptions = async () => {
    if (account && account.level > 1) {
      // Load accounts of the previous level for editing
      const result = await getAccountsByLevel(account.level - 1)
      if (result.data) {
        setParentOptions(result.data as any[])
      }
    } else if (!account && !parentAccount) {
      // Creating new - no parent options for level 1
      setParentOptions([])
    }
  }

  const handleSave = async () => {
    if (!code.trim()) {
      toast.error(locale === 'bg' ? 'Кодът е задължителен' : 'Code is required')
      return
    }
    if (!name.trim()) {
      toast.error(locale === 'bg' ? 'Името е задължително' : 'Name is required')
      return
    }

    setSaving(true)

    if (isEditing && account) {
      const result = await updateAccount(account.id, {
        code,
        name,
        nameBg: nameBg || undefined,
        accountType,
        parentId,
        sortOrder,
        description: description || undefined,
      })

      if (result.error) {
        toast.error(result.error)
        setSaving(false)
        return
      }

      toast.success(locale === 'bg' ? 'Сметката е обновена' : 'Account updated')
    } else {
      const result = await createAccount({
        code,
        name,
        nameBg: nameBg || undefined,
        accountType,
        parentId,
        sortOrder,
        description: description || undefined,
      })

      if (result.error) {
        toast.error(result.error)
        setSaving(false)
        return
      }

      toast.success(locale === 'bg' ? 'Сметката е създадена' : 'Account created')
    }

    setSaving(false)
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? (locale === 'bg' ? 'Редактиране на сметка' : 'Edit Account')
              : parentAccount
                ? (locale === 'bg' ? `Добавяне на подсметка към ${parentAccount.code}` : `Add child to ${parentAccount.code}`)
                : (locale === 'bg' ? 'Нова сметка' : 'New Account')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? (locale === 'bg' ? 'Редактирайте данните на сметката' : 'Edit account details')
              : (locale === 'bg' ? `Ниво ${newLevel}` : `Level ${newLevel}`)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">
              {locale === 'bg' ? 'Код' : 'Code'}
            </Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="col-span-3"
              placeholder="e.g. 1101"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              {locale === 'bg' ? 'Име (EN)' : 'Name (EN)'}
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="Account name in English"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="nameBg" className="text-right">
              {locale === 'bg' ? 'Име (BG)' : 'Name (BG)'}
            </Label>
            <Input
              id="nameBg"
              value={nameBg}
              onChange={(e) => setNameBg(e.target.value)}
              className="col-span-3"
              placeholder="Име на сметката на български"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              {locale === 'bg' ? 'Тип' : 'Type'}
            </Label>
            <Select
              value={accountType}
              onValueChange={(v) => setAccountType(v as AccountType)}
              disabled={!!parentAccount} // Type is inherited from parent
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {accountTypeLabels[type][locale as 'en' | 'bg']}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEditing && parentOptions.length > 0 && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parent" className="text-right">
                {locale === 'bg' ? 'Родител' : 'Parent'}
              </Label>
              <Select
                value={parentId?.toString() || 'none'}
                onValueChange={(v) => setParentId(v === 'none' ? null : parseInt(v))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {locale === 'bg' ? '— Няма —' : '— None —'}
                  </SelectItem>
                  {parentOptions.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.code} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sortOrder" className="text-right">
              {locale === 'bg' ? 'Ред' : 'Sort Order'}
            </Label>
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              {locale === 'bg' ? 'Описание' : 'Description'}
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {locale === 'bg' ? 'Отказ' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? (locale === 'bg' ? 'Запазване...' : 'Saving...')
              : (locale === 'bg' ? 'Запази' : 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



































