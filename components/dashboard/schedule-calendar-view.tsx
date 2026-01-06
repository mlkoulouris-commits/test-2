'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { cn } from '@/lib/utils'

interface ScheduleCalendarViewProps {
  shifts: any[]
  skills: any[]
  onDateSelect: (date: Date) => void
  selectedDate?: Date
}

export const ScheduleCalendarView = ({ shifts, skills, onDateSelect, selectedDate }: ScheduleCalendarViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedSkill, setSelectedSkill] = useState<string>('all')

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getShiftsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    let dayShifts = shifts.filter(shift => shift.business_date === dateStr)

    if (selectedSkill !== 'all') {
      dayShifts = dayShifts.filter(shift => 
        shift.skill_required === parseInt(selectedSkill) ||
        shift.user_skills?.some((us: any) => us.skill_id === parseInt(selectedSkill))
      )
    }

    return dayShifts
  }

  const getSkillCounts = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayShifts = shifts.filter(shift => shift.business_date === dateStr)
    
    const skillCounts: Record<number, number> = {}
    dayShifts.forEach(shift => {
      shift.user_skills?.forEach((us: any) => {
        skillCounts[us.skill_id] = (skillCounts[us.skill_id] || 0) + 1
      })
    })

    return skillCounts
  }

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] text-center">
            <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
          </div>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
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

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-2">
            {/* Day Headers */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {days.map((day) => {
              const dayShifts = getShiftsForDate(day)
              const skillCounts = getSkillCounts(day)
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isSelected = selectedDate && format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')

              return (
                <button
                  key={day.toString()}
                  onClick={() => onDateSelect(day)}
                  className={cn(
                    "min-h-[100px] p-2 border rounded-lg text-left transition-colors",
                    "hover:bg-accent hover:border-primary",
                    !isCurrentMonth && "text-muted-foreground bg-muted/30",
                    isSelected && "border-primary bg-accent",
                    isToday(day) && "border-blue-500 bg-blue-50 dark:bg-blue-950"
                  )}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  
                  {dayShifts.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}
                      </div>
                      
                      {/* Show skill badges */}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(skillCounts).slice(0, 3).map(([skillId, count]) => {
                          const skill = skills.find(s => s.id === parseInt(skillId))
                          if (!skill) return null
                          return (
                            <Badge 
                              key={skillId}
                              variant="secondary"
                              className="text-[10px] px-1 py-0"
                              style={{ 
                                backgroundColor: skill.color + '20',
                                borderColor: skill.color,
                                color: skill.color
                              }}
                            >
                              {count}
                            </Badge>
                          )
                        })}
                        {Object.keys(skillCounts).length > 3 && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            +{Object.keys(skillCounts).length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}













