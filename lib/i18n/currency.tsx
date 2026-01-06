'use client'

import { useLanguage } from './context'

export const useCurrency = () => {
  const { t } = useLanguage()

  const getCurrencySymbol = (currency: string): string => {
    const currencyLower = currency.toLowerCase()
    return t(`currency.${currencyLower}`)
  }

  const formatAmount = (amount: number, currency: string = 'BGN'): string => {
    const formattedNumber = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
    
    const symbol = getCurrencySymbol(currency)
    return `${formattedNumber} ${symbol}`
  }

  return { getCurrencySymbol, formatAmount }
}


