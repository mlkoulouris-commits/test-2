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
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/lib/i18n/context'
import { AccountSelector } from './account-selector'
import { CoaAccountBadge } from './coa-account-badge'
import {
  BarsyArticleWithMapping,
  linkArticleToAccounts,
} from '@/lib/actions/barsy-account-mappings'
import { toast } from 'sonner'

interface LinkArticleToAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: BarsyArticleWithMapping | null
  onSuccess: () => void
}

export const LinkArticleToAccountDialog = ({
  open,
  onOpenChange,
  article,
  onSuccess,
}: LinkArticleToAccountDialogProps) => {
  const { locale } = useLanguage()
  const [saving, setSaving] = useState(false)
  const [revenueAccountId, setRevenueAccountId] = useState<number | null>(null)
  const [cogsAccountId, setCogsAccountId] = useState<number | null>(null)

  useEffect(() => {
    if (open && article) {
      // Pre-fill with existing mappings
      setRevenueAccountId(article.revenue_account_id)
      setCogsAccountId(article.cogs_account_id)
    } else {
      setRevenueAccountId(null)
      setCogsAccountId(null)
    }
  }, [open, article])

  const handleSave = async () => {
    if (!article) return

    setSaving(true)

    const result = await linkArticleToAccounts(
      article.location_id,
      article.barsy_article_id,
      revenueAccountId,
      cogsAccountId
    )

    if (result.error) {
      toast.error(result.error)
      setSaving(false)
      return
    }

    toast.success(
      locale === 'bg' ? 'Артикулът е свързан' : 'Article linked'
    )

    setSaving(false)
    onOpenChange(false)
    onSuccess()
  }

  const handleClearOverride = async () => {
    if (!article) return

    setSaving(true)

    const result = await linkArticleToAccounts(
      article.location_id,
      article.barsy_article_id,
      null,
      null
    )

    if (result.error) {
      toast.error(result.error)
      setSaving(false)
      return
    }

    toast.success(
      locale === 'bg'
        ? 'Специалната връзка е премахната (ще се наследява от категорията)'
        : 'Override removed (will inherit from category)'
    )

    setSaving(false)
    onOpenChange(false)
    onSuccess()
  }

  if (!article) return null

  const hasInheritedAccounts = article.inherited_revenue_account_id || article.inherited_cogs_account_id
  const hasDirectMapping = article.revenue_account_id || article.cogs_account_id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {hasDirectMapping
              ? (locale === 'bg' ? 'Редактиране на връзка' : 'Edit Link')
              : (locale === 'bg' ? 'Свързване на артикул' : 'Link Article')}
          </DialogTitle>
          <DialogDescription>
            {article.article_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="rounded-md border p-3 text-sm space-y-2">
            <div className="font-medium">{article.article_name}</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">
                {locale === 'bg' ? 'Локация' : 'Location'}: {article.location_name}
              </Badge>
              {article.category_name && (
                <Badge variant="outline">
                  {locale === 'bg' ? 'Категория' : 'Category'}: {article.category_name}
                </Badge>
              )}
            </div>
          </div>

          {hasInheritedAccounts && !hasDirectMapping && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-2">
              <div className="font-medium text-muted-foreground">
                {locale === 'bg' ? 'Наследени от категорията:' : 'Inherited from category:'}
              </div>
              {article.inherited_revenue_account_code && (
                <div>
                  {locale === 'bg' ? 'Приходи' : 'Revenue'}:
                  <span className="ml-2 inline-flex">
                    <CoaAccountBadge
                      code={article.inherited_revenue_account_code}
                      name={article.inherited_revenue_account_name}
                      variant="outline"
                    />
                  </span>
                </div>
              )}
              {article.inherited_cogs_account_code && (
                <div>
                  {locale === 'bg' ? 'Себестойност' : 'COGS'}:
                  <span className="ml-2 inline-flex">
                    <CoaAccountBadge
                      code={article.inherited_cogs_account_code}
                      name={article.inherited_cogs_account_name}
                      variant="outline"
                    />
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">
                {hasDirectMapping
                  ? (locale === 'bg' ? 'Специална сметка за приходи (замества)' : 'Override Revenue Account')
                  : (locale === 'bg' ? 'Сметка за приходи' : 'Revenue Account')}
              </Label>
              <div className="mt-1">
                <AccountSelector
                  value={revenueAccountId}
                  onChange={setRevenueAccountId}
                  accountType="revenue"
                  placeholder={
                    hasInheritedAccounts && !hasDirectMapping
                      ? (locale === 'bg' ? 'Използвай наследената...' : 'Use inherited...')
                      : (locale === 'bg' ? 'Избери сметка...' : 'Select account...')
                  }
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">
                {hasDirectMapping
                  ? (locale === 'bg' ? 'Специална сметка за себестойност (замества)' : 'Override COGS Account')
                  : (locale === 'bg' ? 'Сметка за себестойност' : 'COGS Account')}
              </Label>
              <div className="mt-1">
                <AccountSelector
                  value={cogsAccountId}
                  onChange={setCogsAccountId}
                  accountType="cogs"
                  placeholder={
                    hasInheritedAccounts && !hasDirectMapping
                      ? (locale === 'bg' ? 'Използвай наследената...' : 'Use inherited...')
                      : (locale === 'bg' ? 'Избери сметка...' : 'Select account...')
                  }
                />
              </div>
            </div>
          </div>

          {!revenueAccountId && !cogsAccountId && hasDirectMapping && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {locale === 'bg'
                ? 'Изчистването ще премахне специалните сметки и ще наследи от категорията.'
                : 'Clearing will remove overrides and inherit from category.'}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasDirectMapping && (
            <Button
              variant="outline"
              onClick={handleClearOverride}
              disabled={saving}
              className="sm:mr-auto"
            >
              {locale === 'bg' ? 'Премахни специалните' : 'Clear Override'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {locale === 'bg' ? 'Отказ' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? (locale === 'bg' ? 'Запазване...' : 'Saving...')
              : hasDirectMapping
                ? (locale === 'bg' ? 'Обнови' : 'Update')
                : (locale === 'bg' ? 'Свържи' : 'Link')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
