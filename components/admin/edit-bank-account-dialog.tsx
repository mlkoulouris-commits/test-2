'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateBankAccount, deleteBankAccount, toggleBankAccountStatus, BankAccount } from '@/lib/actions/bank-accounts'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useLanguage } from '@/lib/i18n/context'

interface Location {
  id: number
  name: string
}

interface EditBankAccountDialogProps {
  account: BankAccount
  locations: Location[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EditBankAccountDialog = ({
  account,
  locations,
  open,
  onOpenChange,
}: EditBankAccountDialogProps) => {
  const router = useRouter()
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const [accountName, setAccountName] = useState(account.account_name)
  const [currentBalance, setCurrentBalance] = useState(account.current_balance.toString())
  const [accountNumber, setAccountNumber] = useState(account.account_number || '')
  const [bankName, setBankName] = useState(account.bank_name || '')
  const [currency, setCurrency] = useState(account.currency)
  const [isDefault, setIsDefault] = useState(account.is_default)

  useEffect(() => {
    setAccountName(account.account_name)
    setCurrentBalance(account.current_balance.toString())
    setAccountNumber(account.account_number || '')
    setBankName(account.bank_name || '')
    setCurrency(account.currency)
    setIsDefault(account.is_default)
  }, [account])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!accountName) {
      toast.error('Account name is required')
      return
    }

    setIsLoading(true)

    const result = await updateBankAccount(
      account.id,
      accountName,
      parseFloat(currentBalance) || 0,
      accountNumber || undefined,
      bankName || undefined,
      currency,
      isDefault
    )

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success('Bank account updated successfully')
    onOpenChange(false)
    router.refresh()
    setIsLoading(false)
  }

  const handleToggleStatus = async () => {
    setIsLoading(true)
    const result = await toggleBankAccountStatus(account.id, !account.is_active)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`Account ${!account.is_active ? 'activated' : 'deactivated'} successfully`)
    onOpenChange(false)
    router.refresh()
    setIsLoading(false)
  }

  const handleDelete = async () => {
    setIsLoading(true)
    const result = await deleteBankAccount(account.id)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success('Bank account deleted successfully')
    setShowDeleteDialog(false)
    onOpenChange(false)
    router.refresh()
    setIsLoading(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{t('banks.editTitle')}</DialogTitle>
              <DialogDescription>
                {t('banks.updateDescription')} {account.location?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="accountName">{t('banks.accountName')} *</Label>
                <Input
                  id="accountName"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {account.account_type === 'bank' && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="bankName">{t('banks.bankName')}</Label>
                    <Input
                      id="bankName"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="accountNumber">{t('banks.accountNumber')}</Label>
                    <Input
                      id="accountNumber"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currentBalance">{t('banks.currentBalance')} *</Label>
                  <Input
                    id="currentBalance"
                    type="number"
                    step="0.01"
                    value={currentBalance}
                    onChange={(e) => setCurrentBalance(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="currency">{t('banks.currency')}</Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={isLoading}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BGN">BGN</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isDefault"
                  checked={isDefault}
                  onCheckedChange={(checked) => setIsDefault(checked as boolean)}
                  disabled={isLoading}
                />
                <Label htmlFor="isDefault" className="cursor-pointer">
                  {t('banks.isDefault')}
                </Label>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <div className="flex-1">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isLoading}
                >
                  {t('common.delete')}
                </Button>
              </div>
              <Button
                type="button"
                variant={account.is_active ? 'outline' : 'default'}
                onClick={handleToggleStatus}
                disabled={isLoading}
              >
                {account.is_active ? t('banks.deactivate') : t('banks.activate')}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? t('banks.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('banks.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('banks.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isLoading} className="bg-red-600">
              {isLoading ? t('banks.deleting') : t('banks.deleteAccount')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

