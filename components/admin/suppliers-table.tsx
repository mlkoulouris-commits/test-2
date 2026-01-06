'use client'

import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { unlinkSupplier, createVendorFromSupplier } from '@/lib/actions/suppliers'
import { useState } from 'react'
import { AlertDialogConfirm } from '@/components/ui/alert-dialog-confirm'
import { toast } from 'sonner'

interface Supplier {
  id: number
  barsy_location_id: string
  supplier_id: number
  supplier_name: string
  bulstat: string | null
  vendor_id: number | null
  location_name?: string
  vendor_name?: string
  is_active: boolean
}

interface SuppliersTableProps {
  suppliers: Supplier[]
  loading?: boolean
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  onRefresh?: () => void
}

export const SuppliersTable = ({ 
  suppliers, 
  loading, 
  selectedIds,
  onSelectionChange,
  onRefresh 
}: SuppliersTableProps) => {
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null)
  const [creatingVendorId, setCreatingVendorId] = useState<number | null>(null)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(suppliers.map(s => s.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id])
    } else {
      onSelectionChange(selectedIds.filter(sid => sid !== id))
    }
  }

  const handleUnlink = async (id: number) => {
    setUnlinkingId(id)
    const result = await unlinkSupplier(id)
    setUnlinkingId(null)
    
    if (result.error) {
      toast.error('Failed to unlink supplier', {
        description: result.error,
      })
    } else {
      toast.success('Supplier unlinked', {
        description: 'Supplier has been unlinked from vendor successfully.',
      })
      if (onRefresh) {
        onRefresh()
      }
    }
  }

  const handleCreateVendor = async (id: number) => {
    setCreatingVendorId(id)
    const result = await createVendorFromSupplier(id)
    setCreatingVendorId(null)
    
    if (result.error) {
      toast.error('Failed to create vendor', {
        description: result.error,
      })
    } else {
      toast.success('Vendor created', {
        description: 'Vendor has been created and linked to supplier successfully.',
      })
      if (onRefresh) {
        onRefresh()
      }
    }
  }

  const allSelected = suppliers.length > 0 && selectedIds.length === suppliers.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < suppliers.length

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all"
              className={someSelected ? 'data-[state=checked]:bg-muted' : ''}
            />
          </TableHead>
          <TableHead>Supplier Name</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-center">Supplier ID</TableHead>
          <TableHead>Bulstat</TableHead>
          <TableHead>Linked Vendor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-center">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              Loading...
            </TableCell>
          </TableRow>
        ) : suppliers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              No suppliers found
            </TableCell>
          </TableRow>
        ) : (
          suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(supplier.id)}
                  onCheckedChange={(checked) => handleSelectOne(supplier.id, checked as boolean)}
                  aria-label={`Select ${supplier.supplier_name}`}
                />
              </TableCell>
              <TableCell className="font-medium">{supplier.supplier_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {supplier.location_name || '—'}
              </TableCell>
              <TableCell className="text-center text-muted-foreground">
                #{supplier.supplier_id}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {supplier.bulstat || '—'}
              </TableCell>
              <TableCell>
                {supplier.vendor_name ? (
                  <Link 
                    href={`/admin/vendors/${supplier.vendor_id}`}
                    className="text-primary hover:underline text-sm"
                  >
                    {supplier.vendor_name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-sm">Not linked</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                  {supplier.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                  {supplier.vendor_id ? (
                    <AlertDialogConfirm
                      title="Unlink Supplier"
                      description={`Are you sure you want to unlink "${supplier.supplier_name}" from its vendor?`}
                      onConfirm={() => handleUnlink(supplier.id)}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={unlinkingId === supplier.id}
                        >
                          {unlinkingId === supplier.id ? 'Unlinking...' : 'Unlink'}
                        </Button>
                      }
                    />
                  ) : (
                    <AlertDialogConfirm
                      title="Create Vendor"
                      description={`Create a new vendor master record from "${supplier.supplier_name}"?`}
                      onConfirm={() => handleCreateVendor(supplier.id)}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={creatingVendorId === supplier.id}
                        >
                          {creatingVendorId === supplier.id ? 'Creating...' : 'Create Vendor'}
                        </Button>
                      }
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}




