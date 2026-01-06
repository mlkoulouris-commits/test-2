import { toSofiaTime } from './timezone'
import { subDays, format } from 'date-fns'

/**
 * Calculate business date based on Sofia timezone.
 * Any time before 8am Sofia time counts as the previous day.
 */
export const getBusinessDate = (timestamp: Date | string): string => {
  const sofiaTime = toSofiaTime(timestamp)
  const hours = sofiaTime.getHours()
  
  // If before 8am, use previous day
  if (hours < 8) {
    const previousDay = subDays(sofiaTime, 1)
    return format(previousDay, 'yyyy-MM-dd')
  }
  
  return format(sofiaTime, 'yyyy-MM-dd')
}

/**
 * Get current business date in Sofia timezone
 */
export const getCurrentBusinessDate = (): string => {
  return getBusinessDate(new Date())
}

/**
 * Get formatted business date with day of week
 */
export const getFormattedBusinessDate = (timestamp: Date | string = new Date()): string => {
  const sofiaTime = toSofiaTime(timestamp)
  const hours = sofiaTime.getHours()
  
  // If before 8am, use previous day
  const dateToFormat = hours < 8 ? subDays(sofiaTime, 1) : sofiaTime
  
  return format(dateToFormat, 'EEEE, MMMM d')
}

/**
 * Check if a timestamp is within the "next day" period (after midnight but before 8am)
 */
export const isInNextDayPeriod = (timestamp: Date | string): boolean => {
  const sofiaTime = toSofiaTime(timestamp)
  const hours = sofiaTime.getHours()
  return hours >= 0 && hours < 8
}

