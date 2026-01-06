'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BankAccountSelectItem } from '@/components/admin/bank-account-select-item'
import { sortBankAccounts } from '@/lib/utils/sort-bank-accounts'
import { BankAccount } from '@/lib/actions/bank-accounts'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { X, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { DateRange } from 'react-day-picker'

interface Location {
  id: number
  name: string
}

interface BillPaymentsFiltersProps {
  locations: Location[]
  bankAccounts: BankAccount[]
}

export const BillPaymentsFilters = ({ locations, bankAccounts }: BillPaymentsFiltersProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [openDatePicker, setOpenDatePicker] = useState(false)
  
  const currentMethod = searchParams.get('method') || ''
  const currentLocation = searchParams.get('location') || ''
  const currentBankAccount = searchParams.get('bankAccount') || ''
  
  // Sync URL params with local state
  useEffect(() => {
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')
    
    if (startParam || endParam) {
      setDateRange({
        from: startParam ? new Date(startParam) : undefined,
        to: endParam ? new Date(endParam) : undefined,
      })
    } else {
      setDateRange(undefined)
    }
  }, [searchParams])

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    
    params.delete('page')
    router.push(`/admin/bill-payments?${params.toString()}`)
  }

  const clearFilters = () => {
    setDateRange(undefined)
    router.push('/admin/bill-payments')
  }

  const hasActiveFilters = dateRange?.from || dateRange?.to || currentMethod || currentLocation || currentBankAccount

  const paymentMethods = [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cash', label: 'Cash' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filters</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
      
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Date Range</Label>
          <Popover open={openDatePicker} onOpenChange={setOpenDatePicker}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
                    </>
                  ) : (
                    format(dateRange.from, 'LLL dd, y')
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range)
                  updateFilters({
                    startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : null,
                    endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : null,
                  })
                }}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="method">Payment Method</Label>
          <Select
            value={currentMethod}
            onValueChange={(value) => updateFilters({ method: value === 'all' ? null : value })}
          >
            <SelectTrigger id="method">
              <SelectValue placeholder="All Methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {paymentMethods.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Select
            value={currentLocation}
            onValueChange={(value) => updateFilters({ location: value === 'all' ? null : value })}
          >
            <SelectTrigger id="location">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id.toString()}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bankAccount">Bank Account</Label>
          <Select
            value={currentBankAccount}
            onValueChange={(value) => updateFilters({ bankAccount: value === 'all' ? null : value })}
          >
            <SelectTrigger id="bankAccount">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {sortBankAccounts(bankAccounts).map((account) => (
                <SelectItem key={account.id} value={account.id.toString()}>
                  <BankAccountSelectItem account={account} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

