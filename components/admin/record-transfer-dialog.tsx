'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BankAccount } from '@/lib/actions/bank-accounts'
import { createBankTransfer } from '@/lib/actions/bank-account-transfers'
import { BankAccountSelectItem } from '@/components/admin/bank-account-select-item'
import { sortBankAccounts } from '@/lib/utils/sort-bank-accounts'
import { ArrowRightLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface RecordTransferDialogProps {
  accounts: BankAccount[]
  defaultFromAccount?: number
  trigger?: React.ReactNode
}

export const RecordTransferDialog = ({ 
  accounts, 
  defaultFromAccount,
  trigger 
}: RecordTransferDialogProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fromAccountId, setFromAccountId] = useState<number | null>(null)
  const [toAccountId, setToAccountId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && defaultFromAccount) {
      setFromAccountId(defaultFromAccount)
    }
  }, [open, defaultFromAccount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fromAccountId || !toAccountId) {
      setError('Please select both accounts')
      return
    }

    if (fromAccountId === toAccountId) {
      setError('Source and destination accounts must be different')
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setLoading(true)

    const result = await createBankTransfer(
      fromAccountId,
      toAccountId,
      amountNum,
      new Date(transferDate),
      description || undefined
    )

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
      router.refresh()
      // Reset form
      setFromAccountId(defaultFromAccount || null)
      setToAccountId(null)
      setAmount('')
      setDescription('')
      setTransferDate(new Date().toISOString().split('T')[0])
    }
  }

  const fromAccount = accounts.find(a => a.id === fromAccountId)
  const sortedAccounts = sortBankAccounts(accounts)
  
  // Business rules for transfers:
  // - POS/Cash can only transfer to/from Bank accounts
  // - Bank can transfer to other Bank accounts (same location or to/from HQ)
  const availableToAccounts = accounts.filter(a => {
    if (a.id === fromAccountId || !a.is_active) return false
    
    if (!fromAccount) return false
    
    // POS or Cash -> only Bank accounts at same location
    if (fromAccount.account_type === 'pos' || fromAccount.account_type === 'cash') {
      return a.account_type === 'bank' && a.location_id === fromAccount.location_id
    }
    
    // Bank -> POS/Cash at same location OR other Bank accounts (same location or HQ)
    if (fromAccount.account_type === 'bank') {
      // Allow transfer to POS/Cash at same location
      if ((a.account_type === 'pos' || a.account_type === 'cash') && a.location_id === fromAccount.location_id) {
        return true
      }
      // Allow transfer to other Bank accounts at same location or HQ
      if (a.account_type === 'bank') {
        return a.location_id === fromAccount.location_id || 
               a.location?.name === 'Memento Group HQ' ||
               fromAccount.location?.name === 'Memento Group HQ'
      }
    }
    
    return false
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transfer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record Account Transfer</DialogTitle>
            <DialogDescription>
              POS/Cash → Bank only. Bank → Bank (same location or HQ).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fromAccount">From Account *</Label>
              <Select
                value={fromAccountId?.toString()}
                onValueChange={(val) => {
                  setFromAccountId(Number(val))
                  setToAccountId(null)
                }}
              >
                <SelectTrigger id="fromAccount">
                  <SelectValue placeholder="Select source account" />
                </SelectTrigger>
                <SelectContent>
                  {sortedAccounts.filter(a => a.is_active).map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      <BankAccountSelectItem account={account} showBalance />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="toAccount">To Account *</Label>
              <Select
                value={toAccountId?.toString()}
                onValueChange={(val) => setToAccountId(Number(val))}
                disabled={!fromAccountId}
              >
                <SelectTrigger id="toAccount">
                  <SelectValue placeholder="Select destination account" />
                </SelectTrigger>
                <SelectContent>
                  {sortBankAccounts(availableToAccounts).map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      <BankAccountSelectItem account={account} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fromAccountId && availableToAccounts.length === 0 && (
                <p className="text-sm text-destructive">
                  No eligible accounts for transfer from {fromAccount?.account_type.toUpperCase()}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                disabled={loading}
              />
              {fromAccount && (
                <p className={`text-sm ${fromAccount.current_balance < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  Available: {fromAccount.current_balance.toFixed(2)} {fromAccount.currency}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transferDate">Transfer Date *</Label>
              <Input
                id="transferDate"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                When the transfer actually occurred. System will record when you entered it.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Daily POS settlement"
                rows={3}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Recording...' : 'Record Transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

