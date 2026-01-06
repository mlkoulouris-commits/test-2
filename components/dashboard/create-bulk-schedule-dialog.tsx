'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { createBulkSchedule } from '@/lib/actions/bulk-schedule'
import { CalendarPlus, CalendarIcon, Clock } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { cn } from '@/lib/utils'

interface CreateBulkScheduleDialogProps {
  locationId: number
  staff: any[]
  onSuccess: () => void
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
]

const generateHours = () => Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const generateMinutes = () => ['00', '15', '30', '45']

export const CreateBulkScheduleDialog = ({ locationId, staff, onSuccess }: CreateBulkScheduleDialogProps) => {
  const [open, setOpen] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [endsNextDay, setEndsNextDay] = useState(false)
  const [startDate, setStartDate] = useState<Date>(addDays(new Date(), 1))
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 7))
  const [repeatPattern, setRepeatPattern] = useState<'none' | 'daily' | 'weekly' | 'custom'>('none')
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]) // Mon-Fri default
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const calculateDuration = () => {
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    if (endsNextDay || totalMinutes < 0) {
      totalMinutes += 24 * 60
    }
    
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}h ${minutes}m`
  }

  const handleDayToggle = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setIsLoading(true)

    if (selectedUserIds.length === 0) {
      setError('Please select at least one staff member')
      setIsLoading(false)
      return
    }

    if (repeatPattern !== 'none' && !endDate) {
      setError('End date is required for repeating schedules')
      setIsLoading(false)
      return
    }

    if ((repeatPattern === 'weekly' || repeatPattern === 'custom') && selectedDays.length === 0) {
      setError('Please select at least one day')
      setIsLoading(false)
      return
    }

    // Create schedules for all selected users
    const results = await Promise.all(
      selectedUserIds.map(userId =>
        createBulkSchedule({
          userId,
          locationId,
          startTime,
          endTime,
          endsNextDay,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: repeatPattern !== 'none' ? format(endDate, 'yyyy-MM-dd') : undefined,
          repeatPattern,
          repeatDays: (repeatPattern === 'weekly' || repeatPattern === 'custom') ? selectedDays : undefined,
        })
      )
    )

    const errors = results.filter(r => r.error).map(r => r.error)
    const totalShifts = results.filter(r => !r.error).reduce((sum, r) => sum + (r.count || 0), 0)
    
    if (errors.length > 0) {
      setError(errors.join(', '))
      setIsLoading(false)
    } else {
      setSuccessMessage(`Successfully created ${totalShifts} shift${totalShifts !== 1 ? 's' : ''} for ${selectedUserIds.length} staff member${selectedUserIds.length !== 1 ? 's' : ''}!`)
      setTimeout(() => {
        setOpen(false)
        setSelectedUserIds([])
        setStartTime('09:00')
        setEndTime('17:00')
        setEndsNextDay(false)
        setStartDate(addDays(new Date(), 1))
        setEndDate(addDays(new Date(), 7))
        setRepeatPattern('none')
        setSelectedDays([1, 2, 3, 4, 5])
        setSuccessMessage('')
        onSuccess()
      }, 1500)
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus className="h-4 w-4 mr-2" />
          Create Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Staff Schedule</DialogTitle>
            <DialogDescription>
              Schedule shifts for staff members ({selectedUserIds.length} selected)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Staff Members *</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {staff.filter(member => member.is_active).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No active staff members available
                  </p>
                ) : (
                  staff.filter(member => member.is_active).map((member) => (
                    <div key={member.user_id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`bulk-${member.user_id}`}
                        checked={selectedUserIds.includes(member.user_id)}
                        onCheckedChange={() => toggleUser(member.user_id)}
                        disabled={isLoading}
                      />
                      <label
                        htmlFor={`bulk-${member.user_id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {member.first_name} {member.last_name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <div className="flex gap-2">
                  <Select
                    value={startTime.split(':')[0]}
                    onValueChange={(hour) => setStartTime(`${hour}:${startTime.split(':')[1]}`)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateHours().map((hour) => (
                        <SelectItem key={hour} value={hour}>
                          {hour}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="flex items-center">:</span>
                  <Select
                    value={startTime.split(':')[1]}
                    onValueChange={(minute) => setStartTime(`${startTime.split(':')[0]}:${minute}`)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMinutes().map((minute) => (
                        <SelectItem key={minute} value={minute}>
                          {minute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>End Time *</Label>
                <div className="flex gap-2">
                  <Select
                    value={endTime.split(':')[0]}
                    onValueChange={(hour) => setEndTime(`${hour}:${endTime.split(':')[1]}`)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateHours().map((hour) => (
                        <SelectItem key={hour} value={hour}>
                          {hour}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="flex items-center">:</span>
                  <Select
                    value={endTime.split(':')[1]}
                    onValueChange={(minute) => setEndTime(`${endTime.split(':')[0]}:${minute}`)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMinutes().map((minute) => (
                        <SelectItem key={minute} value={minute}>
                          {minute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-md">
              <Checkbox
                id="ends-next-day-bulk"
                checked={endsNextDay}
                onCheckedChange={(checked) => setEndsNextDay(checked === true)}
                disabled={isLoading}
              />
              <div className="flex-1">
                <label
                  htmlFor="ends-next-day-bulk"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Shift ends next day
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Enable for overnight shifts (e.g., 10 PM - 4 AM)
                </p>
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                Duration: {calculateDuration()}
              </div>
            </div>

            <div className="space-y-3 p-4 border rounded-lg">
              <Label>Schedule Type *</Label>
              <RadioGroup value={repeatPattern} onValueChange={(val: any) => setRepeatPattern(val)} disabled={isLoading}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="none" />
                  <Label htmlFor="none" className="cursor-pointer font-normal">Single day (no repeat)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="daily" id="daily" />
                  <Label htmlFor="daily" className="cursor-pointer font-normal">Daily (every day)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="weekly" id="weekly" />
                  <Label htmlFor="weekly" className="cursor-pointer font-normal">Weekly (select days)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="cursor-pointer font-normal">Custom days</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !startDate && "text-muted-foreground"
                    )}
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading}
                    weekStartsOn={1}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {repeatPattern !== 'none' && (
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-10",
                        !endDate && "text-muted-foreground"
                      )}
                      disabled={isLoading}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      disabled={(date) => date < startDate || isLoading}
                      weekStartsOn={1}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {(repeatPattern === 'weekly' || repeatPattern === 'custom') && (
              <div className="space-y-3 p-4 border rounded-lg">
                <Label>Select Days *</Label>
                <div className="grid grid-cols-4 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={selectedDays.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                        disabled={isLoading}
                      />
                      <label
                        htmlFor={`day-${day.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {day.short}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                    disabled={isLoading}
                  >
                    Weekdays
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDays([0, 6])}
                    disabled={isLoading}
                  >
                    Weekend
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                    disabled={isLoading}
                  >
                    All Days
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

