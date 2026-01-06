'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { searchVendors, linkSuppliersToVendor } from '@/lib/actions/suppliers'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LinkSuppliersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierIds: number[]
  supplierNames: string[]
  onSuccess: () => void
}

interface Vendor {
  id: number
  name: string
  contact_name: string | null
  contact_email: string | null
}

export const LinkSuppliersDialog = ({
  open,
  onOpenChange,
  supplierIds,
  supplierNames,
  onSuccess,
}: LinkSuppliersDialogProps) => {
  const [search, setSearch] = useState('')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadVendors = async () => {
      setLoading(true)
      const result = await searchVendors(search)
      if (result.data) {
        setVendors(result.data)
      }
      setLoading(false)
    }

    // Load vendors when dialog opens
    if (open) {
      loadVendors()
    }
  }, [open])

  useEffect(() => {
    const searchDebounce = setTimeout(async () => {
      if (open) {
        setLoading(true)
        const result = await searchVendors(search)
        if (result.data) {
          setVendors(result.data)
        }
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(searchDebounce)
  }, [search, open])

  const handleLink = async () => {
    if (!selectedVendor) return

    setSaving(true)
    setError('')

    const result = await linkSuppliersToVendor(supplierIds, selectedVendor.id)

    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      setSaving(false)
      onOpenChange(false)
      onSuccess()
      setSearch('')
      setSelectedVendor(null)
      setVendors([])
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSearch('')
      setSelectedVendor(null)
      setVendors([])
      setError('')
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Link Supplier{supplierIds.length > 1 ? 's' : ''} to Vendor</DialogTitle>
          <DialogDescription>
            Link {supplierIds.length} supplier{supplierIds.length > 1 ? 's' : ''} to an existing vendor master record
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Selected Suppliers</Label>
            <div className="rounded-md border p-3 text-sm">
              {supplierNames.map((name, idx) => (
                <div key={idx} className="py-1">
                  • {name}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Search Vendor</Label>
            <div className="relative">
              <Input
                placeholder="Search by vendor name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center p-4 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : vendors.length === 0 ? (
              <div className="p-4 border rounded-md text-center text-sm text-muted-foreground">
                No vendors found.
              </div>
            ) : (
              <div className="border rounded-md max-h-[250px] overflow-y-auto">
                {vendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    onClick={() => setSelectedVendor(vendor)}
                    className={cn(
                      'flex items-start gap-2 p-3 cursor-pointer hover:bg-muted transition-colors border-b last:border-b-0',
                      selectedVendor?.id === vendor.id && 'bg-muted'
                    )}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 mt-0.5 flex-shrink-0',
                        selectedVendor?.id === vendor.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{vendor.name}</div>
                      {vendor.contact_name && (
                        <div className="text-xs text-muted-foreground">
                          Contact: {vendor.contact_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedVendor && (
            <div className="rounded-md bg-primary/10 p-3">
              <div className="text-sm font-medium">Selected Vendor:</div>
              <div className="text-sm">{selectedVendor.name}</div>
              {selectedVendor.contact_name && (
                <div className="text-xs text-muted-foreground">
                  Contact: {selectedVendor.contact_name}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedVendor || saving}
          >
            {saving ? 'Linking...' : 'Link to Vendor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

