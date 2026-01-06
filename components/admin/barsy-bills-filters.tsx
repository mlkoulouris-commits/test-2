'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { X, Check, ChevronsUpDown } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface Vendor {
  id: number
  name: string
}

interface Location {
  id: number
  name: string
}

interface BarsyBillsFiltersProps {
  vendors: Vendor[]
  locations: Location[]
  showApproved: boolean
  showUnlinkedOnly?: boolean
  showRejected?: boolean
}

export const BarsyBillsFilters = ({ vendors, locations, showApproved, showUnlinkedOnly, showRejected }: BarsyBillsFiltersProps) => {
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
    router.push(`/admin/barsy-bills?${params.toString()}`)
  }

  const handleToggleApproved = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set('showApproved', 'true')
    } else {
      params.delete('showApproved')
    }
    router.push(`/admin/barsy-bills?${params.toString()}`)
  }

  const handleToggleUnlinked = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set('showUnlinked', 'true')
    } else {
      params.delete('showUnlinked')
    }
    router.push(`/admin/barsy-bills?${params.toString()}`)
  }

  const handleToggleRejected = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set('showRejected', 'true')
    } else {
      params.delete('showRejected')
    }
    router.push(`/admin/barsy-bills?${params.toString()}`)
  }

  const handleClearFilters = () => {
    router.push('/admin/barsy-bills')
  }

  const selectedVendor = vendors.find(v => v.id.toString() === searchParams.get('vendor'))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={searchParams.get('location') || 'all'}
        onValueChange={(value) => handleFilterChange('location', value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-[160px]">
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

      <Popover open={openVendor} onOpenChange={setOpenVendor}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openVendor}
            className="w-[200px] justify-between"
          >
            {selectedVendor ? selectedVendor.name : "All Vendors"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search vendor..." />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>No vendor found.</CommandEmpty>
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
                  All Vendors
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
          id="show-approved"
          checked={showApproved}
          onCheckedChange={handleToggleApproved}
        />
        <Label htmlFor="show-approved" className="cursor-pointer text-sm">
          Show Approved
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="show-unlinked"
          checked={showUnlinkedOnly || false}
          onCheckedChange={handleToggleUnlinked}
        />
        <Label htmlFor="show-unlinked" className="cursor-pointer text-sm">
          Unlinked Only
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="show-rejected"
          checked={showRejected || false}
          onCheckedChange={handleToggleRejected}
        />
        <Label htmlFor="show-rejected" className="cursor-pointer text-sm">
          Show Rejected
        </Label>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={handleClearFilters}
        title="Clear filters"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
