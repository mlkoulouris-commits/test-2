'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { assignStaffLocations } from '@/lib/actions/staff-management'
import { useLanguage } from '@/lib/i18n/context'
import { MapPin } from 'lucide-react'

interface AssignStaffLocationsDialogProps {
  userId: string
  userName: string
  currentLocationIds: number[]
  availableLocations: Array<{ id: number; name: string }>
}

export const AssignStaffLocationsDialog = ({
  userId,
  userName,
  currentLocationIds,
  availableLocations,
}: AssignStaffLocationsDialogProps) => {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedLocations, setSelectedLocations] = useState<number[]>(currentLocationIds)
  const router = useRouter()

  const handleSubmit = async () => {
    setError('')
    setIsLoading(true)

    const result = await assignStaffLocations(userId, selectedLocations)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      setOpen(false)
      router.refresh()
    }
  }

  const handleLocationToggle = (locationId: number) => {
    setSelectedLocations(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    )
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) {
      setSelectedLocations(currentLocationIds)
      setError('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <MapPin className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('users.assignLocations')}</DialogTitle>
          <DialogDescription>
            {t('staffManager.assignLocationsFor')} {userName}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-2">
            {availableLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('users.noLocationsAvailable')}</p>
            ) : (
              availableLocations.map(location => (
                <div key={location.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`assign-loc-${location.id}`}
                    checked={selectedLocations.includes(location.id)}
                    onCheckedChange={() => handleLocationToggle(location.id)}
                    disabled={isLoading}
                  />
                  <label
                    htmlFor={`assign-loc-${location.id}`}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {location.name}
                  </label>
                </div>
              ))
            )}
          </div>
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? t('banks.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
