'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateBarsyLocation } from '@/lib/actions/barsy-locations';
import type { BarsyLocation } from '@/lib/actions/barsy-locations';
import { Checkbox } from '@/components/ui/checkbox';
import { LocationBankAccounts } from './location-bank-accounts';
import { Separator } from '@/components/ui/separator';

interface MementoLocation {
  id: number;
  name: string;
}

interface EditBarsyLocationDialogProps {
  location: BarsyLocation;
  mementoLocations: MementoLocation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditBarsyLocationDialog({
  location,
  mementoLocations,
  open,
  onOpenChange,
}: EditBarsyLocationDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: location.name,
    barsy_url: location.barsy_url,
    username: location.username,
    password: '',
    is_active: location.is_active,
    memento_location_id: location.memento_location_id,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const updateData: any = {
      name: formData.name,
      barsy_url: formData.barsy_url,
      username: formData.username,
      is_active: formData.is_active,
      memento_location_id: formData.memento_location_id,
    };

    // Only update password if provided
    if (formData.password) {
      updateData.password = formData.password;
    }

    const result = await updateBarsyLocation(location.id, updateData);

    setLoading(false);

    if (result.success) {
      onOpenChange(false);
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-4xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Barsy Location</DialogTitle>
            <DialogDescription>
              Update the Barsy API connection details for this location
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Barsy Location Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="memento_location">Link to Memento Location (Optional)</Label>
              <Select
                value={formData.memento_location_id?.toString() || 'none'}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    memento_location_id: value === 'none' ? null : parseInt(value),
                  })
                }
              >
                <SelectTrigger id="memento_location">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked</SelectItem>
                  {mementoLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="barsy_url">Barsy URL</Label>
              <Input
                id="barsy_url"
                type="url"
                placeholder="https://example.barsy.bg"
                value={formData.barsy_url}
                onChange={(e) => setFormData({ ...formData, barsy_url: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Leave blank to keep current password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked as boolean })
                }
              />
              <Label htmlFor="is_active" className="font-normal cursor-pointer">
                Active
              </Label>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Bank Accounts Section */}
          {location.memento_location_id && (
            <div className="py-4">
              <LocationBankAccounts
                locationId={location.memento_location_id}
                locationName={location.name}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

