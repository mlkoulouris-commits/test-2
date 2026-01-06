'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Clock, LogIn, LogOut, Calendar } from 'lucide-react'
import { clockIn, clockOut, getCurrentShift, getMyShiftHistory, getMySchedule } from '@/lib/actions/shifts'
import { formatSofiaTime } from '@/lib/utils/timezone'
import { format } from 'date-fns'

interface Location {
  id: number
  name: string
}

export const StaffScheduleView = ({ locations }: { locations: Location[] }) => {
  const [selectedLocation, setSelectedLocation] = useState<number | null>(
    locations.length === 1 ? locations[0].id : null
  )
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [shiftHistory, setShiftHistory] = useState<any[]>([])
  const [schedule, setSchedule] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
    const dataInterval = setInterval(loadData, 30000) // Refresh data every 30 seconds
    return () => clearInterval(dataInterval)
  }, [])

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000) // Update clock every second
    return () => clearInterval(clockInterval)
  }, [])

  const loadData = async () => {
    const [currentResult, historyResult, scheduleResult] = await Promise.all([
      getCurrentShift(),
      getMyShiftHistory(5),
      getMySchedule(),
    ])

    if (currentResult.data) setCurrentShift(currentResult.data)
    if (historyResult.data) setShiftHistory(historyResult.data)
    if (scheduleResult.data) setSchedule(scheduleResult.data)
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

  const today = new Date().toISOString().split('T')[0]
  const todaySchedule = schedule.filter(s => s.business_date === today)

  return (
    <div className="space-y-4 pb-6">
      {/* Current Time */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="text-center">
            <Clock className="h-12 w-12 mx-auto mb-2 text-primary" />
            <div className="text-3xl font-bold tabular-nums">{formatSofiaTime(currentTime, 'HH:mm:ss')}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {formatSofiaTime(currentTime, 'EEEE, MMMM d, yyyy')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Shift */}
      {currentShift ? (
        <Card className="border-green-500 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="bg-green-500">CLOCKED IN</Badge>
              {currentShift.locations?.name}
            </CardTitle>
            <CardDescription>
              Started at {formatSofiaTime(currentShift.clock_in, 'HH:mm')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-green-500">
                {calculateDuration(currentShift.clock_in)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Time worked</div>
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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Clock In</CardTitle>
            <CardDescription>Select your location to start your shift</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <>
                <Select 
                  value={selectedLocation?.toString()} 
                  onValueChange={(val) => setSelectedLocation(Number(val))}
                  disabled={isLoading}
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
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today's Schedule */}
      {todaySchedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaySchedule.map(shift => (
              <div key={shift.id} className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{shift.locations?.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {shift.scheduled_start} - {shift.scheduled_end}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Shifts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Shifts</CardTitle>
          <CardDescription>Your last 5 shifts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {shiftHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No shifts recorded yet</p>
          ) : (
            shiftHistory.map(shift => (
              <div key={shift.id} className="p-3 border rounded-lg space-y-1">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{shift.locations?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(shift.business_date), 'EEEE, MMM d, yyyy')}
                    </div>
                  </div>
                  {shift.clock_out && (
                    <Badge variant="outline">{calculateDuration(shift.clock_in, shift.clock_out)}</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatSofiaTime(shift.clock_in, 'HH:mm')} - {shift.clock_out ? formatSofiaTime(shift.clock_out, 'HH:mm') : 'In Progress'}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Upcoming Schedule */}
      {schedule.filter(s => s.business_date > today).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {schedule
              .filter(s => s.business_date > today)
              .slice(0, 7)
              .map(shift => (
                <div key={shift.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{shift.locations?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(shift.business_date), 'EEEE, MMM d')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {shift.scheduled_start} - {shift.scheduled_end}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

