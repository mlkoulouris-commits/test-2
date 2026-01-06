'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  getBankAccountsByLocation,
  createBankAccount,
  updateBankAccount,
  toggleBankAccountStatus,
  setDefaultBankAccount,
  deleteBankAccount,
  type BankAccount,
} from '@/lib/actions/bank-accounts'
import { Plus, Edit, Trash2, Star, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface LocationBankAccountsProps {
  locationId: number
  locationName: string
}

export const LocationBankAccounts = ({ locationId, locationName }: LocationBankAccountsProps) => {
  const router = useRouter()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [accountToDelete, setAccountToDelete] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    accountType: 'bank' as 'bank' | 'cash' | 'pos',
    currentBalance: 0,
    currency: 'BGN',
    isDefault: false,
  })

  useEffect(() => {
    loadAccounts()
  }, [locationId])

  const loadAccounts = async () => {
    const result = await getBankAccountsByLocation(locationId)
    if (result.data) {
      setAccounts(result.data)
    }
  }

  const handleOpenDialog = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account)
      setFormData({
        accountName: account.account_name,
        accountNumber: account.account_number || '',
        bankName: account.bank_name || '',
        accountType: account.account_type,
        currentBalance: account.current_balance,
        currency: account.currency,
        isDefault: account.is_default,
      })
    } else {
      setEditingAccount(null)
      setFormData({
        accountName: '',
        accountNumber: '',
        bankName: '',
        accountType: 'bank',
        currentBalance: 0,
        currency: 'BGN',
        isDefault: accounts.length === 0, // First account is default
      })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    let result
    if (editingAccount) {
      result = await updateBankAccount(
        editingAccount.id,
        formData.accountName,
        formData.currentBalance,
        formData.accountNumber || undefined,
        formData.bankName || undefined,
        formData.currency,
        formData.isDefault
      )
    } else {
      result = await createBankAccount(
        locationId,
        formData.accountName,
        formData.accountType,
        formData.currentBalance,
        formData.accountNumber || undefined,
        formData.bankName || undefined,
        formData.currency,
        formData.isDefault
      )
    }

    setLoading(false)

    if (result.error) {
      alert(result.error)
    } else {
      setDialogOpen(false)
      loadAccounts()
      router.refresh()
    }
  }

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const result = await toggleBankAccountStatus(id, !currentStatus)
    if (!result.error) {
      loadAccounts()
      router.refresh()
    }
  }

  const handleSetDefault = async (id: number) => {
    const result = await setDefaultBankAccount(id, locationId)
    if (!result.error) {
      loadAccounts()
      router.refresh()
    }
  }

  const handleDeleteClick = (id: number) => {
    setAccountToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return

    const result = await deleteBankAccount(accountToDelete)
    if (!result.error) {
      loadAccounts()
      router.refresh()
    }
    setDeleteDialogOpen(false)
    setAccountToDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Bank Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Manage bank accounts for {locationName}
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <p>No bank accounts configured</p>
          <p className="text-sm mt-1">Add at least one bank account to record payments</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Account Number</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
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
                      {account.account_type === 'cash' ? '💵 Cash' : account.account_type === 'pos' ? '💳 POS' : '🏦 Bank'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.account_name}</span>
                      {account.is_default && (
                        <Badge variant="outline" className="text-xs">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{account.bank_name || '—'}</TableCell>
                  <TableCell>
                    {account.account_number ? (
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {account.account_number}
                      </code>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${account.current_balance < 0 ? 'text-red-600' : ''}`}>
                    {account.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{account.currency}</TableCell>
                  <TableCell>
                    <Badge variant={account.is_active ? 'default' : 'secondary'}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      {!account.is_default && account.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetDefault(account.id)}
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenDialog(account)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleStatus(account.id, account.is_active)}
                      >
                        <CheckCircle className={`h-4 w-4 ${account.is_active ? 'text-green-600' : 'text-muted-foreground'}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(account.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
              </DialogTitle>
              <DialogDescription>
                {editingAccount
                  ? 'Update bank account details'
                  : 'Add a new bank account for this location'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {!editingAccount && (
                <div className="grid gap-2">
                  <Label htmlFor="accountType">Account Type *</Label>
                  <Select
                    value={formData.accountType}
                    onValueChange={(value: 'bank' | 'cash' | 'pos') => setFormData({ ...formData, accountType: value })}
                  >
                    <SelectTrigger id="accountType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank Account</SelectItem>
                      <SelectItem value="pos">POS Account</SelectItem>
                      <SelectItem value="cash">Cash Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="accountName">Account Name *</Label>
                <Input
                  id="accountName"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  placeholder="Main Operating Account"
                  required
                  disabled={loading}
                />
              </div>

              {(formData.accountType === 'bank' || formData.accountType === 'pos') && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="First Investment Bank"
                      disabled={loading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      placeholder="BG12 XXXX 1234 5678 9012"
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currentBalance">Current Balance *</Label>
                  <Input
                    id="currentBalance"
                    type="number"
                    step="0.01"
                    value={formData.currentBalance}
                    onChange={(e) => setFormData({ ...formData, currentBalance: parseFloat(e.target.value) || 0 })}
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BGN">BGN (Bulgarian Lev)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                      <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  disabled={loading}
                  className="h-4 w-4"
                />
                <Label htmlFor="isDefault" className="font-normal cursor-pointer">
                  Set as default account
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : editingAccount ? 'Save Changes' : 'Add Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bank Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Make sure no active payments reference this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

