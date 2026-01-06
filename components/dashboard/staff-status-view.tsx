'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Clock, CheckCircle2, AlertCircle, Users } from 'lucide-react'
import { getLocationStaffStatus, getAllLocationStaffStatus } from '@/lib/actions/staff-status'
import { formatSofiaTime } from '@/lib/utils/timezone'

interface Location {
  id: number
  name: string
}

export const StaffStatusView = ({ locations }: { locations: Location[] }) => {
  const [selectedLocation, setSelectedLocation] = useState<string>(
    locations.length === 1 ? locations[0].id.toString() : 'all'
  )
  const [staffStatus, setStaffStatus] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    loadData()
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    const dataInterval = setInterval(loadData, 30000) // Refresh every 30 seconds
    
    return () => {
      clearInterval(clockInterval)
      clearInterval(dataInterval)
    }
  }, [selectedLocation])

  const loadData = async () => {
    setIsLoading(true)
    
    if (selectedLocation === 'all') {
      const result = await getAllLocationStaffStatus(locations.map(l => l.id))
      if (result.data) setStaffStatus(result.data)
    } else {
      const result = await getLocationStaffStatus(Number(selectedLocation))
      if (result.data) setStaffStatus(result.data)
    }
    
    setIsLoading(false)
  }

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      admin: 'destructive',
      manager: 'default',
      location_manager: 'secondary',
      staff_member: 'outline',
      shareholder: 'default',
    }
    const labels: Record<string, string> = {
      admin: 'Admin',
      manager: 'Manager',
      location_manager: 'Location Manager',
      staff_member: 'Staff Member',
      shareholder: 'Shareholder',
    }
    return <Badge variant={variants[role] || 'outline'}>{labels[role] || role}</Badge>
  }

  const clockedInCount = staffStatus.filter(s => s.current_shift).length
  const shouldBeWorkingCount = staffStatus.filter(s => !s.current_shift && s.is_within_schedule).length

  return (
    <div className="space-y-6">
      {/* Current Time */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatSofiaTime(currentTime, 'HH:mm:ss')}</div>
              <div className="text-sm text-muted-foreground">
                {formatSofiaTime(currentTime, 'EEEE, MMMM d, yyyy')}
              </div>
            </div>
            <Clock className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>

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
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.length > 1 && (
                  <SelectItem value="all">All Locations</SelectItem>
                )}
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staffStatus.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clocked In</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{clockedInCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Should Be Working</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{shouldBeWorkingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Members</CardTitle>
          <CardDescription>
            {staffStatus.length} staff member(s) - Updates every 30 seconds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffStatus.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {isLoading ? 'Loading...' : 'No staff found'}
                  </TableCell>
                </TableRow>
              ) : (
                staffStatus
                  .sort((a, b) => {
                    // Sort: clocked in first, then should be working, then others
                    if (a.current_shift && !b.current_shift) return -1
                    if (!a.current_shift && b.current_shift) return 1
                    if (!a.current_shift && !b.current_shift) {
                      if (a.is_within_schedule && !b.is_within_schedule) return -1
                      if (!a.is_within_schedule && b.is_within_schedule) return 1
                    }
                    return a.first_name.localeCompare(b.first_name)
                  })
                  .map((staff) => (
                    <TableRow key={staff.user_id}>
                      <TableCell className="font-medium">
                        {staff.first_name} {staff.last_name}
                      </TableCell>
                      <TableCell>{getRoleBadge(staff.role)}</TableCell>
                      <TableCell>
                        {staff.current_shift ? (
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-green-500 w-fit">
                              <Clock className="h-3 w-3 mr-1" />
                              Clocked In
                            </Badge>
                            {staff.is_within_schedule && (
                              <Badge variant="outline" className="w-fit text-green-600 border-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                On Schedule
                              </Badge>
                            )}
                            {!staff.is_within_schedule && staff.today_schedule?.length > 0 && (
                              <Badge variant="outline" className="w-fit text-orange-600 border-orange-600">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Outside Schedule
                              </Badge>
                            )}
                          </div>
                        ) : staff.is_within_schedule ? (
                          <Badge variant="outline" className="w-fit text-orange-600 border-orange-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Should be working
                          </Badge>
                        ) : staff.today_schedule?.length > 0 ? (
                          <Badge variant="outline" className="w-fit">
                            Has shift today
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">No shift</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {staff.current_shift ? (
                          <span className="text-sm">{staff.current_shift.locations?.name}</span>
                        ) : selectedLocation === 'all' && staff.locations ? (
                          <div className="flex flex-wrap gap-1">
                            {staff.locations.map((loc: any) => (
                              <Badge key={loc.id} variant="outline" className="text-xs">
                                {loc.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {staff.current_shift ? (
                          <span className="text-sm">
                            {formatSofiaTime(staff.current_shift.clock_in, 'HH:mm')}
                          </span>
                        ) : staff.today_schedule?.length > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {staff.today_schedule.map((sched: any, idx: number) => (
                              <div key={idx}>
                                {sched.scheduled_start} - {sched.scheduled_end}
                                {sched.locations?.name && selectedLocation === 'all' && (
                                  <span className="ml-1">@ {sched.locations.name}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

