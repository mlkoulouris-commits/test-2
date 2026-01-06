'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { assignUserLocations } from '@/lib/actions/user-locations'
import { MapPin } from 'lucide-react'

interface AssignLocationsDialogProps {
  userId: string
  userName: string
  currentLocationIds: number[]
  allLocations: Array<{ id: number; name: string }>
}

export const AssignLocationsDialog = ({
  userId,
  userName,
  currentLocationIds,
  allLocations,
}: AssignLocationsDialogProps) => {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedLocations, setSelectedLocations] = useState<number[]>(currentLocationIds)
  const router = useRouter()

  const handleLocationToggle = (locationId: number) => {
    setSelectedLocations(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    )
  }

  const handleSubmit = async () => {
    setError('')
    setIsLoading(true)

    const result = await assignUserLocations(userId, selectedLocations)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MapPin className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Locations</DialogTitle>
          <DialogDescription>
            Manage location access for {userName}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="grid gap-2">
            <Label>Locations</Label>
            <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-2">
              {allLocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No locations available</p>
              ) : (
                allLocations.map(location => (
                  <div key={location.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`location-${location.id}`}
                      checked={selectedLocations.includes(location.id)}
                      onCheckedChange={() => handleLocationToggle(location.id)}
                      disabled={isLoading}
                    />
                    <label
                      htmlFor={`location-${location.id}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {location.name}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

