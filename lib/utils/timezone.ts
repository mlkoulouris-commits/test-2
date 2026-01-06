import { format, toZonedTime, fromZonedTime } from 'date-fns-tz'
import { enUS, bg } from 'date-fns/locale'
import { Locale } from 'date-fns'

const SOFIA_TZ = 'Europe/Sofia'

export const toSofiaTime = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return toZonedTime(dateObj, SOFIA_TZ)
}

export const fromSofiaTime = (date: Date): Date => {
  return fromZonedTime(date, SOFIA_TZ)
}

export const formatSofiaTime = (
  date: Date | string, 
  formatStr: string = 'yyyy-MM-dd HH:mm:ss',
  locale?: Locale
): string => {
  const sofiaDate = toSofiaTime(date)
  return format(sofiaDate, formatStr, { timeZone: SOFIA_TZ, locale })
}

export const getCurrentSofiaTime = (): Date => {
  return toSofiaTime(new Date())
}

export const getDateFnsLocale = (language: string): Locale => {
  return language === 'bg' ? bg : enUS
}

