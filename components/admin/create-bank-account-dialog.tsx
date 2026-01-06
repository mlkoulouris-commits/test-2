'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBankAccount } from '@/lib/actions/bank-accounts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Banknote, Wallet, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { sortLocationsWithHQFirst } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/context'

interface Location {
  id: number
  name: string
}

interface CreateBankAccountDialogProps {
  locations: Location[]
}

export const CreateBankAccountDialog = ({ locations }: CreateBankAccountDialogProps) => {
  const router = useRouter()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [locationId, setLocationId] = useState<number | null>(null)
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<'bank' | 'cash' | 'pos'>('bank')
  const [currentBalance, setCurrentBalance] = useState('0')
  const [accountNumber, setAccountNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [currency, setCurrency] = useState('BGN')
  const [isDefault, setIsDefault] = useState(false)

  const sortedLocations = sortLocationsWithHQFirst(locations)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!locationId || !accountName) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsLoading(true)

    const result = await createBankAccount(
      locationId,
      accountName,
      accountType,
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

    toast.success('Bank account created successfully')
    setOpen(false)
    resetForm()
    router.refresh()
    setIsLoading(false)
  }

  const resetForm = () => {
    setLocationId(null)
    setAccountName('')
    setAccountType('bank')
    setCurrentBalance('0')
    setAccountNumber('')
    setBankName('')
    setCurrency('BGN')
    setIsDefault(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('banks.createAccount')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('banks.createTitle')}</DialogTitle>
            <DialogDescription>
              {t('banks.createDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="location">{t('banks.location')} *</Label>
              <Select 
                value={locationId?.toString()} 
                onValueChange={(value) => setLocationId(parseInt(value))} 
                disabled={isLoading}
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder={t('banks.location')} />
                </SelectTrigger>
                <SelectContent>
                  {sortedLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="accountType">{t('banks.accountType')} *</Label>
              <Select
                value={accountType}
                onValueChange={(value: 'bank' | 'cash' | 'pos') => setAccountType(value)}
                disabled={isLoading}
              >
                <SelectTrigger id="accountType">
                  <div className="flex items-center gap-2">
                    {accountType === 'bank' && <Banknote className="h-4 w-4 text-blue-700 dark:text-blue-400" />}
                    {accountType === 'cash' && <Wallet className="h-4 w-4 text-green-700 dark:text-green-400" />}
                    {accountType === 'pos' && <CreditCard className="h-4 w-4 text-purple-700 dark:text-purple-400" />}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                      <span>{t('banks.bankAccount')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="cash">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-green-700 dark:text-green-400" />
                      <span>{t('banks.cashAccount')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pos">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                      <span>{t('banks.posAccount')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="accountName">{t('banks.accountName')} *</Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., Main Operating Account"
                disabled={isLoading}
              />
            </div>

            {accountType === 'bank' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="bankName">{t('banks.bankName')}</Label>
                  <Input
                    id="bankName"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g., First Investment Bank"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="accountNumber">{t('banks.accountNumber')}</Label>
                  <Input
                    id="accountNumber"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g., BG80BNBG96611020345678"
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('banks.creating') : t('banks.createAccount')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

