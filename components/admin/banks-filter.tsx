'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { X } from 'lucide-react'
import { sortLocationsWithHQFirst } from '@/lib/utils'

interface Location {
  id: string
  name: string
}

interface BanksFilterProps {
  locations: Location[]
  showPos?: boolean
}

export const BanksFilter = ({ locations, showPos = false }: BanksFilterProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const currentLocation = searchParams.get('location') || 'all'
  const currentType = searchParams.get('type') || 'all'

  const sortedLocations = sortLocationsWithHQFirst(locations)

  const updateFilter = (key: 'location' | 'type', value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    
    router.push(`/admin/banks?${params.toString()}`)
  }

  const toggleShowPos = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (checked) {
      params.set('showPos', 'true')
    } else {
      params.delete('showPos')
    }
    
    router.push(`/admin/banks?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push('/admin/banks')
  }

  const hasActiveFilters = currentLocation !== 'all' || currentType !== 'all' || showPos

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 border rounded-lg bg-muted/50">
      <Select value={currentLocation} onValueChange={(val) => updateFilter('location', val)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All Locations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Locations</SelectItem>
          {sortedLocations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentType} onValueChange={(val) => updateFilter('type', val)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="bank">🏦 Bank Accounts</SelectItem>
          <SelectItem value="cash">💵 Cash Accounts</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center space-x-2">
        <Switch 
          id="showPos" 
          checked={showPos}
          onCheckedChange={toggleShowPos}
        />
        <Label 
          htmlFor="showPos" 
          className="text-sm font-medium cursor-pointer"
        >
          Show POS
        </Label>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" onClick={clearFilters} size="sm" className="ml-auto">
          <X className="h-4 w-4 mr-1" />
          Clear Filters
        </Button>
      )}
    </div>
  )
}

