'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Calendar, Users, Clock, LogIn, LogOut, CalendarDays, BarChart3, CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLocationStaff, getLocationShifts, clockIn, clockOut, getCurrentShift } from '@/lib/actions/shifts'
import { getScheduleWithSkills, getAllSkills } from '@/lib/actions/skills'
import { formatSofiaTime } from '@/lib/utils/timezone'
import { CreateShiftDialog } from './create-shift-dialog'
import { CreateBulkScheduleDialog } from './create-bulk-schedule-dialog'
import { getStaffForLocation } from '@/lib/actions/bulk-schedule'
import { EditShiftDialog } from './edit-shift-dialog'
import { ScheduleCalendarView } from './schedule-calendar-view'
import { DailyTimelineView } from './daily-timeline-view'
import { UserScheduleView } from './user-schedule-view'
import { addDays, subDays, startOfMonth, endOfMonth, format } from 'date-fns'

interface Location {
  id: number
  name: string
}

export const ManagerScheduleView = ({ locations }: { locations: Location[] }) => {
  const [selectedLocation, setSelectedLocation] = useState<number | null>(
    locations.length === 1 ? locations[0].id : null
  )
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [staff, setStaff] = useState<any[]>([])
  const [locationStaff, setLocationStaff] = useState<any[]>([])
  const [shifts, setShifts] = useState<any>({ scheduled: [], actual: [] })
  const [calendarShifts, setCalendarShifts] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSkills()
  }, [])

  useEffect(() => {
    if (selectedLocation) {
      loadData()
      loadStaff()
      loadCalendarData()
    }
    loadCurrentShift()
  }, [selectedLocation, selectedDate])

  const loadSkills = async () => {
    const result = await getAllSkills()
    if (result.data) setSkills(result.data)
  }

  const loadCalendarData = async () => {
    if (!selectedLocation) return

    const monthStart = startOfMonth(selectedDate)
    const monthEnd = endOfMonth(selectedDate)

    const result = await getScheduleWithSkills(
      selectedLocation,
      format(monthStart, 'yyyy-MM-dd'),
      format(monthEnd, 'yyyy-MM-dd')
    )

    if (result.data) setCalendarShifts(result.data)
  }

  const loadData = async () => {
    if (!selectedLocation) return

    setIsLoading(true)
    const [staffResult, shiftsResult] = await Promise.all([
      getLocationStaff(selectedLocation),
      getLocationShifts(selectedLocation, format(selectedDate, 'yyyy-MM-dd')),
    ])

    if (staffResult.data) setStaff(staffResult.data)
    if (shiftsResult.data) setShifts(shiftsResult.data)
    setIsLoading(false)
  }

  const loadStaff = async () => {
    if (!selectedLocation) return
    const result = await getStaffForLocation(selectedLocation)
    if (result.data) setLocationStaff(result.data)
  }

  const loadCurrentShift = async () => {
    const result = await getCurrentShift()
    if (result.data) setCurrentShift(result.data)
  }

  const handleClockIn = async () => {
    if (!selectedLocation) {
      setError('Please select a location')
      return
    }

    setError('')
    setIsLoading(true)

    const result = await clockIn(selectedLocation)

    if (result.error) {
      setError(result.error)
    } else {
      await loadCurrentShift()
      await loadData()
    }

    setIsLoading(false)
  }

  const handleClockOut = async () => {
    if (!currentShift) return

    setError('')
    setIsLoading(true)

    const result = await clockOut(currentShift.id)

    if (result.error) {
      setError(result.error)
    } else {
      setCurrentShift(null)
      await loadData()
    }

    setIsLoading(false)
  }

  const calculateDuration = (start: string, end?: string) => {
    const startTime = new Date(start)
    const endTime = end ? new Date(end) : new Date()
    const diff = endTime.getTime() - startTime.getTime()
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    return `${hours}h ${minutes}m`
  }

  const changeDate = (days: number) => {
    const newDate = days > 0 ? addDays(selectedDate, days) : subDays(selectedDate, Math.abs(days))
    setSelectedDate(newDate)
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Location Selector */}
      <Card>
        <CardContent className="pt-6">
          {locations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">
                No locations assigned to your account
              </p>
              <p className="text-sm text-muted-foreground">
                Please contact your administrator to assign locations to your account.
              </p>
            </div>
          ) : (
            <Select 
              value={selectedLocation?.toString()} 
              onValueChange={(val) => setSelectedLocation(Number(val))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedLocation && (
        <>
          {/* Date Selector & Bulk Schedule Button */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Card className="flex-1">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => changeDate(-1)}>
                    ←
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        weekStartsOn={1}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" onClick={() => changeDate(1)}>
                    →
                  </Button>
                </div>
                <div className="text-center mt-2 text-sm text-muted-foreground">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </div>
              </CardContent>
            </Card>
            <div className="flex items-center justify-center sm:justify-start">
              <CreateBulkScheduleDialog
                locationId={selectedLocation}
                staff={locationStaff}
                onSuccess={() => {
                  loadData()
                  loadCalendarData()
                }}
              />
            </div>
          </div>

          <Tabs defaultValue="calendar" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="calendar">
                <CalendarDays className="h-4 w-4 mr-1" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <BarChart3 className="h-4 w-4 mr-1" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="user">
                <Users className="h-4 w-4 mr-1" />
                User
              </TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="actual">Actual Time</TabsTrigger>
              <TabsTrigger value="clock">Clock In/Out</TabsTrigger>
              <TabsTrigger value="staff">Staff</TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Schedule Calendar</CardTitle>
                      <CardDescription>View and manage shifts across the month</CardDescription>
                    </div>
                    <CreateShiftDialog 
                      locationId={selectedLocation}
                      staff={staff}
                      onSuccess={() => {
                        loadData()
                        loadCalendarData()
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <ScheduleCalendarView
                    shifts={calendarShifts}
                    skills={skills}
                    onDateSelect={(date) => setSelectedDate(date)}
                    selectedDate={selectedDate}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Daily Timeline</CardTitle>
                      <CardDescription>View shifts by skill for {format(selectedDate, 'EEEE, MMMM d')}</CardDescription>
                    </div>
                    <CreateShiftDialog 
                      locationId={selectedLocation}
                      staff={staff}
                      onSuccess={() => {
                        loadData()
                        loadCalendarData()
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <DailyTimelineView
                    date={selectedDate}
                    shifts={calendarShifts}
                    skills={skills}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="user" className="space-y-4">
              <UserScheduleView
                locationId={selectedLocation}
                staff={staff}
              />
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Scheduled Shifts</CardTitle>
                      <CardDescription>{shifts.scheduled?.length || 0} shift(s) scheduled</CardDescription>
                    </div>
                    <CreateShiftDialog 
                      locationId={selectedLocation}
                      staff={staff}
                      onSuccess={loadData}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {shifts.scheduled?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No shifts scheduled for this day
                    </p>
                  ) : (
                    shifts.scheduled?.map((shift: any) => (
                      <div key={shift.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">
                              {shift.profiles?.first_name} {shift.profiles?.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {shift.scheduled_start} - {shift.scheduled_end}
                            </div>
                          </div>
                          <EditShiftDialog shift={shift} onSuccess={loadData} />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actual" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Actual Time Worked</CardTitle>
                  <CardDescription>{shifts.actual?.length || 0} clock-in(s) recorded</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {shifts.actual?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No clock-ins recorded for this day
                    </p>
                  ) : (
                    shifts.actual?.map((shift: any) => (
                      <div key={shift.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">
                              {shift.profiles?.first_name} {shift.profiles?.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatSofiaTime(shift.clock_in, 'HH:mm')} - {' '}
                              {shift.clock_out ? formatSofiaTime(shift.clock_out, 'HH:mm') : (
                                <Badge className="bg-green-500">IN PROGRESS</Badge>
                              )}
                            </div>
                            {shift.notes && (
                              <div className="text-xs text-muted-foreground mt-1">{shift.notes}</div>
                            )}
                          </div>
                          {shift.clock_out && (
                            <Badge variant="outline">
                              {calculateDuration(shift.clock_in, shift.clock_out)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="clock" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Manager Clock In/Out</CardTitle>
                  <CardDescription>Clock in/out for your own shift</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentShift ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-green-500">CLOCKED IN</Badge>
                          <span className="font-medium">{currentShift.locations?.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Started at {formatSofiaTime(currentShift.clock_in, 'HH:mm')}
                        </p>
                      </div>
                      <Button 
                        className="w-full" 
                        size="lg" 
                        variant="destructive"
                        onClick={handleClockOut}
                        disabled={isLoading}
                      >
                        <LogOut className="mr-2 h-5 w-5" />
                        Clock Out
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        You are not currently clocked in
                      </p>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button 
                        className="w-full" 
                        size="lg"
                        onClick={handleClockIn}
                        disabled={!selectedLocation || isLoading}
                      >
                        <LogIn className="mr-2 h-5 w-5" />
                        Clock In
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="staff" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Location Staff</CardTitle>
                  <CardDescription>{staff.length} staff member(s)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {staff.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No staff assigned to this location
                    </p>
                  ) : (
                    staff.map((member: any) => (
                      <div key={member.user_id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">
                              {member.profiles?.first_name} {member.profiles?.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground capitalize">
                              {member.profiles?.role?.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

