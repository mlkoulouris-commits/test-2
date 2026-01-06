'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { createScheduledShift } from '@/lib/actions/shifts'
import { Plus, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const generateHours = () => Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const generateMinutes = () => ['00', '15', '30', '45']

interface CreateShiftDialogProps {
  locationId: number
  staff: any[]
  onSuccess: () => void
}

export const CreateShiftDialog = ({ locationId, staff, onSuccess }: CreateShiftDialogProps) => {
  const [open, setOpen] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [endsNextDay, setEndsNextDay] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (selectedDates.length === 0) {
      setError('Please select at least one date')
      return
    }

    setIsLoading(true)

    // Create shifts for all selected users and all selected dates
    const results = await Promise.all(
      selectedUserIds.flatMap(userId =>
        selectedDates.map(date =>
          createScheduledShift({
            userId,
            locationId,
            shiftDate: format(date, 'yyyy-MM-dd'),
            startTime,
            endTime,
            endsNextDay,
          })
        )
      )
    )

    const errors = results.filter(r => r.error).map(r => r.error)
    
    if (errors.length > 0) {
      setError(errors.join(', '))
      setIsLoading(false)
    } else {
      setOpen(false)
      setSelectedUserIds([])
      setSelectedDates([])
      setStartTime('09:00')
      setEndTime('17:00')
      setEndsNextDay(false)
      onSuccess()
      setIsLoading(false)
    }
  }

  const activeStaff = staff.filter((member: any) => member.profiles?.is_active !== false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Shift
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Shift</DialogTitle>
            <DialogDescription>
              Schedule shifts for staff members ({selectedUserIds.length} member{selectedUserIds.length !== 1 ? 's' : ''}, {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Select Date(s) *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      selectedDates.length === 0 && "text-muted-foreground"
                    )}
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDates.length === 0 ? (
                      <span>Pick date(s)</span>
                    ) : selectedDates.length === 1 ? (
                      format(selectedDates[0], 'PPP')
                    ) : (
                      <span>{selectedDates.length} dates selected</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="multiple"
                    selected={selectedDates.length > 0 ? selectedDates : undefined}
                    onSelect={(dates) => {
                      if (dates) {
                        setSelectedDates(dates as Date[])
                      } else {
                        setSelectedDates([])
                      }
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading}
                    weekStartsOn={1}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {selectedDates.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedDates.map((date, idx) => (
                    <span key={idx} className="text-xs bg-muted px-2 py-1 rounded">
                      {format(date, 'MMM d')}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Staff Members *</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {activeStaff.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No active staff members available
                  </p>
                ) : (
                  activeStaff.map((member: any) => (
                    <div key={member.user_id} className="flex items-center space-x-2">
                      <Checkbox
                        id={member.user_id}
                        checked={selectedUserIds.includes(member.user_id)}
                        onCheckedChange={() => toggleUser(member.user_id)}
                        disabled={isLoading}
                      />
                      <label
                        htmlFor={member.user_id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {member.profiles?.first_name} {member.profiles?.last_name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
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
                  <Label>End Time</Label>
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
                  id="ends-next-day"
                  checked={endsNextDay}
                  onCheckedChange={(checked) => setEndsNextDay(checked === true)}
                  disabled={isLoading}
                />
                <div className="flex-1">
                  <label
                    htmlFor="ends-next-day"
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
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={selectedUserIds.length === 0 || selectedDates.length === 0 || isLoading}>
              {isLoading ? 'Creating...' : `Create ${selectedUserIds.length * selectedDates.length} Shift${(selectedUserIds.length * selectedDates.length) !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

