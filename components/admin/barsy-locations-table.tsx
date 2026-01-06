'use client';

import { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EditBarsyLocationDialog } from './edit-barsy-location-dialog';
import { deleteBarsyLocation } from '@/lib/actions/barsy-locations';
import { useRouter } from 'next/navigation';
import type { BarsyLocation } from '@/lib/actions/barsy-locations';

interface MementoLocation {
  id: number;
  name: string;
}

interface BarsyLocationsTableProps {
  locations: BarsyLocation[];
  mementoLocations: MementoLocation[];
}

export function BarsyLocationsTable({ locations, mementoLocations }: BarsyLocationsTableProps) {
  const router = useRouter();
  const [editingLocation, setEditingLocation] = useState<BarsyLocation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Barsy location? All synced data will be removed.')) {
      return;
    }

    setIsDeleting(true);
    const result = await deleteBarsyLocation(id);
    setIsDeleting(false);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Barsy Name</TableHead>
            <TableHead>Linked Memento Location</TableHead>
            <TableHead>Barsy URL</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No Barsy locations configured
              </TableCell>
            </TableRow>
          ) : (
            locations.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.name}</TableCell>
                <TableCell>
                  {(location as any).memento_location ? (
                    <span className="text-sm">{(location as any).memento_location.name}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not linked</span>
                  )}
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {location.barsy_url}
                  </code>
                </TableCell>
                <TableCell>{location.username}</TableCell>
                <TableCell>
                  <Badge variant={location.is_active ? 'default' : 'secondary'}>
                    {location.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setEditingLocation(location)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(location.id)}
                        disabled={isDeleting}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {editingLocation && (
        <EditBarsyLocationDialog
          location={editingLocation}
          mementoLocations={mementoLocations}
          open={!!editingLocation}
          onOpenChange={(open) => !open && setEditingLocation(null)}
        />
      )}
    </>
  );
}

