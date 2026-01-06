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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { recordBillPayment, getBillVendors, getUnpaidBillsByLocation, getBillLocations } from '@/lib/actions/bills'
import { getBankAccountsByLocation, BankAccount } from '@/lib/actions/bank-accounts'
import { CreditCard, Plus, Trash2, ChevronsUpDown, Check, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'

interface UnpaidBill {
  id: number
  location_id: number
  vendor_id: number | null
  doc_num: string | null
  doc_date: string | null
  vendor_name: string | null
  location_name: string | null
  total_amount: number
  total_amount_including_vat?: number
  total_paid: number
  balance: number
}

interface BillApplication {
  billId: number
  bill: UnpaidBill
  amountApplied: number
}

interface RecordMultiBillPaymentDialogProps {
  initialLocationId?: number | string
  initialVendorId?: number
  initialBillId?: number
  trigger?: React.ReactNode
}

export const RecordMultiBillPaymentDialog = ({
  initialLocationId,
  initialVendorId,
  initialBillId,
  trigger
}: RecordMultiBillPaymentDialogProps = {}) => {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null)
  const [vendors, setVendors] = useState<Array<{ id: number; name: string }>>([])
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null)
  const [openVendor, setOpenVendor] = useState(false)
  const [openPaymentDate, setOpenPaymentDate] = useState(false)
  const [unpaidBills, setUnpaidBills] = useState<UnpaidBill[]>([])
  const [applications, setApplications] = useState<BillApplication[]>([])
  const [paymentDate, setPaymentDate] = useState<Date>(new Date())
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (open) {
      loadLocations()
      loadVendors()
    }
  }, [open])

  // Pre-populate location and vendor after data is loaded
  useEffect(() => {
    if (open && locations.length > 0 && initialLocationId) {
      const locationId = typeof initialLocationId === 'string' ? parseInt(initialLocationId) : initialLocationId
      setSelectedLocationId(locationId)
    }
  }, [open, locations, initialLocationId])

  useEffect(() => {
    if (open && vendors.length > 0 && initialVendorId) {
      setSelectedVendorId(initialVendorId)
    }
  }, [open, vendors, initialVendorId])

  // Handle initial bill selection
  useEffect(() => {
    const loadInitialBill = async () => {
      if (open && initialBillId && unpaidBills.length > 0) {
        const bill = unpaidBills.find(b => b.id === initialBillId)
        if (bill && !applications.some(app => app.billId === initialBillId)) {
          setApplications([{
            billId: bill.id,
            bill,
            amountApplied: bill.balance
          }])
        }
      }
    }
    loadInitialBill()
  }, [open, initialBillId, unpaidBills])

  useEffect(() => {
    if (selectedLocationId) {
      // Only clear applications if not pre-selected with initial location
      if (selectedLocationId !== initialLocationId) {
        setApplications([])
      }
      setBankAccounts([]) // Clear accounts first
      setSelectedBankAccountId(null) // Clear selection
      loadBankAccounts()
    } else {
      setBankAccounts([])
      setSelectedBankAccountId(null)
    }
  }, [selectedLocationId, initialLocationId])

  // Filter bank accounts based on payment method
  const filteredBankAccounts = useMemo(() => {
    return bankAccounts.filter(account => {
      if (paymentMethod === 'cash') {
        return account.account_type === 'cash'
      }
      if (paymentMethod === 'credit_card') {
        // For credit card, show POS and bank accounts
        return account.account_type === 'pos' || account.account_type === 'bank'
      }
      // For bank_transfer and other methods, show only bank accounts
      return account.account_type === 'bank'
    })
  }, [bankAccounts, paymentMethod])

  // Auto-select bank account when filtered accounts are available
  useEffect(() => {
    if (filteredBankAccounts.length > 0 && !selectedBankAccountId) {
      // Auto-select account based on priority
      let accountToSelect: number

      if (filteredBankAccounts.length === 1) {
        // Only one account - select it
        accountToSelect = filteredBankAccounts[0].id
      } else {
        // Multiple accounts - prefer default, then first
        const defaultAccount = filteredBankAccounts.find(acc => acc.is_default)
        accountToSelect = defaultAccount ? defaultAccount.id : filteredBankAccounts[0].id
      }

      setSelectedBankAccountId(accountToSelect)
    }
  }, [filteredBankAccounts, selectedBankAccountId])

  // Clear selected account if it's not in filtered list (payment method changed)
  useEffect(() => {
    if (selectedBankAccountId && filteredBankAccounts.length > 0) {
      const isSelectedInFiltered = filteredBankAccounts.some(acc => acc.id === selectedBankAccountId)
      if (!isSelectedInFiltered) {
        setSelectedBankAccountId(null)
      }
    }
  }, [filteredBankAccounts, selectedBankAccountId])

  useEffect(() => {
    if (selectedLocationId) {
      loadUnpaidBills()
    }
  }, [selectedLocationId, selectedVendorId])

  const loadLocations = async () => {
    const result = await getBillLocations()
    if (result.data) {
      setLocations(result.data)
    }
  }

  // Load saved location from localStorage when locations are available
  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId && !initialLocationId) {
      const savedLocationId = localStorage.getItem('payment-location-id')
      if (savedLocationId) {
        const locationId = parseInt(savedLocationId)
        const locationExists = locations.some((loc) => loc.id === locationId)
        if (locationExists) {
          setSelectedLocationId(locationId)
        }
      }
    }
  }, [locations, selectedLocationId, initialLocationId])

  const loadBankAccounts = async () => {
    if (!selectedLocationId) return

    const result = await getBankAccountsByLocation(selectedLocationId)
    if (result.data) {
      setBankAccounts(result.data)
      // Auto-selection will happen in useEffect watching bankAccounts
    } else {
      setBankAccounts([])
    }
  }

  const loadVendors = async () => {
    const result = await getBillVendors()
    if (result.data) {
      setVendors(result.data)
    }
  }

  const loadUnpaidBills = async () => {
    if (!selectedLocationId) return

    const result = await getUnpaidBillsByLocation(selectedLocationId, selectedVendorId || undefined)
    if (result.data) {
      setUnpaidBills(result.data)
    }
  }

  const addBillApplication = (bill: UnpaidBill) => {
    if (applications.some(app => app.billId === bill.id)) {
      setError('Bill already added to payment')
      return
    }

    // Lock vendor to the first bill's vendor
    if (applications.length === 0 && bill.vendor_id) {
      setSelectedVendorId(bill.vendor_id)
    }

    setApplications([...applications, {
      billId: bill.id,
      bill,
      amountApplied: bill.balance, // Default to full balance
    }])
    setError('')
  }

  const removeBillApplication = (billId: number) => {
    const newApplications = applications.filter(app => app.billId !== billId)
    setApplications(newApplications)

    // Clear vendor lock when all applications removed
    if (newApplications.length === 0) {
      setSelectedVendorId(null)
    }
  }

  const updateApplicationAmount = (billId: number, amount: number) => {
    setApplications(applications.map(app =>
      app.billId === billId
        ? { ...app, amountApplied: amount }
        : app
    ))
  }

  const totalPaymentAmount = applications.reduce((sum, app) => sum + app.amountApplied, 0)

  const formatAmount = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return '0.00'
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedLocationId) {
      setError('Please select a location')
      return
    }

    if (!selectedBankAccountId) {
      setError('Please select a bank account')
      return
    }

    if (applications.length === 0) {
      setError('Please add at least one bill to apply payment to')
      return
    }

    if (totalPaymentAmount <= 0) {
      setError('Total payment amount must be greater than 0')
      return
    }

    // Validate amounts
    const invalidApp = applications.find(app =>
      app.amountApplied <= 0 || app.amountApplied > app.bill.balance
    )

    if (invalidApp) {
      setError('Payment amounts must be greater than 0 and not exceed bill balance')
      return
    }

    setIsLoading(true)

    const billApplications = applications.map(app => ({
      billId: app.billId,
      amountApplied: app.amountApplied,
    }))

    const result = await recordBillPayment(
      format(paymentDate, 'yyyy-MM-dd'),
      totalPaymentAmount,
      billApplications,
      selectedLocationId.toString(),
      selectedBankAccountId,
      paymentMethod || undefined,
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
    }
  }

  const resetForm = () => {
    setSelectedLocationId(null)
    setSelectedBankAccountId(null)
    setSelectedVendorId(null)
    setOpenVendor(false)
    setOpenPaymentDate(false)
    setBankAccounts([])
    setUnpaidBills([])
    setApplications([])
    setPaymentDate(new Date())
    setPaymentMethod('bank_transfer')
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
            Record Payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Apply a payment to one or more bills. You can make partial or full payments.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Location & Bank Account Selection */}
            <div className="grid gap-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Location & Bank Account</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="location">Location (Company) *</Label>
                  <Select
                    value={selectedLocationId?.toString() || ''}
                    onValueChange={(value) => {
                      const locationId = parseInt(value)
                      setSelectedLocationId(locationId)
                      // Save to localStorage
                      localStorage.setItem('payment-location-id', value)
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="location">
                      <SelectValue placeholder="Select location" />
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
                  <Label htmlFor="bankAccount">Bank Account *</Label>
                  <Select
                    value={selectedBankAccountId?.toString() || ''}
                    onValueChange={(value) => setSelectedBankAccountId(parseInt(value))}
                    disabled={isLoading || !selectedLocationId || filteredBankAccounts.length === 0}
                  >
                    <SelectTrigger id="bankAccount">
                      <SelectValue placeholder={filteredBankAccounts.length === 0 ? 'Loading...' : 'Select account'} />
                    </SelectTrigger>
                    <SelectContent>
                      {sortBankAccounts(filteredBankAccounts).map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <BankAccountSelectItem account={account} />
                            {account.bank_name && (
                              <span className="text-xs text-muted-foreground">({account.bank_name})</span>
                            )}
                            {account.is_default && ' ⭐'}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLocationId && filteredBankAccounts.length === 0 && (
                    <p className="text-sm text-destructive">
                      No {paymentMethod === 'cash' ? 'cash' : 'bank'} accounts configured for this location
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="grid gap-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Payment Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Payment Date *</Label>
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
                        {paymentDate ? format(paymentDate, 'PPP') : <span>Pick a date</span>}
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
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="paymentMethod">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="referenceNumber">Reference Number</Label>
                  <Input
                    id="referenceNumber"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Transaction/Check #"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Total Payment Amount</Label>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatAmount(totalPaymentAmount)} лв.
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes (optional)"
                  disabled={isLoading}
                  rows={2}
                />
              </div>
            </div>

            {/* Bill Selection */}
            <div className="grid gap-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Select Bills</h3>

              {!selectedLocationId && (
                <div className="text-center py-8 text-muted-foreground">
                  Please select a location first to view bills
                </div>
              )}

              {selectedLocationId && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="vendor">
                      Filter by Vendor {applications.length > 0 ? '(Locked)' : '(Optional)'}
                    </Label>
                    <Popover open={openVendor} onOpenChange={setOpenVendor}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openVendor}
                          className="w-full justify-between"
                          disabled={applications.length > 0}
                        >
                          {selectedVendorId
                            ? vendors.find(v => v.id === selectedVendorId)?.name
                            : "All vendors"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search vendor..." />
                          <CommandList className="max-h-[300px]">
                            <CommandEmpty>No vendor found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="all"
                                onSelect={() => {
                                  if (applications.length === 0) {
                                    setSelectedVendorId(null)
                                    setOpenVendor(false)
                                  }
                                }}
                                disabled={applications.length > 0}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !selectedVendorId ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                All vendors
                              </CommandItem>
                              {vendors.map((vendor) => (
                                <CommandItem
                                  key={vendor.id}
                                  value={vendor.name}
                                  onSelect={() => {
                                    setSelectedVendorId(vendor.id)
                                    setOpenVendor(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedVendorId === vendor.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {vendor.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {applications.length > 0 && selectedVendorId && (
                    <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md">
                      Bills are filtered to show only {vendors.find(v => v.id === selectedVendorId)?.name} vendors. Remove all applications to change vendor.
                    </div>
                  )}

                  {unpaidBills.length > 0 && (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bill #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unpaidBills.map((bill) => (
                        <TableRow key={bill.id}>
                          <TableCell className="font-medium">
                            {bill.doc_num || `#${bill.id}`}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(bill.doc_date)}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {bill.vendor_name || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {bill.location_name || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(bill.total_amount_including_vat ?? bill.total_amount)} лв.
                          </TableCell>
                          <TableCell className="text-right font-medium text-orange-600 dark:text-orange-400">
                            {formatAmount(bill.balance)} лв.
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => addBillApplication(bill)}
                              disabled={applications.some(app => app.billId === bill.id)}
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

                  {unpaidBills.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No unpaid bills found for this location
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Payment Applications */}
            {applications.length > 0 && (
              <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="font-semibold">Payment Applications</h3>

                <div className="border rounded-md bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bill #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Amount to Apply</TableHead>
                        <TableHead className="text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((app) => (
                        <TableRow key={app.billId}>
                          <TableCell className="font-medium">
                            {app.bill.doc_num || `#${app.billId}`}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(app.bill.doc_date)}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {app.bill.vendor_name || '—'}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatAmount(app.bill.balance)} лв.
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={app.bill.balance}
                              value={app.amountApplied}
                              onChange={(e) => updateApplicationAmount(app.billId, parseFloat(e.target.value) || 0)}
                              className="max-w-[150px] ml-auto text-right"
                              disabled={isLoading}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeBillApplication(app.billId)}
                              disabled={isLoading}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell colSpan={4} className="text-right">
                          Total Payment:
                        </TableCell>
                        <TableCell className="text-right text-lg">
                          {formatAmount(totalPaymentAmount)} лв.
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
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || applications.length === 0}>
              {isLoading ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
