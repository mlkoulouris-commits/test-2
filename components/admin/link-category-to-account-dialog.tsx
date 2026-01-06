'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/lib/i18n/context'
import { AccountSelector } from './account-selector'
import {
  BarsyCategoryWithMapping,
  linkCategoryToAccounts,
  bulkLinkCategoriesToAccounts,
} from '@/lib/actions/barsy-account-mappings'
import { toast } from 'sonner'

interface LinkCategoryToAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: BarsyCategoryWithMapping[]
  onSuccess: () => void
}

export const LinkCategoryToAccountDialog = ({
  open,
  onOpenChange,
  categories,
  onSuccess,
}: LinkCategoryToAccountDialogProps) => {
  const { locale } = useLanguage()
  const [saving, setSaving] = useState(false)
  const [revenueAccountId, setRevenueAccountId] = useState<number | null>(null)
  const [cogsAccountId, setCogsAccountId] = useState<number | null>(null)

  const isBulk = categories.length > 1

  useEffect(() => {
    if (open && categories.length === 1) {
      // Pre-fill with existing mappings for single category
      setRevenueAccountId(categories[0].revenue_account_id)
      setCogsAccountId(categories[0].cogs_account_id)
    } else {
      setRevenueAccountId(null)
      setCogsAccountId(null)
    }
  }, [open, categories])

  const handleSave = async () => {
    setSaving(true)

    if (isBulk) {
      // Bulk linking
      const mappings = categories.map(cat => ({
        locationId: cat.location_id,
        categoryId: cat.barsy_category_id,
        revenueAccountId,
        cogsAccountId,
      }))

      const result = await bulkLinkCategoriesToAccounts(mappings)

      if (result.error) {
        toast.error(result.error)
        setSaving(false)
        return
      }

      toast.success(
        locale === 'bg'
          ? `${result.count} категории са свързани`
          : `${result.count} categories linked`
      )
    } else {
      // Single category linking
      const cat = categories[0]
      const result = await linkCategoryToAccounts(
        cat.location_id,
        cat.barsy_category_id,
        revenueAccountId,
        cogsAccountId
      )

      if (result.error) {
        toast.error(result.error)
        setSaving(false)
        return
      }

      toast.success(
        locale === 'bg' ? 'Категорията е свързана' : 'Category linked'
      )
    }

    setSaving(false)
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {locale === 'bg'
              ? `Свързване на ${isBulk ? categories.length + ' категории' : 'категория'}`
              : `Link ${isBulk ? categories.length + ' Categories' : 'Category'}`}
          </DialogTitle>
          <DialogDescription>
            {isBulk ? (
              locale === 'bg'
                ? 'Изберете сметки за всички избрани категории'
                : 'Select accounts for all selected categories'
            ) : (
              categories[0]?.category_name
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!isBulk && (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{categories[0]?.category_name}</div>
              <div className="text-xs text-muted-foreground">
                {locale === 'bg' ? 'Локация' : 'Location'}: {categories[0]?.location_name}
              </div>
            </div>
          )}

          {isBulk && (
            <div className="rounded-md border p-3 text-sm max-h-[150px] overflow-y-auto">
              <div className="font-medium mb-2">
                {locale === 'bg' ? 'Избрани категории:' : 'Selected categories:'}
              </div>
              {categories.map(cat => (
                <div key={`${cat.location_id}-${cat.barsy_category_id}`} className="py-1">
                  • {cat.category_name}
                  <span className="text-xs text-muted-foreground ml-2">({cat.location_name})</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <AccountSelector
              value={revenueAccountId}
              onChange={setRevenueAccountId}
              accountType="revenue"
              label={locale === 'bg' ? 'Сметка за приходи' : 'Revenue Account'}
              placeholder={locale === 'bg' ? 'Избери сметка за приходи...' : 'Select revenue account...'}
            />

            <AccountSelector
              value={cogsAccountId}
              onChange={setCogsAccountId}
              accountType="cogs"
              label={locale === 'bg' ? 'Сметка за себестойност (по избор)' : 'COGS Account (optional)'}
              placeholder={locale === 'bg' ? 'Избери сметка за себестойност...' : 'Select COGS account...'}
            />
          </div>

          {!revenueAccountId && !cogsAccountId && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {locale === 'bg'
                ? 'Ако не изберете сметки, съществуващите връзки ще бъдат премахнати.'
                : 'If you don\'t select any accounts, existing links will be removed.'}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {locale === 'bg' ? 'Отказ' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? (locale === 'bg' ? 'Запазване...' : 'Saving...')
              : (locale === 'bg' ? 'Свържи' : 'Link')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



































