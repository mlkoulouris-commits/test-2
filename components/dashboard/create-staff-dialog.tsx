'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { createStaffMember } from '@/lib/actions/staff-management'
import { useLanguage } from '@/lib/i18n/context'

interface CreateStaffDialogProps {
  locations: Array<{ id: number; name: string }>
}

export const CreateStaffDialog = ({ locations }: CreateStaffDialogProps) => {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedLocations, setSelectedLocations] = useState<number[]>([])
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      locationIds: selectedLocations,
    }

    const result = await createStaffMember(data)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      setOpen(false)
      setSelectedLocations([])
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
    if (!newOpen) {
      setError('')
      setSelectedLocations([])
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{t('staffManager.createStaff')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('staffManager.createNewStaff')}</DialogTitle>
            <DialogDescription>
              {t('staffManager.createStaffDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t('users.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                disabled={isLoading}
                placeholder="staff@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('users.password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={isLoading}
                placeholder={t('users.minimumChars')}
                minLength={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">{t('users.firstName')}</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">{t('users.lastName')}</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t('users.assignedLocations')}</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {locations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('users.noLocationsAvailable')}</p>
                ) : (
                  locations.map(location => (
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
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('banks.creating') : t('staffManager.createStaff')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
