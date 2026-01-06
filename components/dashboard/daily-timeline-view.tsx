'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, parse, subDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface DailyTimelineViewProps {
  date: Date
  shifts: any[]
  skills: any[]
}

export const DailyTimelineView = ({ date, shifts, skills }: DailyTimelineViewProps) => {
  const [selectedSkill, setSelectedSkill] = useState<string>('all')
  
  const dateStr = format(date, 'yyyy-MM-dd')
  const prevDateStr = format(subDays(date, 1), 'yyyy-MM-dd')
  
  // Get shifts from previous day and current day that fall within the timeline window
  let dayShifts = shifts.filter(shift => {
    return shift.business_date === prevDateStr || shift.business_date === dateStr
  })

  // Filter by skill if selected
  if (selectedSkill !== 'all') {
    dayShifts = dayShifts.filter(shift => 
      shift.user_skills?.some((us: any) => us.skill_id === parseInt(selectedSkill))
    )
  }

  // Group shifts by skill
  const shiftsBySkill: Record<string, any[]> = {}
  dayShifts.forEach(shift => {
    const userSkills = shift.user_skills || []
    if (userSkills.length === 0) {
      if (!shiftsBySkill['No Skill']) shiftsBySkill['No Skill'] = []
      shiftsBySkill['No Skill'].push(shift)
    } else {
      userSkills.forEach((us: any) => {
        const skillName = us.skills?.name || 'Unknown'
        if (!shiftsBySkill[skillName]) shiftsBySkill[skillName] = []
        shiftsBySkill[skillName].push(shift)
      })
    }
  })

  // Timeline shows from 16:00 (4 PM) previous day to 08:00 (8 AM) current day (16 hours)
  // This is -8 hours from midnight to +8 hours from midnight
  const timelineStartHour = 16 // 4 PM previous day
  const timelineEndHour = 8 // 8 AM current day
  const timelineRange = 16 * 60 // 16 hours in minutes

  const getTimePosition = (timeStr: string) => {
    // Extract time from timestamp (format: 2024-01-15T09:00:00)
    const time = timeStr.split('T')[1]?.substring(0, 5) || '00:00'
    const [hours, minutes] = time.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes
    
    // Position relative to timeline window (16:00 previous day to 08:00 current day)
    let positionInWindow: number
    if (hours >= timelineStartHour) {
      // Previous day (16:00 - 23:59)
      positionInWindow = (hours - timelineStartHour) * 60 + minutes
    } else {
      // Current day (00:00 - 08:00)
      positionInWindow = (8 * 60) + totalMinutes // 8 hours offset + current time
    }
    
    return (positionInWindow / timelineRange) * 100
  }

  const getShiftWidth = (startStr: string, endStr: string) => {
    const startTime = startStr.split('T')[1]?.substring(0, 5) || '00:00'
    const endTime = endStr.split('T')[1]?.substring(0, 5) || '00:00'
    
    const [startHours, startMinutes] = startTime.split(':').map(Number)
    const [endHours, endMinutes] = endTime.split(':').map(Number)
    
    let startTotal = startHours * 60 + startMinutes
    let endTotal = endHours * 60 + endMinutes
    
    // Handle overnight shifts
    if (endTotal <= startTotal) {
      endTotal += 1440 // Add 24 hours
    }
    
    const duration = endTotal - startTotal
    return (duration / timelineRange) * 100
  }

  const formatTime = (timeStr: string) => {
    const time = timeStr.split('T')[1]?.substring(0, 5) || '00:00'
    return time
  }

  // Generate hour markers from 16:00 to 08:00 (every 2 hours)
  const hourMarkers = Array.from({ length: 9 }, (_, i) => {
    const hour = 16 + (i * 2)
    return hour >= 24 ? hour - 24 : hour
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{format(date, 'EEEE, MMMM d, yyyy')}</h3>
          <p className="text-sm text-muted-foreground">
            {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''} (16:00 prev day - 08:00)
          </p>
        </div>

        <Select value={selectedSkill} onValueChange={setSelectedSkill}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by skill" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Skills</SelectItem>
            {skills.map((skill) => (
              <SelectItem key={skill.id} value={skill.id.toString()}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: skill.color }}
                  />
                  {skill.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dayShifts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">No shifts scheduled for this day</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Timeline View</CardTitle>
            <CardDescription>16-hour window: 16:00 previous day to 08:00 selected day</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Hour markers */}
            <div className="relative mb-4 border-b pb-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                {hourMarkers.map(hour => (
                  <div key={hour} className="text-center">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            </div>

            {/* By Skill Groups */}
            <div className="space-y-6">
              {Object.entries(shiftsBySkill).map(([skillName, skillShifts]) => {
                const skill = skills.find(s => s.name === skillName)
                
                return (
                  <div key={skillName} className="space-y-2">
                    <div className="flex items-center gap-2">
                      {skill && (
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: skill.color }}
                        />
                      )}
                      <h4 className="font-medium text-sm">{skillName}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {skillShifts.length}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      {skillShifts.map((shift, idx) => (
                        <div key={shift.id || idx} className="relative h-12 bg-muted/30 rounded-md">
                          <div
                            className="absolute h-full rounded-md flex items-center px-2 text-xs font-medium text-white overflow-hidden"
                            style={{
                              left: `${getTimePosition(shift.scheduled_start)}%`,
                              width: `${getShiftWidth(shift.scheduled_start, shift.scheduled_end)}%`,
                              backgroundColor: skill?.color || '#6b7280',
                              minWidth: '80px'
                            }}
                          >
                            <div className="truncate">
                              {shift.profiles?.first_name} {shift.profiles?.last_name}
                            </div>
                            <div className="ml-auto text-[10px] opacity-90">
                              {formatTime(shift.scheduled_start)} - {formatTime(shift.scheduled_end)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* All Shifts List */}
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-3">All Shifts</h4>
              <div className="space-y-2">
                {dayShifts.map((shift) => (
                  <div key={shift.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div>
                      <div className="font-medium text-sm">
                        {shift.profiles?.first_name} {shift.profiles?.last_name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {shift.user_skills?.map((us: any) => (
                          <Badge 
                            key={us.skill_id}
                            variant="secondary"
                            className="text-xs"
                            style={{ 
                              backgroundColor: us.skills?.color + '20',
                              borderColor: us.skills?.color,
                              color: us.skills?.color
                            }}
                          >
                            {us.skills?.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatTime(shift.scheduled_start)} - {formatTime(shift.scheduled_end)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

