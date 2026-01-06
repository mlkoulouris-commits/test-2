'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { BankAccountSelectItem } from '@/components/admin/bank-account-select-item'
import { sortBankAccounts } from '@/lib/utils/sort-bank-accounts'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  recordSalaryPayment,
  getUnpaidLaborCosts,
  getBankAccountsForLocation,
  UnpaidLaborCost,
} from '@/lib/actions/salary-payments'
import { getLaborCostLocations } from '@/lib/actions/labor-costs'
import { CreditCard, Plus, Trash2, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'

interface LaborCostApplication {
  laborCostId: number
  laborCost: UnpaidLaborCost
  amountApplied: number
}

interface BankAccount {
  id: number
  account_name: string
  account_number: string | null
  bank_name: string | null
  account_type: string
  current_balance: number
}

interface RecordSalaryPaymentDialogProps {
  initialLocationId?: number
  initialLaborCostId?: number
  trigger?: React.ReactNode
  onSuccess?: () => void
}

const costTypeLabels: Record<string, { en: string; bg: string }> = {
  salary: { en: 'Salary', bg: 'Заплата' },
  bonus: { en: 'Bonus', bg: 'Бонус' },
  overtime: { en: 'Overtime', bg: 'Извънреден труд' },
  benefits: { en: 'Benefits', bg: 'Придобивки' },
  taxes: { en: 'Payroll Taxes', bg: 'Осигуровки' },
  other: { en: 'Other', bg: 'Друго' },
}

export const RecordSalaryPaymentDialog = ({
  initialLocationId,
  initialLaborCostId,
  trigger,
  onSuccess,
}: RecordSalaryPaymentDialogProps) => {
  const { locale } = useLanguage()
  const { formatAmount } = useCurrency()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null)
  const [openPaymentDate, setOpenPaymentDate] = useState(false)
  const [unpaidLaborCosts, setUnpaidLaborCosts] = useState<UnpaidLaborCost[]>([])
  const [applications, setApplications] = useState<LaborCostApplication[]>([])
  const [paymentDate, setPaymentDate] = useState<Date>(new Date())
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (open) {
      loadLocations()
    }
  }, [open])

  // Pre-populate location after data is loaded
  useEffect(() => {
    if (open && locations.length > 0 && initialLocationId) {
      setSelectedLocationId(initialLocationId)
    }
  }, [open, locations, initialLocationId])

  // Handle initial labor cost selection
  useEffect(() => {
    const loadInitialLaborCost = async () => {
      if (open && initialLaborCostId && unpaidLaborCosts.length > 0) {
        const laborCost = unpaidLaborCosts.find(lc => lc.id === initialLaborCostId)
        if (laborCost && !applications.some(app => app.laborCostId === initialLaborCostId)) {
          setApplications([{
            laborCostId: laborCost.id,
            laborCost,
            amountApplied: laborCost.balance,
          }])
        }
      }
    }
    loadInitialLaborCost()
  }, [open, initialLaborCostId, unpaidLaborCosts])

  useEffect(() => {
    if (selectedLocationId) {
      if (selectedLocationId !== initialLocationId) {
        setApplications([])
      }
      setBankAccounts([])
      setSelectedBankAccountId(null)
      loadBankAccounts()
      loadUnpaidLaborCosts()
    } else {
      setBankAccounts([])
      setSelectedBankAccountId(null)
      setUnpaidLaborCosts([])
    }
  }, [selectedLocationId, initialLocationId])

  // Auto-select bank account when available
  useEffect(() => {
    if (bankAccounts.length > 0 && !selectedBankAccountId) {
      // Prefer bank type accounts for salary payments
      const bankTypeAccounts = bankAccounts.filter(acc => acc.account_type === 'bank')
      if (bankTypeAccounts.length > 0) {
        setSelectedBankAccountId(bankTypeAccounts[0].id)
      } else if (bankAccounts.length > 0) {
        setSelectedBankAccountId(bankAccounts[0].id)
      }
    }
  }, [bankAccounts, selectedBankAccountId])

  const loadLocations = async () => {
    const result = await getLaborCostLocations()
    if (result.data) {
      setLocations(result.data)
    }
  }

  const loadBankAccounts = async () => {
    if (!selectedLocationId) return

    const result = await getBankAccountsForLocation(selectedLocationId)
    if (result.data) {
      setBankAccounts(result.data)
    } else {
      setBankAccounts([])
    }
  }

  const loadUnpaidLaborCosts = async () => {
    if (!selectedLocationId) return

    const result = await getUnpaidLaborCosts(selectedLocationId)
    if (result.data) {
      setUnpaidLaborCosts(result.data)
    }
  }

  const addLaborCostApplication = (laborCost: UnpaidLaborCost) => {
    if (applications.some(app => app.laborCostId === laborCost.id)) {
      setError(locale === 'bg' ? 'Този запис вече е добавен' : 'Entry already added to payment')
      return
    }

    setApplications([...applications, {
      laborCostId: laborCost.id,
      laborCost,
      amountApplied: laborCost.balance,
    }])
    setError('')
  }

  const removeLaborCostApplication = (laborCostId: number) => {
    setApplications(applications.filter(app => app.laborCostId !== laborCostId))
  }

  const updateApplicationAmount = (laborCostId: number, amount: number) => {
    setApplications(applications.map(app =>
      app.laborCostId === laborCostId
        ? { ...app, amountApplied: amount }
        : app
    ))
  }

  const totalPaymentAmount = applications.reduce((sum, app) => sum + app.amountApplied, 0)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedLocationId) {
      setError(locale === 'bg' ? 'Изберете локация' : 'Please select a location')
      return
    }

    if (!selectedBankAccountId) {
      setError(locale === 'bg' ? 'Изберете банкова сметка' : 'Please select a bank account')
      return
    }

    if (applications.length === 0) {
      setError(locale === 'bg' ? 'Добавете поне един запис за плащане' : 'Please add at least one entry to apply payment to')
      return
    }

    if (totalPaymentAmount <= 0) {
      setError(locale === 'bg' ? 'Общата сума трябва да е по-голяма от 0' : 'Total payment amount must be greater than 0')
      return
    }

    // Validate amounts
    const invalidApp = applications.find(app =>
      app.amountApplied <= 0 || app.amountApplied > app.laborCost.balance + 0.01
    )

    if (invalidApp) {
      setError(locale === 'bg' ? 'Сумите трябва да са по-големи от 0 и да не надвишават остатъка' : 'Payment amounts must be greater than 0 and not exceed balance')
      return
    }

    setIsLoading(true)

    const salaryApplications = applications.map(app => ({
      laborCostId: app.laborCostId,
      amountApplied: app.amountApplied,
    }))

    const result = await recordSalaryPayment(
      format(paymentDate, 'yyyy-MM-dd'),
      totalPaymentAmount,
      salaryApplications,
      selectedLocationId,
      selectedBankAccountId,
      referenceNumber || undefined,
      notes || undefined
    )

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      setOpen(false)
      resetForm()
      router.refresh()
      onSuccess?.()
    }
  }

  const resetForm = () => {
    setSelectedLocationId(null)
    setSelectedBankAccountId(null)
    setOpenPaymentDate(false)
    setBankAccounts([])
    setUnpaidLaborCosts([])
    setApplications([])
    setPaymentDate(new Date())
    setReferenceNumber('')
    setNotes('')
    setError('')
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen)
      if (!newOpen) resetForm()
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <CreditCard className="h-4 w-4 mr-2" />
            {locale === 'bg' ? 'Запиши плащане' : 'Record Payment'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {locale === 'bg' ? 'Запиши плащане на заплата' : 'Record Salary Payment'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'bg'
                ? 'Приложи плащане към един или повече записи за разходи за труд.'
                : 'Apply a payment to one or more labor cost entries.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Location & Bank Account Selection */}
            <div className="grid gap-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                {locale === 'bg' ? 'Локация и банкова сметка' : 'Location & Bank Account'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="location">
                    {locale === 'bg' ? 'Локация *' : 'Location *'}
                  </Label>
                  <Select
                    value={selectedLocationId?.toString() || ''}
                    onValueChange={(value) => setSelectedLocationId(parseInt(value))}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="location">
                      <SelectValue placeholder={locale === 'bg' ? 'Изберете локация' : 'Select location'} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="bankAccount">
                    {locale === 'bg' ? 'Банкова сметка *' : 'Bank Account *'}
                  </Label>
                  <Select
                    value={selectedBankAccountId?.toString() || ''}
                    onValueChange={(value) => setSelectedBankAccountId(parseInt(value))}
                    disabled={isLoading || !selectedLocationId || bankAccounts.length === 0}
                  >
                    <SelectTrigger id="bankAccount">
                      <SelectValue placeholder={bankAccounts.length === 0 ? (locale === 'bg' ? 'Зареждане...' : 'Loading...') : (locale === 'bg' ? 'Изберете сметка' : 'Select account')} />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{account.account_name}</span>
                            {account.bank_name && (
                              <span className="text-xs text-muted-foreground">({account.bank_name})</span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {formatAmount(account.current_balance)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLocationId && bankAccounts.length === 0 && (
                    <p className="text-sm text-destructive">
                      {locale === 'bg' ? 'Няма банкови сметки за тази локация' : 'No bank accounts configured for this location'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="grid gap-4 p-4 border rounded-lg">
              <h3 className="font-semibold">
                {locale === 'bg' ? 'Детайли на плащането' : 'Payment Details'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>{locale === 'bg' ? 'Дата на плащане *' : 'Payment Date *'}</Label>
                  <Popover open={openPaymentDate} onOpenChange={setOpenPaymentDate}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !paymentDate && "text-muted-foreground"
                        )}
                        disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {paymentDate ? format(paymentDate, 'PPP') : <span>{locale === 'bg' ? 'Изберете дата' : 'Pick a date'}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={paymentDate}
                        onSelect={(date) => {
                          if (date) {
                            setPaymentDate(date)
                            setOpenPaymentDate(false)
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="referenceNumber">
                    {locale === 'bg' ? 'Референтен номер' : 'Reference Number'}
                  </Label>
                  <Input
                    id="referenceNumber"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder={locale === 'bg' ? 'Банков номер' : 'Transaction #'}
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>{locale === 'bg' ? 'Обща сума на плащането' : 'Total Payment Amount'}</Label>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatAmount(totalPaymentAmount)}
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">{locale === 'bg' ? 'Бележки' : 'Notes'}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={locale === 'bg' ? 'Допълнителни бележки (по избор)' : 'Additional notes (optional)'}
                  disabled={isLoading}
                  rows={2}
                />
              </div>
            </div>

            {/* Labor Cost Selection */}
            <div className="grid gap-4 p-4 border rounded-lg">
              <h3 className="font-semibold">
                {locale === 'bg' ? 'Изберете записи за плащане' : 'Select Salary Entries'}
              </h3>

              {!selectedLocationId && (
                <div className="text-center py-8 text-muted-foreground">
                  {locale === 'bg' ? 'Изберете локация първо' : 'Please select a location first'}
                </div>
              )}

              {selectedLocationId && unpaidLaborCosts.length > 0 && (
                <div className="border rounded-md max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{locale === 'bg' ? 'Период' : 'Period'}</TableHead>
                        <TableHead>{locale === 'bg' ? 'Служител' : 'Employee'}</TableHead>
                        <TableHead>{locale === 'bg' ? 'Тип' : 'Type'}</TableHead>
                        <TableHead>{locale === 'bg' ? 'Описание' : 'Description'}</TableHead>
                        <TableHead className="text-right">{locale === 'bg' ? 'Сума' : 'Amount'}</TableHead>
                        <TableHead className="text-right">{locale === 'bg' ? 'Остатък' : 'Balance'}</TableHead>
                        <TableHead className="text-center">{locale === 'bg' ? 'Действие' : 'Action'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unpaidLaborCosts.map((laborCost) => (
                        <TableRow key={laborCost.id} className="even:bg-muted/50">
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(laborCost.period_start)} - {formatDate(laborCost.period_end)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {laborCost.profile_name || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {costTypeLabels[laborCost.cost_type]?.[locale as 'en' | 'bg'] || laborCost.cost_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                            {laborCost.description || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(laborCost.amount)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-orange-600 dark:text-orange-400">
                            {formatAmount(laborCost.balance)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => addLaborCostApplication(laborCost)}
                              disabled={applications.some(app => app.laborCostId === laborCost.id)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {selectedLocationId && unpaidLaborCosts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {locale === 'bg' ? 'Няма неплатени записи за тази локация' : 'No unpaid entries found for this location'}
                </div>
              )}
            </div>

            {/* Payment Applications */}
            {applications.length > 0 && (
              <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="font-semibold">
                  {locale === 'bg' ? 'Приложени плащания' : 'Payment Applications'}
                </h3>

                <div className="border rounded-md bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{locale === 'bg' ? 'Служител' : 'Employee'}</TableHead>
                        <TableHead>{locale === 'bg' ? 'Период' : 'Period'}</TableHead>
                        <TableHead>{locale === 'bg' ? 'Тип' : 'Type'}</TableHead>
                        <TableHead className="text-right">{locale === 'bg' ? 'Остатък' : 'Balance'}</TableHead>
                        <TableHead className="text-right">{locale === 'bg' ? 'Сума за плащане' : 'Amount to Apply'}</TableHead>
                        <TableHead className="text-center">{locale === 'bg' ? 'Действие' : 'Action'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((app) => (
                        <TableRow key={app.laborCostId}>
                          <TableCell className="font-medium">
                            {app.laborCost.profile_name || '—'}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(app.laborCost.period_start)} - {formatDate(app.laborCost.period_end)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {costTypeLabels[app.laborCost.cost_type]?.[locale as 'en' | 'bg'] || app.laborCost.cost_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatAmount(app.laborCost.balance)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={app.laborCost.balance}
                              value={app.amountApplied}
                              onChange={(e) => updateApplicationAmount(app.laborCostId, parseFloat(e.target.value) || 0)}
                              className="max-w-[150px] ml-auto text-right"
                              disabled={isLoading}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeLaborCostApplication(app.laborCostId)}
                              disabled={isLoading}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell colSpan={4} className="text-right">
                          {locale === 'bg' ? 'Общо плащане:' : 'Total Payment:'}
                        </TableCell>
                        <TableCell className="text-right text-lg">
                          {formatAmount(totalPaymentAmount)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              {locale === 'bg' ? 'Отказ' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={isLoading || applications.length === 0}>
              {isLoading
                ? (locale === 'bg' ? 'Записване...' : 'Recording...')
                : (locale === 'bg' ? 'Запиши плащане' : 'Record Payment')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
