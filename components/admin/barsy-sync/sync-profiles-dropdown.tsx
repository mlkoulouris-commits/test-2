'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SYNC_PROFILES, SyncProfile, SyncType } from '@/lib/types/barsy-sync';
import { estimateSyncTime } from '@/lib/utils/barsy-sync-utils';
import { ChevronDown, Zap, Database, Package, ShoppingCart, Layers, RefreshCw } from 'lucide-react';

interface SyncProfilesDropdownProps {
  onSelectProfile: (syncTypes: SyncType[], requiresDateRange: boolean) => void;
  disabled?: boolean;
  hasDateRange: boolean;
}

const getProfileIcon = (profile: SyncProfile) => {
  switch (profile) {
    case 'quick':
      return <Zap className="h-4 w-4" />;
    case 'masterData':
      return <Database className="h-4 w-4" />;
    case 'fullCatalog':
      return <Package className="h-4 w-4" />;
    case 'dailySales':
      return <ShoppingCart className="h-4 w-4" />;
    case 'inventory':
      return <Layers className="h-4 w-4" />;
    case 'complete':
      return <RefreshCw className="h-4 w-4" />;
  }
};

export const SyncProfilesDropdown = ({
  onSelectProfile,
  disabled,
  hasDateRange,
}: SyncProfilesDropdownProps) => {
  const handleSelect = (profileKey: SyncProfile) => {
    const profile = SYNC_PROFILES[profileKey];
    onSelectProfile(profile.syncTypes as SyncType[], profile.requiresDateRange);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" disabled={disabled} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Quick Sync Profiles
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Select a Sync Profile</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {(Object.keys(SYNC_PROFILES) as SyncProfile[]).map((profileKey) => {
          const profile = SYNC_PROFILES[profileKey];
          const estimate = estimateSyncTime(profile.syncTypes as SyncType[]);
          const needsDate = profile.requiresDateRange;
          const isDisabled = needsDate && !hasDateRange;

          return (
            <DropdownMenuItem
              key={profileKey}
              onClick={() => handleSelect(profileKey)}
              disabled={isDisabled}
              className="flex flex-col items-start gap-1 py-3"
            >
              <div className="flex items-center gap-2 w-full">
                {getProfileIcon(profileKey)}
                <span className="font-medium">{profile.name}</span>
                {needsDate && (
                  <span className="text-xs text-muted-foreground ml-auto">📅 Required</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground pl-6">
                {profile.description} • {estimate.description}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
