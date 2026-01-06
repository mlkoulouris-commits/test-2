'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { createBarsyLocation } from '@/lib/actions/barsy-locations';

interface MementoLocation {
  id: number;
  name: string;
}

interface CreateBarsyLocationDialogProps {
  mementoLocations: MementoLocation[];
}

export function CreateBarsyLocationDialog({ mementoLocations }: CreateBarsyLocationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    barsy_url: '',
    username: '',
    password: '',
    memento_location_id: null as number | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await createBarsyLocation(formData);

    setLoading(false);

    if (result.success) {
      setFormData({ name: '', barsy_url: '', username: '', password: '', memento_location_id: null });
      setOpen(false);
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Barsy Location
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Barsy Location</DialogTitle>
            <DialogDescription>
              Configure a new Barsy API connection for syncing sales data
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Barsy Location Name</Label>
              <Input
                id="name"
                placeholder="e.g., Memento - Vitosha"
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
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

