# Internationalization (i18n) System

This app supports English (EN) and Bulgarian (BG) languages with localStorage persistence.

## How to Use Translations

### In Client Components

```tsx
'use client'

import { useLanguage } from '@/lib/i18n/context'

export const MyComponent = () => {
  const { t, language, setLanguage } = useLanguage()
  
  return (
    <div>
      <h1>{t('banks.title')}</h1>
      <p>{t('banks.description')}</p>
      <button onClick={() => setLanguage('bg')}>
        Switch to Bulgarian
      </button>
    </div>
  )
}
```

### Currency Formatting

For amounts with currency symbols that change based on language (BGN → лв. in Bulgarian):

```tsx
'use client'

import { useCurrency } from '@/lib/i18n/currency'

export const MyComponent = () => {
  const { formatAmount, getCurrencySymbol } = useCurrency()
  
  return (
    <div>
      <p>{formatAmount(1234.56, 'BGN')}</p>
      {/* In EN: "1,234.56 BGN" */}
      {/* In BG: "1,234.56 лв." */}
      
      <p>{getCurrencySymbol('BGN')}</p>
      {/* In EN: "BGN" */}
      {/* In BG: "лв." */}
    </div>
  )
}
```

### Date Formatting

For dates that should be formatted according to the selected language:

```tsx
'use client'

import { useDateFormatter } from '@/lib/i18n/date-formatter'

export const MyComponent = () => {
  const { formatDate, formatDateTime, formatFullDate } = useDateFormatter()
  
  return (
    <div>
      <p>{formatDate(new Date())}</p>
      {/* In EN: "Nov 20, 2025" */}
      {/* In BG: "20 ноем. 2025 г." */}
      
      <p>{formatDateTime(new Date())}</p>
      {/* In EN: "Nov 20, 2025 14:30" */}
      {/* In BG: "20 ноем. 2025 г. 14:30" */}
      
      <p>{formatFullDate(new Date())}</p>
      {/* In EN: "Wednesday, November 20th, 2025" */}
      {/* In BG: "сряда, 20 ноември 2025 г." */}
    </div>
  )
}
```

### Adding New Translations

1. Add the key to `/lib/i18n/translations/en.json`:
```json
{
  "myPage.title": "My Page Title",
  "myPage.description": "My page description"
}
```

2. Add the Bulgarian translation to `/lib/i18n/translations/bg.json`:
```json
{
  "myPage.title": "Заглавие на моята страница",
  "myPage.description": "Описание на моята страница"
}
```

3. Use in your component:
```tsx
const { t } = useLanguage()
<h1>{t('myPage.title')}</h1>
```

## Translation Key Naming Convention

- Use dot notation for namespacing: `section.subsection.key`
- Common elements: `common.*`
- Navigation: `nav.*`
- Pages: `pageName.*`
- Roles: `roles.*`

## Language Toggle

The language toggle is available in the navigation header for both admin and dashboard layouts. It saves the preference to localStorage.

## Current Translation Coverage

### Fully Translated Pages:
- ✅ Admin Dashboard (main page)
- ✅ Banks (with currency formatting: BGN→лв., EUR→евро)
- ✅ Brands
- ✅ Locations (Memento & Barsy)
- ✅ Users
- ✅ Products (with categories & raw materials)
- ✅ Vendors
- ✅ Skills

### Global Elements:
- ✅ Navigation menus (admin & dashboard)
- ✅ Common actions (save, cancel, delete, edit, etc.)
- ✅ Status badges (active/inactive)
- ✅ User roles
- ✅ Currency symbols (BGN, EUR, USD)
- ✅ All dialog buttons and forms
- ✅ Date formatting (locale-aware with date-fns)
- ✅ Footer

## Expanding Coverage

To translate a new page:

1. Identify all text strings in the component
2. Add translation keys to both `en.json` and `bg.json`
3. Convert the component to use `'use client'` if it's not already
4. Import `useLanguage` and use `t()` function
5. Replace hardcoded strings with `t('key')`

### Example: Before and After

**Before:**
```tsx
<Button>Create Account</Button>
```

**After:**
```tsx
'use client'
import { useLanguage } from '@/lib/i18n/context'

const { t } = useLanguage()
<Button>{t('banks.createAccount')}</Button>
```

