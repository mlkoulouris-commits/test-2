'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
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
import { Calendar } from '@/components/ui/calendar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, ChevronsUpDown, Check, CalendarIcon } from 'lucide-react'
import { updateManualBill, getBillVendors, getBillDetails, getBillItems, getBillPaymentHistory } from '@/lib/actions/bills'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface BillItem {
  id: string
  articleName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes: string
  vatRate: number | null
  vatAmount: number | null
}

interface EditBillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billId: number
}

export const EditBillDialog = ({ open, onOpenChange, billId }: EditBillDialogProps) => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Form state
  const [vendors, setVendors] = useState<Array<{ id: number; name: string }>>([])
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null)
  const [openVendor, setOpenVendor] = useState(false)
  const [openDocDate, setOpenDocDate] = useState(false)
  const [openDueDate, setOpenDueDate] = useState(false)
  const [openPeriodDate, setOpenPeriodDate] = useState(false)
  const [docNum, setDocNum] = useState('')
  const [docDate, setDocDate] = useState<Date>(new Date())
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [periodDateRange, setPeriodDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>({ from: undefined, to: undefined })
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<BillItem[]>([
    { id: '1', articleName: '', quantity: 0, unitPrice: 0, totalPrice: 0, notes: '', vatRate: null, vatAmount: null }
  ])
  const [payments, setPayments] = useState<any[]>([])
  const [totalPaid, setTotalPaid] = useState(0)
  // VAT fields
  const [hasVat, setHasVat] = useState(false)
  const [billVatRate, setBillVatRate] = useState<number | null>(null)
  const [billVatAmount, setBillVatAmount] = useState<number | null>(null)
  const [vatMode, setVatMode] = useState<"bill" | "items">("bill")

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, billId])

  const loadData = async () => {
    setIsLoadingData(true)
    
    const [vendorsResult, billResult] = await Promise.all([
      getBillVendors(),
      getBillDetails(billId)
    ])
    
    if (vendorsResult.data) {
      setVendors(vendorsResult.data)
    }
    
    if (billResult.data) {
      const bill = billResult.data
      setSelectedVendorId(bill.vendor_id)
      setDocNum(bill.doc_num || '')
      setDocDate(bill.doc_date ? new Date(bill.doc_date) : new Date())
      setDueDate(bill.due_date ? new Date(bill.due_date) : undefined)
      setPeriodDateRange({
        from: bill.period_start ? new Date(bill.period_start) : undefined,
        to: bill.period_end ? new Date(bill.period_end) : undefined
      })
      setDescription(bill.description || '')
      setHasVat(bill.has_vat || false)
      setBillVatRate(bill.vat_rate ? Number(bill.vat_rate) : null)
      setBillVatAmount(bill.vat_amount ? Number(bill.vat_amount) : null)
      // Determine VAT mode: if any item has VAT, use items mode, otherwise bill mode
      const hasItemVat = items.some(item => item.vatRate !== null)
      setVatMode(hasItemVat ? "items" : "bill")
    }
    
    // Load items separately
    const itemsResult = await getBillItems(billId)
    if (itemsResult.data && itemsResult.data.length > 0) {
      const loadedItems = itemsResult.data.map((item, index) => ({
        id: (index + 1).toString(),
        articleName: item.article_name || '',
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        totalPrice: Number(item.total_price || 0),
        notes: item.notes || '',
        vatRate: item.vat_rate ? Number(item.vat_rate) : null,
        vatAmount: item.vat_amount ? Number(item.vat_amount) : null
      }))
      setItems(loadedItems)
      // Determine VAT mode based on loaded items
      const hasItemVat = loadedItems.some(item => item.vatRate !== null)
      if (hasItemVat) {
        setVatMode("items")
      }
    }
    
    // Load payment history
    const paymentsResult = await getBillPaymentHistory(billId)
    if (paymentsResult.data) {
      setPayments(paymentsResult.data)
      const paid = paymentsResult.data.reduce((sum, p) => sum + Number(p.amount_applied || 0), 0)
      setTotalPaid(paid)
    }
    
    setIsLoadingData(false)
  }

  const resetForm = () => {
    setSelectedVendorId(null)
    setOpenVendor(false)
    setOpenDocDate(false)
    setOpenDueDate(false)
    setOpenPeriodDate(false)
    setDocNum('')
    setDocDate(new Date())
    setDueDate(undefined)
    setPeriodDateRange({ from: undefined, to: undefined })
    setDescription('')
    setItems([{ id: '1', articleName: '', quantity: 0, unitPrice: 0, totalPrice: 0, notes: '', vatRate: null, vatAmount: null }])
    setHasVat(false)
    setBillVatRate(null)
    setBillVatAmount(null)
    setVatMode("bill")
    setError('')
    setIsLoading(false)
  }

  const addItem = () => {
    const newId = (Math.max(...items.map(i => parseInt(i.id))) + 1).toString()
    setItems([...items, { id: newId, articleName: '', quantity: 0, unitPrice: 0, totalPrice: 0, notes: '', vatRate: null, vatAmount: null }])
  }

  const removeItem = (id: string) => {
    if (items.length === 1) return
    setItems(items.filter(item => item.id !== id))
  }

  const updateItem = (id: string, field: keyof BillItem, value: string | number | null) => {
    setItems(items.map(item => {
      if (item.id !== id) return item
      
      const updated = { ...item, [field]: value }
      
      // Auto-calculate total price
      if (field === 'quantity' || field === 'unitPrice') {
        updated.totalPrice = Number(updated.quantity) * Number(updated.unitPrice)
      }

      // Auto-calculate VAT amount when VAT rate changes
      if (field === "vatRate" && updated.vatRate !== null && updated.totalPrice > 0) {
        updated.vatAmount = (updated.totalPrice * Number(updated.vatRate)) / 100;
      } else if (field === "totalPrice" && updated.vatRate !== null && updated.totalPrice > 0) {
        updated.vatAmount = (updated.totalPrice * Number(updated.vatRate)) / 100;
      }
      
      return updated
    }))
  }

  const totalAmount = items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)

  // Calculate bill-level VAT when rate or total changes
  useEffect(() => {
    if (hasVat && vatMode === "bill" && billVatRate !== null && totalAmount > 0) {
      setBillVatAmount((totalAmount * billVatRate) / 100);
    } else if (!hasVat || vatMode !== "bill") {
      setBillVatAmount(null);
    }
  }, [hasVat, vatMode, billVatRate, totalAmount]);

  const totalVatAmount = vatMode === "bill" 
    ? (billVatAmount || 0)
    : items.reduce((sum, item) => sum + Number(item.vatAmount || 0), 0);

  const grandTotal = totalAmount + totalVatAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedVendorId) {
      setError('Please select a vendor')
      return
    }

    if (!docNum.trim()) {
      setError('Please enter a document number')
      return
    }

    if (items.length === 0 || items.every(item => !item.articleName.trim())) {
      setError('Please add at least one item')
      return
    }

    if (totalAmount <= 0) {
      setError('Total amount must be greater than 0')
      return
    }

    setIsLoading(true)

    const validItems = items
      .filter(item => item.articleName.trim())
      .map(({ id, ...item }) => ({
        ...item,
        vatRate: vatMode === "items" ? item.vatRate : null,
        vatAmount: vatMode === "items" ? item.vatAmount : null,
      }))

    const result = await updateManualBill(
      billId,
      selectedVendorId,
      docNum,
      format(docDate, 'yyyy-MM-dd'),
      dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      totalAmount,
      description || null,
      validItems,
      periodDateRange.from ? format(periodDateRange.from, 'yyyy-MM-dd') : null,
      periodDateRange.to ? format(periodDateRange.to, 'yyyy-MM-dd') : null,
      undefined, // accountId - keeping existing
      hasVat,
      vatMode === "bill" ? billVatRate : null,
      vatMode === "bill" ? billVatAmount : null
    )

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      onOpenChange(false)
      resetForm()
      router.refresh()
    }
  }

  const selectedVendor = vendors.find(v => v.id === selectedVendorId)

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      onOpenChange(newOpen)
      if (!newOpen) resetForm()
    }}>
      <DialogContent className="!max-w-5xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Bill</DialogTitle>
          <DialogDescription>
            Update bill details and line items
          </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading bill data...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
            <div className="flex-grow overflow-y-auto pr-2 space-y-6">
              {/* Basic Information */}
              <div className="grid gap-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Basic Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="vendor">Vendor *</Label>
                    <Popover open={openVendor} onOpenChange={setOpenVendor}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openVendor}
                          className="w-full justify-between"
                          disabled={isLoading}
                        >
                          {selectedVendor ? selectedVendor.name : "Select vendor"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search vendor..." />
                          <CommandList className="max-h-[300px]">
                            <CommandEmpty>No vendor found.</CommandEmpty>
                            <CommandGroup>
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
                                      selectedVendorId === vendor.id ? "opacity-100" : "opacity-0"
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

                  <div className="grid gap-2">
                    <Label htmlFor="docNum">Document Number *</Label>
                    <Input
                      id="docNum"
                      value={docNum}
                      onChange={(e) => setDocNum(e.target.value)}
                      placeholder="INV-001"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="docDate">Document Date *</Label>
                    <Popover open={openDocDate} onOpenChange={setOpenDocDate}>
                      <PopoverTrigger asChild>
                        <Button
                          id="docDate"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !docDate && "text-muted-foreground"
                          )}
                          disabled={isLoading}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {docDate ? format(docDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={docDate}
                          onSelect={(date) => {
                            if (date) {
                              setDocDate(date)
                              setOpenDocDate(false)
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Popover open={openDueDate} onOpenChange={setOpenDueDate}>
                      <PopoverTrigger asChild>
                        <Button
                          id="dueDate"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dueDate && "text-muted-foreground"
                          )}
                          disabled={isLoading}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dueDate}
                          onSelect={(date) => {
                            setDueDate(date)
                            setOpenDueDate(false)
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="periodDate">Billing Period (Optional)</Label>
                    <Popover open={openPeriodDate} onOpenChange={setOpenPeriodDate}>
                      <PopoverTrigger asChild>
                        <Button
                          id="periodDate"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !periodDateRange.from && "text-muted-foreground"
                          )}
                          disabled={isLoading}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {periodDateRange.from ? (
                            periodDateRange.to ? (
                              <>
                                {format(periodDateRange.from, "LLL dd, y")} -{" "}
                                {format(periodDateRange.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(periodDateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={periodDateRange}
                          onSelect={(range) => {
                            setPeriodDateRange(range || { from: undefined, to: undefined })
                          }}
                          numberOfMonths={2}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      For utility bills or recurring expenses - what period does this bill cover?
                    </p>
                  </div>

                  <div className="grid gap-2 md:col-span-2">
                    <Label>Subtotal</Label>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 pt-2">
                      {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} лв.
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Additional notes..."
                    disabled={isLoading}
                    rows={2}
                  />
                </div>
              </div>

              {/* VAT Section */}
              <div className="grid gap-4 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasVat"
                    checked={hasVat}
                    onChange={(e) => {
                      setHasVat(e.target.checked);
                      if (!e.target.checked) {
                        setBillVatRate(null);
                        setBillVatAmount(null);
                        setVatMode("bill");
                        // Clear item VAT when disabling VAT
                        setItems(items.map(item => ({ ...item, vatRate: null, vatAmount: null })));
                      }
                    }}
                    className="h-4 w-4"
                    disabled={isLoading}
                  />
                  <Label htmlFor="hasVat" className="font-semibold text-amber-900 dark:text-amber-100 cursor-pointer">
                    This bill has VAT
                  </Label>
                </div>

                {hasVat && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>VAT Mode</Label>
                      <Select
                        value={vatMode}
                        onValueChange={(value: "bill" | "items") => {
                          setVatMode(value);
                          if (value === "bill") {
                            // Clear item VAT
                            setItems(items.map(item => ({ ...item, vatRate: null, vatAmount: null })));
                          } else {
                            // Clear bill VAT
                            setBillVatRate(null);
                            setBillVatAmount(null);
                          }
                        }}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bill">Apply VAT to entire bill</SelectItem>
                          <SelectItem value="items">Apply VAT per item</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {vatMode === "bill" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="billVatRate">VAT Rate (%)</Label>
                          <Input
                            id="billVatRate"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={billVatRate || ""}
                            onChange={(e) => {
                              const rate = e.target.value ? parseFloat(e.target.value) : null;
                              setBillVatRate(rate);
                            }}
                            placeholder="20.00"
                            disabled={isLoading}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="billVatAmount">VAT Amount</Label>
                          <Input
                            id="billVatAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={billVatAmount || ""}
                            onChange={(e) => {
                              const amount = e.target.value ? parseFloat(e.target.value) : null;
                              setBillVatAmount(amount);
                            }}
                            placeholder="0.00"
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Set VAT rate for each item in the line items table below
                      </p>
                    )}

                    {hasVat && totalVatAmount > 0 && (
                      <div className="grid gap-2">
                        <Label>Total VAT</Label>
                        <div className="text-xl font-semibold text-amber-700 dark:text-amber-300">
                          {totalVatAmount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          лв.
                        </div>
                      </div>
                    )}

                    {hasVat && grandTotal > 0 && (
                      <div className="grid gap-2 border-t pt-4">
                        <Label>Grand Total (Subtotal + VAT)</Label>
                        <div className="text-2xl font-bold text-amber-800 dark:text-amber-200">
                          {grandTotal.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          лв.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="grid gap-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Line Items</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addItem}
                    disabled={isLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Item Name *</TableHead>
                        <TableHead className="w-[120px] text-right">Quantity *</TableHead>
                        <TableHead className="w-[120px] text-right">Unit Price *</TableHead>
                        <TableHead className="w-[120px] text-right">Total</TableHead>
                        {hasVat && vatMode === "items" && (
                          <>
                            <TableHead className="w-[100px] text-right">
                              VAT Rate (%)
                            </TableHead>
                            <TableHead className="w-[100px] text-right">
                              VAT Amount
                            </TableHead>
                          </>
                        )}
                        <TableHead className="w-[200px]">Notes</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Input
                              value={item.articleName}
                              onChange={(e) => updateItem(item.id, 'articleName', e.target.value)}
                              placeholder="Item name"
                              disabled={isLoading}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              value={item.quantity || ''}
                              onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="text-right"
                              disabled={isLoading}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice || ''}
                              onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="text-right"
                              disabled={isLoading}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} лв.
                          </TableCell>
                          {hasVat && vatMode === "items" && (
                            <>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={item.vatRate || ""}
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "vatRate",
                                      e.target.value ? parseFloat(e.target.value) : null
                                    )
                                  }
                                  placeholder="20.00"
                                  className="text-right"
                                  disabled={isLoading}
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap">
                                {(item.vatAmount || 0).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                лв.
                              </TableCell>
                            </>
                          )}
                          <TableCell>
                            <Input
                              value={item.notes}
                              onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                              placeholder="Optional notes"
                              disabled={isLoading}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive"
                              onClick={() => removeItem(item.id)}
                              disabled={isLoading || items.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Payment History */}
            {payments.length > 0 && (
              <div className="grid gap-4 p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-green-900 dark:text-green-100">Payment History</h3>
                  <Badge className="bg-green-600 hover:bg-green-700">
                    {payments.length} Payment{payments.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                
                <div className="border rounded-md bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount Applied</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">
                            {payment.bill_payments?.payment_number || `#${payment.id}`}
                          </TableCell>
                          <TableCell>
                            {payment.bill_payments?.payment_date 
                              ? new Date(payment.bill_payments.payment_date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {payment.bill_payments?.payment_method 
                              ? payment.bill_payments.payment_method.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                              : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {payment.bill_payments?.reference_number || '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                            {Number(payment.amount_applied || 0).toLocaleString('en-US', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })} лв.
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-green-50 dark:bg-green-950/20">
                        <TableCell colSpan={4} className="text-right">
                          Total Paid:
                        </TableCell>
                        <TableCell className="text-right text-lg text-green-600 dark:text-green-400">
                          {totalPaid.toLocaleString('en-US', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })} лв.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {error && (
              <div className="text-destructive text-sm mt-4 px-4 flex-shrink-0">{error}</div>
            )}

            <DialogFooter className="flex-shrink-0 p-4 bg-background border-t mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || isLoadingData}>
                {isLoading ? 'Updating Bill...' : 'Update Bill'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

