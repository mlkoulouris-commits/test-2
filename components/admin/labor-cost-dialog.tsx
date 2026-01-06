'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
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
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLanguage } from '@/lib/i18n/context'
import {
  LaborCost,
  createLaborCost,
  updateLaborCost,
  getLaborCostLocations,
  getStaffMembers,
  getPersonnelAccounts,
} from '@/lib/actions/labor-costs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Define locally to avoid server action import issues
type CostType = 'salary' | 'bonus' | 'overtime' | 'benefits' | 'taxes' | 'other'

const COST_TYPES: { value: CostType; labelEn: string; labelBg: string }[] = [
  { value: 'salary', labelEn: 'Salary', labelBg: 'Заплата' },
  { value: 'bonus', labelEn: 'Bonus', labelBg: 'Бонус' },
  { value: 'overtime', labelEn: 'Overtime', labelBg: 'Извънреден труд' },
  { value: 'benefits', labelEn: 'Benefits', labelBg: 'Придобивки' },
  { value: 'taxes', labelEn: 'Payroll Taxes', labelBg: 'Осигуровки' },
  { value: 'other', labelEn: 'Other', labelBg: 'Друго' },
]

interface LaborCostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  laborCost?: LaborCost | null
  onSuccess: () => void
}

export const LaborCostDialog = ({
  open,
  onOpenChange,
  laborCost,
  onSuccess,
}: LaborCostDialogProps) => {
  const { locale } = useLanguage()
  const isEditing = !!laborCost
  const [saving, setSaving] = useState(false)

  // Form state
  const [locationId, setLocationId] = useState<number | null>(null)
  const [profileId, setProfileId] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [costType, setCostType] = useState<CostType>('salary')
  const [amount, setAmount] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [paymentDate, setPaymentDate] = useState<Date | undefined>()
  const [accountId, setAccountId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  // Dropdown data
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [staffMembers, setStaffMembers] = useState<Array<{ id: number; first_name: string; last_name: string }>>([])
  const [accounts, setAccounts] = useState<Array<{ id: number; code: string; name: string; name_bg: string | null }>>([])

  useEffect(() => {
    if (open) {
      loadInitialData()

      if (laborCost) {
        // Editing
        setLocationId(laborCost.location_id)
        setProfileId(laborCost.profile_id)
        setDescription(laborCost.description || '')
        setCostType(laborCost.cost_type)
        setAmount(laborCost.amount.toString())
        setDateRange({
          from: new Date(laborCost.period_start),
          to: new Date(laborCost.period_end),
        })
        setPaymentDate(laborCost.payment_date ? new Date(laborCost.payment_date) : undefined)
        setAccountId(laborCost.account_id)
        setNotes(laborCost.notes || '')
      } else {
        // Creating new
        setLocationId(null)
        setProfileId(null)
        setDescription('')
        setCostType('salary')
        setAmount('')
        setDateRange(undefined)
        setPaymentDate(undefined)
        setAccountId(null)
        setNotes('')
        setStaffMembers([]) // Clear staff until location selected
      }
    }
  }, [open, laborCost])

  // Reload staff members when location changes
  useEffect(() => {
    if (open && locationId) {
      loadStaffForLocation(locationId)
    } else if (open && !locationId) {
      setStaffMembers([])
      setProfileId(null)
    }
  }, [locationId, open])

  const loadInitialData = async () => {
    const [locResult, accResult] = await Promise.all([
      getLaborCostLocations(),
      getPersonnelAccounts(),
    ])

    if (locResult.data) setLocations(locResult.data)
    if (accResult.data) {
      setAccounts(accResult.data)
      // Prefill with first personnel account when creating new entry
      if (!laborCost && accResult.data.length > 0) {
        setAccountId(accResult.data[0].id)
      }
    }

    // If editing, load staff for the existing location
    if (laborCost?.location_id) {
      loadStaffForLocation(laborCost.location_id)
    }
  }

  const loadStaffForLocation = async (locId: number) => {
    const result = await getStaffMembers(locId)
    if (result.data) {
      setStaffMembers(result.data)
    }
  }

  const handleLocationChange = (value: string) => {
    const newLocationId = parseInt(value)
    setLocationId(newLocationId)
    // Clear profile selection when location changes
    if (newLocationId !== locationId) {
      setProfileId(null)
    }
  }

  const handleSave = async () => {
    // Validation
    if (!locationId) {
      toast.error(locale === 'bg' ? 'Изберете локация' : 'Select a location')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(locale === 'bg' ? 'Въведете валидна сума' : 'Enter a valid amount')
      return
    }
    if (!dateRange?.from || !dateRange?.to) {
      toast.error(locale === 'bg' ? 'Изберете период' : 'Select a period')
      return
    }

    setSaving(true)

    const data = {
      locationId,
      profileId: profileId || null,
      description: description || undefined,
      costType,
      amount: parseFloat(amount),
      periodStart: format(dateRange.from, 'yyyy-MM-dd'),
      periodEnd: format(dateRange.to, 'yyyy-MM-dd'),
      paymentDate: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : null,
      accountId: accountId || null,
      notes: notes || undefined,
    }

    if (isEditing && laborCost) {
      const result = await updateLaborCost(laborCost.id, data)
      if (result.error) {
        toast.error(result.error)
        setSaving(false)
        return
      }
      toast.success(locale === 'bg' ? 'Записът е обновен' : 'Entry updated')
    } else {
      const result = await createLaborCost(data)
      if (result.error) {
        toast.error(result.error)
        setSaving(false)
        return
      }
      toast.success(locale === 'bg' ? 'Записът е създаден' : 'Entry created')
    }

    setSaving(false)
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? (locale === 'bg' ? 'Редактиране на разход за труд' : 'Edit Labor Cost')
              : (locale === 'bg' ? 'Нов разход за труд' : 'New Labor Cost')}
          </DialogTitle>
          <DialogDescription>
            {locale === 'bg'
              ? 'Въведете информация за разхода'
              : 'Enter labor cost information'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Location */}
          <div className="grid grid-cols-[160px_1fr] items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Локация' : 'Location'} *
            </Label>
            <Select
              value={locationId?.toString() || ''}
              onValueChange={handleLocationChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={locale === 'bg' ? 'Изберете локация...' : 'Select location...'} />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Staff Member (optional) */}
          <div className="grid grid-cols-[160px_1fr] items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Служител' : 'Staff Member'}
            </Label>
            <Select
              value={profileId?.toString() || 'none'}
              onValueChange={(v) => setProfileId(v === 'none' ? null : parseInt(v))}
              disabled={!locationId}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !locationId
                    ? (locale === 'bg' ? 'Първо изберете локация...' : 'Select location first...')
                    : (locale === 'bg' ? 'По избор...' : 'Optional...')
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {locale === 'bg' ? '— Без служител —' : '— No staff member —'}
                </SelectItem>
                {staffMembers.length === 0 && locationId ? (
                  <SelectItem value="no-staff" disabled>
                    {locale === 'bg' ? 'Няма служители в тази локация' : 'No staff at this location'}
                  </SelectItem>
                ) : (
                  staffMembers.map(staff => (
                    <SelectItem key={staff.id} value={staff.id.toString()}>
                      {staff.first_name} {staff.last_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Cost Type */}
          <div className="grid grid-cols-[160px_1fr] items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Тип' : 'Type'} *
            </Label>
            <Select
              value={costType}
              onValueChange={(v) => setCostType(v as CostType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COST_TYPES.map(({ value, labelEn, labelBg }) => (
                  <SelectItem key={value} value={value}>
                    {locale === 'bg' ? labelBg : labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="grid grid-cols-[160px_1fr] items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Описание' : 'Description'}
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={locale === 'bg' ? 'напр. Месечна заплата Ноември' : 'e.g. November Monthly Salary'}
            />
          </div>

          {/* Amount */}
          <div className="grid grid-cols-[160px_1fr] items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Сума' : 'Amount'} *
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1"
                placeholder="0.00"
              />
              <span className="text-muted-foreground">BGN</span>
            </div>
          </div>

          {/* Period */}
          <div className="grid grid-cols-[160px_1fr] items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Период' : 'Period'} *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dateRange?.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'dd MMM yyyy')} - {format(dateRange.to, 'dd MMM yyyy')}
                      </>
                    ) : (
                      format(dateRange.from, 'dd MMM yyyy')
                    )
                  ) : (
                    locale === 'bg' ? 'Изберете период...' : 'Select period...'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Planned Payment Date */}
          <div className="grid grid-cols-[160px_1fr] items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Планирано плащане' : 'Planned Payment Date'}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !paymentDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate
                    ? format(paymentDate, 'dd MMM yyyy')
                    : (locale === 'bg' ? 'Изберете дата...' : 'Select date...')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={setPaymentDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Account */}
          <div className="grid grid-cols-[160px_1fr] items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Сметка' : 'Account'}
            </Label>
            <Select
              value={accountId?.toString() || 'none'}
              onValueChange={(v) => setAccountId(v === 'none' ? null : parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder={locale === 'bg' ? 'Избери сметка...' : 'Select account...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {locale === 'bg' ? '— По подразбиране —' : '— Default —'}
                </SelectItem>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    {acc.code} - {locale === 'bg' && acc.name_bg ? acc.name_bg : acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-[160px_1fr] items-start gap-4">
            <Label className="text-right pt-2">
              {locale === 'bg' ? 'Бележки' : 'Notes'}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
