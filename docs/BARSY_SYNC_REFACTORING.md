# Barsy Sync Page Refactoring Guide

## Overview
The `app/admin/barsy-sync/page.tsx` file (886 lines) has been partially refactored to use reusable components and hooks.

## New Reusable Components Created

### 1. `components/admin/barsy-sync-button.tsx`
Standardized button for all sync operations with loading states.

**Usage:**
```tsx
<BarsySyncButton
  label="Sync Orders"
  onClick={handleSyncOrders}
  loading={loading}
  disabled={!selectedLocation}
/>
```

### 2. `components/admin/barsy-date-range-picker.tsx`
Date range picker for sync operations that require dates.

**Usage:**
```tsx
<BarsyDateRangePicker
  dateFrom={dateFrom}
  dateTo={dateTo}
  onDateFromChange={setDateFrom}
  onDateToChange={setDateTo}
/>
```

### 3. `components/admin/barsy-sync-history-table.tsx`
Table component for displaying sync history.

**Usage:**
```tsx
<BarsySyncHistoryTable syncHistory={syncHistory} />
```

### 4. `hooks/use-barsy-sync.ts`
Custom hook that standardizes the sync operation pattern, reducing repetitive code.

**Usage:**
```tsx
const { loading, message, handleSync } = useBarsySync({
  selectedLocation,
  dateFrom,
  dateTo,
  onSuccess: () => loadSyncHistory(selectedLocation!),
  successMessage: (result, dateFrom, dateTo) => 
    `Successfully synced ${result.recordsSynced} orders from ${format(dateFrom!, 'MMM d')} to ${format(dateTo!, 'MMM d')}`,
  loadingMessage: 'Syncing orders...',
})

// Use it
const handleSyncOrders = () => handleSync(syncBarsyOrders, true)
```

## Refactoring Pattern

### Before (Repetitive Pattern - 50+ lines per sync function):
```tsx
const handleSyncOrders = async () => {
  if (!selectedLocation || !dateFrom || !dateTo) return;
  
  setLoading(true);
  setMessage(null);
  setLoadingMessage('Syncing...');
  
  try {
    const dateFromStr = format(dateFrom, 'yyyy-MM-dd');
    const dateToStr = format(dateTo, 'yyyy-MM-dd');
    const result = await syncBarsyOrders(selectedLocation, dateFromStr, dateToStr);
    
    if (result.success) {
      setMessage({
        type: 'success',
        text: `Successfully synced ${result.recordsSynced} orders`,
      });
      loadSyncHistory(selectedLocation);
    } else {
      setMessage({
        type: 'error',
        text: result.error || 'Failed to sync',
      });
    }
  } catch (error) {
    setMessage({
      type: 'error',
      text: 'An unexpected error occurred',
    });
  } finally {
    setLoading(false);
    setLoadingMessage('');
  }
};
```

### After (Using Hook - 5 lines):
```tsx
const { handleSync } = useBarsySync({
  selectedLocation,
  dateFrom,
  dateTo,
  onSuccess: () => loadSyncHistory(selectedLocation!),
})

const handleSyncOrders = () => handleSync(syncBarsyOrders, true)
```

## Estimated Line Reduction
- **Original**: 886 lines
- **After full refactoring**: ~300-400 lines (55-60% reduction)
- **Repetitive sync handlers**: Reduced from 50+ lines each to 1-2 lines

## Benefits
1. **DRY Principle**: Eliminated repetitive sync handler code
2. **Consistency**: All sync operations follow the same pattern
3. **Maintainability**: Changes to sync logic only need to be made in one place
4. **Reusability**: Components and hooks can be used in other sync pages
5. **Type Safety**: Proper TypeScript types throughout

## Next Steps
To complete the refactoring:
1. Update `app/admin/barsy-sync/page.tsx` to use the new components and hooks
2. Replace all individual sync handlers with the `useBarsySync` hook
3. Group related sync operations into cards
4. Test all sync operations to ensure functionality is preserved

## Implementation Example
See the created components for full implementation details. The pattern can be applied to all 15+ sync handlers in the original file.

