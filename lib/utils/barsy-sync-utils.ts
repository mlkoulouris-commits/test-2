import { SyncType, SYNC_TYPES } from '@/lib/types/barsy-sync';

/**
 * Get estimated sync time for a batch
 * This is a pure utility function (no server action needed)
 */
export const estimateSyncTime = (syncTypes: SyncType[]): { minutes: number; description: string } => {
  let fastCount = 0;
  let mediumCount = 0;
  let slowCount = 0;

  for (const syncType of syncTypes) {
    const config = SYNC_TYPES[syncType];
    switch (config.estimatedDuration) {
      case 'fast':
        fastCount++;
        break;
      case 'medium':
        mediumCount++;
        break;
      case 'slow':
        slowCount++;
        break;
    }
  }

  // Rough estimates: fast = 5s, medium = 30s, slow = 2min
  const totalSeconds = fastCount * 5 + mediumCount * 30 + slowCount * 120;
  const minutes = Math.ceil(totalSeconds / 60);

  let description = '';
  if (slowCount > 0) {
    description = `${minutes} minutes (includes ${slowCount} slow sync${slowCount > 1 ? 's' : ''})`;
  } else if (mediumCount > 0) {
    description = `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    description = 'Less than a minute';
  }

  return { minutes, description };
};
