'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toggleLocationStatus } from '@/lib/actions/locations'
import { useRouter } from 'next/navigation'

interface Location {
  id: number
  name: string
  address: string | null
  phone: string | null
  is_active: boolean
  brands: { id: number; name: string } | null
  location_categories: { id: number; name: string } | null
}

interface LocationsTableProps {
  locations: Location[]
}

export const LocationsTable = ({ locations }: LocationsTableProps) => {
  const router = useRouter()

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const result = await toggleLocationStatus(id, !currentStatus)
    if (!result.error) {
      router.refresh()
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {locations.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              No locations found
            </TableCell>
          </TableRow>
        ) : (
          locations.map((location) => (
            <TableRow key={location.id}>
              <TableCell className="font-medium">{location.name}</TableCell>
              <TableCell>
                {location.brands ? (
                  <Badge variant="outline">{location.brands.name}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell>
                {location.location_categories ? (
                  <Badge variant="secondary">{location.location_categories.name}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                {location.address || '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {location.phone || '—'}
              </TableCell>
              <TableCell>
                <Badge variant={location.is_active ? 'default' : 'secondary'}>
                  {location.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleStatus(location.id, location.is_active)}
                >
                  {location.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

