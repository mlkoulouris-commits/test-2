'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Search, X, Check, ChevronsUpDown } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/context'

interface Vendor {
  id: number
  name: string
}

interface Location {
  id: string
  name: string
}

interface BillsFiltersProps {
  vendors: Vendor[]
  locations: Location[]
}

export const BillsFilters = ({ vendors, locations }: BillsFiltersProps) => {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [openVendor, setOpenVendor] = useState(false)

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/admin/bills?${params.toString()}`)
  }

  const handleShowVoidedChange = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set('showVoided', 'true')
    } else {
      params.delete('showVoided')
    }
    router.push(`/admin/bills?${params.toString()}`)
  }

  const handleClearFilters = () => {
    router.push('/admin/bills')
  }

  const selectedVendor = vendors.find(v => v.id.toString() === searchParams.get('vendor'))

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('billsFilters.searchBills')}
          className="pl-9"
        />
      </div>

      <Select
        value={searchParams.get('location') || 'all'}
        onValueChange={(value) => handleFilterChange('location', value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('billsFilters.allLocations')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('billsFilters.allLocations')}</SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('status') || 'all'}
        onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('billStatus.allStatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('billStatus.allStatus')}</SelectItem>
          <SelectItem value="approved">{t('billStatus.approved')}</SelectItem>
          <SelectItem value="partially_paid">{t('billStatus.partiallyPaid')}</SelectItem>
          <SelectItem value="paid">{t('billStatus.paid')}</SelectItem>
          <SelectItem value="outstanding">{t('billStatus.outstanding')}</SelectItem>
          <SelectItem value="overdue">{t('billStatus.overdue')}</SelectItem>
          <SelectItem value="due_this_month">{t('billStatus.dueThisMonth')}</SelectItem>
        </SelectContent>
      </Select>

      <Popover open={openVendor} onOpenChange={setOpenVendor}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openVendor}
            className="w-[200px] justify-between"
          >
            {selectedVendor ? selectedVendor.name : t('billsFilters.allVendors')}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('billsFilters.searchVendor')} />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>{t('billsFilters.noVendor')}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all"
                  onSelect={() => {
                    handleFilterChange('vendor', '')
                    setOpenVendor(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !searchParams.get('vendor') ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {t('billsFilters.allVendors')}
                </CommandItem>
                {vendors.map((vendor) => (
                  <CommandItem
                    key={vendor.id}
                    value={vendor.name}
                    onSelect={() => {
                      handleFilterChange('vendor', vendor.id.toString())
                      setOpenVendor(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        searchParams.get('vendor') === vendor.id.toString()
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {vendor.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="flex items-center space-x-2">
        <Switch
          id="showVoided"
          checked={searchParams.get('showVoided') === 'true'}
          onCheckedChange={handleShowVoidedChange}
        />
        <Label
          htmlFor="showVoided"
          className="text-sm font-normal cursor-pointer"
        >
          {t('billsFilters.showVoided')}
        </Label>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={handleClearFilters}
        title={t('billsFilters.clearFilters')}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

