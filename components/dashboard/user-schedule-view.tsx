'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, ChevronLeft, ChevronRight, Clock, Edit2 } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, startOfWeek, endOfWeek, differenceInMinutes, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { getUserSchedule } from '@/lib/actions/shifts'
import { formatSofiaTime } from '@/lib/utils/timezone'
import { EditShiftDialog } from './edit-shift-dialog'

interface UserScheduleViewProps {
  locationId: number
  staff: any[]
}

export const UserScheduleView = ({ locationId, staff }: UserScheduleViewProps) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [shifts, setShifts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const activeStaff = staff.filter((member: any) => member.profiles?.is_active !== false)
  
  const formatStaffName = (member: any) => {
    const firstName = member.profiles?.first_name || ''
    const lastName = member.profiles?.last_name || ''
    return firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Unknown'
  }

  const formatRole = (role: string) => {
    if (!role) return 'Staff'
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  useEffect(() => {
    if (selectedUserId) {
      loadUserSchedule()
    }
  }, [selectedUserId, selectedMonth])

  const loadUserSchedule = async () => {
    if (!selectedUserId) return
    
    setIsLoading(true)
    const monthStart = startOfMonth(selectedMonth)
    const monthEnd = endOfMonth(selectedMonth)
    
    const result = await getUserSchedule(
      selectedUserId,
      format(monthStart, 'yyyy-MM-dd'),
      format(monthEnd, 'yyyy-MM-dd')
    )
    
    if (result.data) {
      // Add user profile info to each shift for EditShiftDialog
      const selectedStaff = activeStaff.find(s => s.user_id === selectedUserId)
      const shiftsWithProfile = result.data.map(shift => ({
        ...shift,
        profiles: selectedStaff?.profiles
      }))
      setShifts(shiftsWithProfile)
    }
    setIsLoading(false)
  }

  const calculateHours = (startTime: string, endTime: string) => {
    const start = parseISO(startTime)
    const end = parseISO(endTime)
    const minutes = differenceInMinutes(end, start)
    return (minutes / 60).toFixed(2)
  }

  const getDailyHours = (date: string) => {
    const dayShifts = shifts.filter(s => s.business_date === date)
    return dayShifts.reduce((total, shift) => {
      return total + parseFloat(calculateHours(shift.scheduled_start, shift.scheduled_end))
    }, 0)
  }

  const getWeeklyHours = (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
    
    return weekDays.reduce((total, day) => {
      return total + getDailyHours(format(day, 'yyyy-MM-dd'))
    }, 0)
  }

  const getMonthlyHours = () => {
    return shifts.reduce((total, shift) => {
      return total + parseFloat(calculateHours(shift.scheduled_start, shift.scheduled_end))
    }, 0)
  }

  const getShiftsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return shifts.filter(s => s.business_date === dateStr)
  }

  const monthStart = startOfMonth(selectedMonth)
  const monthEnd = endOfMonth(selectedMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const selectedUser = activeStaff.find(s => s.user_id === selectedUserId)

  return (
    <div className="space-y-6">
      {/* User Selection */}
      <Card>
        <CardHeader>
          <CardTitle>User Schedule</CardTitle>
          <CardDescription>View individual staff member schedules and hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Staff Member</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {activeStaff.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <div className="flex items-center gap-2">
                        <span>{formatStaffName(member)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {formatRole(member.profiles?.role)}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUserId && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center">
                  <h3 className="text-lg font-semibold">{format(selectedMonth, 'MMMM yyyy')}</h3>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedUserId && !isLoading && (
        <>
          {/* Hours Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Monthly Hours</CardDescription>
                <CardTitle className="text-3xl">{getMonthlyHours().toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{shifts.length} shifts</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>This Week</CardDescription>
                <CardTitle className="text-3xl">{getWeeklyHours(new Date()).toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Current week hours</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Today</CardDescription>
                <CardTitle className="text-3xl">{getDailyHours(format(new Date(), 'yyyy-MM-dd')).toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Scheduled hours today</p>
              </CardContent>
            </Card>
          </div>

          {/* Calendar View */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule Calendar</CardTitle>
              <CardDescription>
                {selectedUser ? formatStaffName(selectedUser) : 'Staff'}'s shifts for {format(selectedMonth, 'MMMM yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-2">
                  {/* Day Headers */}
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                      {day}
                    </div>
                  ))}

                  {/* Calendar Days */}
                  {calendarDays.map((day) => {
                    const dayShifts = getShiftsForDate(day)
                    const isCurrentMonth = day >= monthStart && day <= monthEnd
                    const dailyHours = getDailyHours(format(day, 'yyyy-MM-dd'))
                    const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "min-h-[120px] p-2 border rounded-lg text-left",
                          !isCurrentMonth && "text-muted-foreground bg-muted/30",
                          isToday && "border-blue-500 bg-blue-50 dark:bg-blue-950",
                          dayShifts.length > 0 && "bg-green-50 dark:bg-green-950"
                        )}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={cn(
                            "text-sm font-medium",
                            isToday && "text-blue-600 dark:text-blue-400"
                          )}>
                            {format(day, 'd')}
                          </span>
                          {dailyHours > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {dailyHours.toFixed(1)}h
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          {dayShifts.map((shift) => {
                            const startTime = formatSofiaTime(shift.scheduled_start, 'HH:mm')
                            const endTime = formatSofiaTime(shift.scheduled_end, 'HH:mm')
                            const hours = calculateHours(shift.scheduled_start, shift.scheduled_end)
                            
                            return (
                              <div
                                key={shift.id}
                                className="group relative text-xs bg-primary/10 border border-primary/20 rounded px-2 py-1 hover:bg-primary/20 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1 flex-1 min-w-0">
                                    <Clock className="h-3 w-3 flex-shrink-0" />
                                    <span className="font-medium truncate">{startTime} - {endTime}</span>
                                  </div>
                                  <EditShiftDialog shift={shift} onSuccess={loadUserSchedule}>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  </EditShiftDialog>
                                </div>
                                <div className="text-muted-foreground">{hours}h</div>
                                {shift.locations?.name && (
                                  <div className="text-muted-foreground truncate">
                                    {shift.locations.name}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shifts List */}
          <Card>
            <CardHeader>
              <CardTitle>All Shifts</CardTitle>
              <CardDescription>Complete list of shifts for {format(selectedMonth, 'MMMM yyyy')}</CardDescription>
            </CardHeader>
            <CardContent>
              {shifts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No shifts scheduled this month</p>
              ) : (
                <div className="space-y-2">
                  {shifts
                    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))
                    .map((shift) => {
                      const sofiaStart = formatSofiaTime(shift.scheduled_start, 'yyyy-MM-dd HH:mm')
                      const startTime = formatSofiaTime(shift.scheduled_start, 'HH:mm')
                      const endTime = formatSofiaTime(shift.scheduled_end, 'HH:mm')
                      const displayDate = formatSofiaTime(shift.scheduled_start, 'EEEE, MMMM d, yyyy')
                      const hours = calculateHours(shift.scheduled_start, shift.scheduled_end)
                      
                      return (
                        <div
                          key={shift.id}
                          className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-accent"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{displayDate}</div>
                            <div className="text-sm text-muted-foreground">
                              {startTime} - {endTime} ({hours} hours)
                            </div>
                            {shift.locations?.name && (
                              <div className="text-sm text-muted-foreground">
                                Location: {shift.locations.name}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{hours}h</Badge>
                            <EditShiftDialog shift={shift} onSuccess={loadUserSchedule}>
                              <Button variant="outline" size="sm">
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </EditShiftDialog>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Loading schedule...</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

