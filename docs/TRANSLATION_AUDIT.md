# Translation Audit Report

## Summary
- **Total translation keys in EN**: 422
- **Total translation keys in BG**: 422
- **Total unique translation keys used in code**: 460
- **Missing translations**: 4 keys

## Missing Translation Keys

The following translation keys are used in the code but are missing from both `en.json` and `bg.json`:

### 1. `common.approve`
**Used in**: `income-report-details-dialog.tsx`
```tsx
{t('common.approve')}
```
**Suggested addition**:
```json
"common.approve": "Approve"  // EN
"common.approve": "Одобри"   // BG
```

### 2. `common.close`
**Used in**: `income-report-details-dialog.tsx`
```tsx
{t('common.close')}
```
**Suggested addition**:
```json
"common.close": "Close"      // EN
"common.close": "Затвори"    // BG
```

### 3. `common.location`
**Used in**: Multiple components (income-report-table.tsx, income-report-details-dialog.tsx, income-report-mobile-card.tsx)
```tsx
{t('common.location')}
```
**Suggested addition**:
```json
"common.location": "Location"  // EN
"common.location": "Локация"   // BG
```

### 4. `common.reject`
**Used in**: `income-report-details-dialog.tsx`, `income-report-reject-dialog.tsx`
```tsx
{t('common.reject')}
```
**Suggested addition**:
```json
"common.reject": "Reject"      // EN
"common.reject": "Отхвърли"    // BG
```

## Translation Coverage
- **EN Coverage**: 99.1% (418/422 keys translated)
- **BG Coverage**: 100% (all EN keys have BG equivalents)
- **Missing**: 4 common action keys

## Recommendation
Add the 4 missing translation keys to both translation files in the `common` namespace for consistency with other common UI elements.

## Files to Update
1. `/lib/i18n/translations/en.json` - Add 4 keys
2. `/lib/i18n/translations/bg.json` - Add 4 keys

## Note
All other translation keys used in the codebase are properly defined. The missing keys are all in the `common` namespace and are used for standard UI actions (approve, reject, close) and labels (location).

