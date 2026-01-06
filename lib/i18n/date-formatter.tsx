'use client'

import { useLanguage } from './context'
import { formatSofiaTime, getDateFnsLocale } from '@/lib/utils/timezone'

export const useDateFormatter = () => {
  const { language } = useLanguage()

  const formatDate = (
    date: Date | string, 
    formatStr: string = 'MMM d, yyyy'
  ): string => {
    const locale = getDateFnsLocale(language)
    return formatSofiaTime(date, formatStr, locale)
  }

  const formatDateTime = (
    date: Date | string, 
    formatStr: string = 'MMM d, yyyy HH:mm'
  ): string => {
    const locale = getDateFnsLocale(language)
    return formatSofiaTime(date, formatStr, locale)
  }

  const formatFullDate = (
    date: Date | string
  ): string => {
    const locale = getDateFnsLocale(language)
    return formatSofiaTime(date, 'PPPP', locale)
  }

  return {
    formatDate,
    formatDateTime,
    formatFullDate,
  }
}


