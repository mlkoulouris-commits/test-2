'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { updateScheduledShift, deleteScheduledShift } from '@/lib/actions/shifts'
import { Edit, Trash } from 'lucide-react'
import { formatSofiaTime } from '@/lib/utils/timezone'
import { AlertDialogConfirm } from '@/components/ui/alert-dialog-confirm'

const generateHours = () => Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const generateMinutes = () => ['00', '15', '30', '45']

interface EditShiftDialogProps {
  shift: any
  onSuccess: () => void
  children?: React.ReactNode
}

export const EditShiftDialog = ({ shift, onSuccess, children }: EditShiftDialogProps) => {
  const [open, setOpen] = useState(false)
  
  // Extract time from shift in Sofia timezone
  const initialStartTime = formatSofiaTime(shift.scheduled_start, 'HH:mm')
  const initialEndTime = formatSofiaTime(shift.scheduled_end, 'HH:mm')
  
  const [startHour, setStartHour] = useState(initialStartTime.split(':')[0])
  const [startMinute, setStartMinute] = useState(initialStartTime.split(':')[1])
  const [endHour, setEndHour] = useState(initialEndTime.split(':')[0])
  const [endMinute, setEndMinute] = useState(initialEndTime.split(':')[1])
  const [endsNextDay, setEndsNextDay] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const startTime = `${startHour}:${startMinute}`
  const endTime = `${endHour}:${endMinute}`

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const result = await updateScheduledShift(shift.id, {
      startTime,
      endTime,
      endsNextDay,
    })

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      setOpen(false)
      onSuccess()
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setError('')
    setIsLoading(true)

    const result = await deleteScheduledShift(shift.id)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      setOpen(false)
      onSuccess()
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="outline">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleUpdate}>
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
            <DialogDescription>
              {shift.profiles?.first_name} {shift.profiles?.last_name} - {shift.business_date ? formatSofiaTime(shift.business_date + 'T00:00:00', 'MMMM d, yyyy') : 'Edit Times'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Start Time (Sofia Time) *</Label>
              <div className="flex gap-2">
                <Select value={startHour} onValueChange={setStartHour} disabled={isLoading}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateHours().map((hour) => (
                      <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="flex items-center">:</span>
                <Select value={startMinute} onValueChange={setStartMinute} disabled={isLoading}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateMinutes().map((minute) => (
                      <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>End Time (Sofia Time) *</Label>
              <div className="flex gap-2">
                <Select value={endHour} onValueChange={setEndHour} disabled={isLoading}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateHours().map((hour) => (
                      <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="flex items-center">:</span>
                <Select value={endMinute} onValueChange={setEndMinute} disabled={isLoading}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateMinutes().map((minute) => (
                      <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="endsNextDay" 
                checked={endsNextDay}
                onCheckedChange={(checked) => setEndsNextDay(checked as boolean)}
                disabled={isLoading}
              />
              <Label htmlFor="endsNextDay" className="cursor-pointer">
                Shift ends next day
              </Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isLoading}
            >
              <Trash className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <div className="flex-1" />
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialogConfirm
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        title="Delete Shift"
        description="Are you sure you want to delete this shift? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </Dialog>
  )
}

