'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  SyncCategory,
  SyncCategoryConfig,
  SyncTypeConfig,
  getSyncTypesByCategory,
} from '@/lib/types/barsy-sync';
import { cn } from '@/lib/utils';
import { Check, Clock, Loader2, Play, XCircle } from 'lucide-react';

interface SyncStatus {
  isRunning: boolean;
  lastResult?: {
    success: boolean;
    recordsSynced?: number;
    error?: string;
    durationMs?: number;
  };
}

interface SyncCategoryCardProps {
  category: SyncCategoryConfig;
  syncStatuses: Record<string, SyncStatus>;
  onSyncType: (syncType: string) => void;
  onSyncCategory: (category: SyncCategory) => void;
  disabled?: boolean;
  dateRangeRequired?: boolean;
}

const getCategoryColor = (color: string) => {
  const colors: Record<string, string> = {
    slate: 'border-slate-200 dark:border-slate-700',
    blue: 'border-blue-200 dark:border-blue-700',
    purple: 'border-purple-200 dark:border-purple-700',
    green: 'border-green-200 dark:border-green-700',
    amber: 'border-amber-200 dark:border-amber-700',
  };
  return colors[color] || colors.slate;
};

const getCategoryBadgeColor = (color: string) => {
  const colors: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  };
  return colors[color] || colors.slate;
};

const getDurationBadge = (duration: 'fast' | 'medium' | 'slow') => {
  switch (duration) {
    case 'fast':
      return <Badge variant="outline" className="text-xs">Fast</Badge>;
    case 'medium':
      return <Badge variant="outline" className="text-xs text-amber-600">Medium</Badge>;
    case 'slow':
      return <Badge variant="outline" className="text-xs text-orange-600">Slow</Badge>;
  }
};

export const SyncCategoryCard = ({
  category,
  syncStatuses,
  onSyncType,
  onSyncCategory,
  disabled = false,
  dateRangeRequired = false,
}: SyncCategoryCardProps) => {
  const syncTypes = getSyncTypesByCategory(category.id);

  const categoryHasDateDependency = syncTypes.some((t) => t.requiresDateRange);
  const categoryDisabled = disabled || (categoryHasDateDependency && !dateRangeRequired);

  // Count status summary
  const runningCount = syncTypes.filter((t) => syncStatuses[t.id]?.isRunning).length;
  const successCount = syncTypes.filter(
    (t) => syncStatuses[t.id]?.lastResult?.success === true
  ).length;
  const failedCount = syncTypes.filter(
    (t) => syncStatuses[t.id]?.lastResult?.success === false
  ).length;

  return (
    <Card className={cn('border-2', getCategoryColor(category.color))}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{category.icon}</span>
            <div>
              <CardTitle className="text-lg">{category.label}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {category.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {runningCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {runningCount}
              </Badge>
            )}
            {successCount > 0 && (
              <Badge variant="default" className="gap-1 bg-green-600">
                <Check className="h-3 w-3" />
                {successCount}
              </Badge>
            )}
            {failedCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {failedCount}
              </Badge>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={() => onSyncCategory(category.id)}
              disabled={categoryDisabled}
              className="ml-2"
            >
              <Play className="h-3 w-3 mr-1" />
              Sync All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {syncTypes.map((syncType) => (
            <SyncTypeButton
              key={syncType.id}
              syncType={syncType}
              status={syncStatuses[syncType.id]}
              onClick={() => onSyncType(syncType.id)}
              disabled={disabled || (syncType.requiresDateRange && !dateRangeRequired)}
              categoryColor={category.color}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

interface SyncTypeButtonProps {
  syncType: SyncTypeConfig;
  status?: SyncStatus;
  onClick: () => void;
  disabled?: boolean;
  categoryColor: string;
}

const SyncTypeButton = ({
  syncType,
  status,
  onClick,
  disabled,
  categoryColor,
}: SyncTypeButtonProps) => {
  const isRunning = status?.isRunning || false;
  const lastResult = status?.lastResult;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            disabled={disabled || isRunning}
            className={cn(
              'justify-start h-auto py-2 px-3 flex-col items-start gap-1 w-full',
              lastResult?.success === true && 'border-green-500 bg-green-50 dark:bg-green-950',
              lastResult?.success === false && 'border-red-500 bg-red-50 dark:bg-red-950'
            )}
          >
            <div className="flex items-center gap-2 w-full">
              {isRunning ? (
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              ) : lastResult?.success === true ? (
                <Check className="h-3 w-3 text-green-600 shrink-0" />
              ) : lastResult?.success === false ? (
                <XCircle className="h-3 w-3 text-red-600 shrink-0" />
              ) : (
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className="truncate text-xs font-medium">{syncType.label}</span>
            </div>
            <div className="flex items-center gap-1 w-full">
              {getDurationBadge(syncType.estimatedDuration)}
              {syncType.requiresDateRange && (
                <Badge variant="outline" className="text-[10px] px-1">📅</Badge>
              )}
              {lastResult?.recordsSynced !== undefined && lastResult.recordsSynced > 0 && (
                <Badge className={cn('text-[10px] ml-auto', getCategoryBadgeColor(categoryColor))}>
                  {lastResult.recordsSynced.toLocaleString()}
                </Badge>
              )}
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{syncType.label}</p>
            <p className="text-xs text-muted-foreground">{syncType.description}</p>
            {syncType.dependencies && syncType.dependencies.length > 0 && (
              <p className="text-xs">
                <span className="text-muted-foreground">Depends on: </span>
                {syncType.dependencies.join(', ')}
              </p>
            )}
            {lastResult && (
              <div className="pt-1 border-t">
                {lastResult.success ? (
                  <p className="text-xs text-green-600">
                    ✓ {lastResult.recordsSynced?.toLocaleString()} records in{' '}
                    {((lastResult.durationMs || 0) / 1000).toFixed(1)}s
                  </p>
                ) : (
                  <p className="text-xs text-red-600">✗ {lastResult.error}</p>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
