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
import { Switch } from '@/components/ui/switch'
import {
  RecurringSalaryTemplate,
  RecurringSalaryFrequency,
  CostType,
  createRecurringSalaryTemplate,
  updateRecurringSalaryTemplate,
} from '@/lib/actions/recurring-salaries'
import { getLaborCostLocations, getStaffMembers, getPersonnelAccounts } from '@/lib/actions/labor-costs'
import { useLanguage } from '@/lib/i18n/context'
import { toast } from 'sonner'

interface RecurringSalaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: RecurringSalaryTemplate | null
  onSuccess: () => void
}

const COST_TYPES: { value: CostType; labelEn: string; labelBg: string }[] = [
  { value: 'salary', labelEn: 'Salary', labelBg: 'Заплата' },
  { value: 'bonus', labelEn: 'Bonus', labelBg: 'Бонус' },
  { value: 'overtime', labelEn: 'Overtime', labelBg: 'Извънреден труд' },
  { value: 'benefits', labelEn: 'Benefits', labelBg: 'Придобивки' },
  { value: 'taxes', labelEn: 'Payroll Taxes', labelBg: 'Осигуровки' },
  { value: 'other', labelEn: 'Other', labelBg: 'Друго' },
]

const FREQUENCIES: { value: RecurringSalaryFrequency; labelEn: string; labelBg: string }[] = [
  { value: 'weekly', labelEn: 'Weekly', labelBg: 'Седмично' },
  { value: 'monthly', labelEn: 'Monthly', labelBg: 'Месечно' },
  { value: 'bimonthly', labelEn: 'Bi-Monthly', labelBg: 'На два месеца' },
]

const DAYS_OF_WEEK = [
  { value: 0, labelEn: 'Sunday', labelBg: 'Неделя' },
  { value: 1, labelEn: 'Monday', labelBg: 'Понеделник' },
  { value: 2, labelEn: 'Tuesday', labelBg: 'Вторник' },
  { value: 3, labelEn: 'Wednesday', labelBg: 'Сряда' },
  { value: 4, labelEn: 'Thursday', labelBg: 'Четвъртък' },
  { value: 5, labelEn: 'Friday', labelBg: 'Петък' },
  { value: 6, labelEn: 'Saturday', labelBg: 'Събота' },
]

export const RecurringSalaryDialog = ({
  open,
  onOpenChange,
  template,
  onSuccess,
}: RecurringSalaryDialogProps) => {
  const { locale } = useLanguage()
  const isEditing = !!template
  const [saving, setSaving] = useState(false)

  // Form state
  const [locationId, setLocationId] = useState<number | null>(null)
  const [profileId, setProfileId] = useState<number | null>(null)
  const [costType, setCostType] = useState<CostType>('salary')
  const [defaultAmount, setDefaultAmount] = useState('')
  const [frequency, setFrequency] = useState<RecurringSalaryFrequency>('monthly')
  const [dayOfWeek, setDayOfWeek] = useState<number>(1) // Monday
  const [dayOfMonth, setDayOfMonth] = useState<number>(1)
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [isActive, setIsActive] = useState(true)

  // Dropdown data
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [staffMembers, setStaffMembers] = useState<Array<{ id: number; first_name: string; last_name: string }>>([])
  const [accounts, setAccounts] = useState<Array<{ id: number; code: string; name: string; name_bg: string | null }>>([])

  useEffect(() => {
    if (open) {
      loadInitialData()

      if (template) {
        // Editing
        setLocationId(template.location_id)
        setProfileId(template.profile_id)
        setCostType(template.cost_type)
        setDefaultAmount(template.default_amount.toString())
        setFrequency(template.frequency)
        setDayOfWeek(template.day_of_week ?? 1)
        setDayOfMonth(template.day_of_month ?? 1)
        setDescription(template.description || '')
        setAccountId(template.account_id)
        setIsActive(template.is_active)
      } else {
        // Creating new
        setLocationId(null)
        setProfileId(null)
        setCostType('salary')
        setDefaultAmount('')
        setFrequency('monthly')
        setDayOfWeek(1)
        setDayOfMonth(1)
        setDescription('')
        setAccountId(null)
        setIsActive(true)
        setStaffMembers([])
      }
    }
  }, [open, template])

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
    if (accResult.data) setAccounts(accResult.data)

    // If editing, load staff for the existing location
    if (template?.location_id) {
      loadStaffForLocation(template.location_id)
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
    if (!profileId) {
      toast.error(locale === 'bg' ? 'Изберете служител' : 'Select an employee')
      return
    }
    if (!defaultAmount || parseFloat(defaultAmount) < 0) {
      toast.error(locale === 'bg' ? 'Въведете валидна сума' : 'Enter a valid amount')
      return
    }

    setSaving(true)

    if (isEditing && template) {
      const result = await updateRecurringSalaryTemplate(template.id, {
        profile_id: profileId,
        cost_type: costType,
        default_amount: parseFloat(defaultAmount),
        frequency,
        day_of_week: frequency === 'weekly' ? dayOfWeek : null,
        day_of_month: frequency !== 'weekly' ? dayOfMonth : null,
        description: description || undefined,
        account_id: accountId,
        is_active: isActive,
      })
      if (result.error) {
        toast.error(result.error)
        setSaving(false)
        return
      }
      toast.success(locale === 'bg' ? 'Шаблонът е обновен' : 'Template updated')
    } else {
      const result = await createRecurringSalaryTemplate({
        location_id: locationId,
        profile_id: profileId,
        cost_type: costType,
        default_amount: parseFloat(defaultAmount),
        frequency,
        day_of_week: frequency === 'weekly' ? dayOfWeek : undefined,
        day_of_month: frequency !== 'weekly' ? dayOfMonth : undefined,
        description: description || undefined,
        account_id: accountId,
      })
      if (result.error) {
        toast.error(result.error)
        setSaving(false)
        return
      }
      toast.success(locale === 'bg' ? 'Шаблонът е създаден' : 'Template created')
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
              ? (locale === 'bg' ? 'Редактиране на шаблон' : 'Edit Recurring Template')
              : (locale === 'bg' ? 'Нов шаблон за заплата' : 'New Recurring Salary Template')}
          </DialogTitle>
          <DialogDescription>
            {locale === 'bg'
              ? 'Шаблонът ще генерира автоматично записи за разходи за труд.'
              : 'This template will auto-generate labor cost entries on schedule.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Location */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Локация' : 'Location'} *
            </Label>
            <Select
              value={locationId?.toString() || ''}
              onValueChange={handleLocationChange}
              disabled={isEditing}
            >
              <SelectTrigger className="col-span-3">
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

          {/* Staff Member */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Служител' : 'Employee'} *
            </Label>
            <Select
              value={profileId?.toString() || ''}
              onValueChange={(v) => setProfileId(parseInt(v))}
              disabled={!locationId || isEditing}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={
                  !locationId
                    ? (locale === 'bg' ? 'Първо изберете локация...' : 'Select location first...')
                    : (locale === 'bg' ? 'Изберете служител...' : 'Select employee...')
                } />
              </SelectTrigger>
              <SelectContent>
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Тип' : 'Type'} *
            </Label>
            <Select
              value={costType}
              onValueChange={(v) => setCostType(v as CostType)}
            >
              <SelectTrigger className="col-span-3">
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

          {/* Default Amount */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Сума по подразбиране' : 'Default Amount'} *
            </Label>
            <div className="col-span-3 flex gap-2 items-center">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(e.target.value)}
                className="flex-1"
                placeholder="0.00"
              />
              <span className="text-muted-foreground">BGN</span>
            </div>
          </div>

          {/* Frequency */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Честота' : 'Frequency'} *
            </Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as RecurringSalaryFrequency)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map(({ value, labelEn, labelBg }) => (
                  <SelectItem key={value} value={value}>
                    {locale === 'bg' ? labelBg : labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Day of Week (for weekly) */}
          {frequency === 'weekly' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                {locale === 'bg' ? 'Ден от седмицата' : 'Day of Week'}
              </Label>
              <Select
                value={dayOfWeek.toString()}
                onValueChange={(v) => setDayOfWeek(parseInt(v))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(({ value, labelEn, labelBg }) => (
                    <SelectItem key={value} value={value.toString()}>
                      {locale === 'bg' ? labelBg : labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day of Month (for monthly/bimonthly) */}
          {frequency !== 'weekly' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                {locale === 'bg' ? 'Ден от месеца' : 'Day of Month'}
              </Label>
              <Select
                value={dayOfMonth.toString()}
                onValueChange={(v) => setDayOfMonth(parseInt(v))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Описание' : 'Description'}
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              rows={2}
              placeholder={locale === 'bg' ? 'напр. Месечна заплата' : 'e.g. Monthly Salary'}
            />
          </div>

          {/* Account */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              {locale === 'bg' ? 'Сметка' : 'Account'}
            </Label>
            <Select
              value={accountId?.toString() || 'none'}
              onValueChange={(v) => setAccountId(v === 'none' ? null : parseInt(v))}
            >
              <SelectTrigger className="col-span-3">
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

          {/* Active Toggle (only for editing) */}
          {isEditing && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                {locale === 'bg' ? 'Активен' : 'Active'}
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <span className="text-sm text-muted-foreground">
                  {isActive
                    ? (locale === 'bg' ? 'Шаблонът ще генерира записи' : 'Template will generate entries')
                    : (locale === 'bg' ? 'Шаблонът е спрян' : 'Template is paused')}
                </span>
              </div>
            </div>
          )}
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
