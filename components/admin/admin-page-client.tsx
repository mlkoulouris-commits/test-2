'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/context'

export const AdminPageClient = () => {
  const { t } = useLanguage()

  const coreModules = [
    { title: t('nav.users'), description: t('admin.modules.users'), href: '/admin/users' },
    { title: t('nav.products'), description: t('admin.modules.products'), href: '/admin/products' },
  ]

  const financeModules = [
    { title: t('nav.banks'), description: t('admin.modules.banks'), href: '/admin/banks' },
    { title: t('nav.vendors'), description: t('admin.modules.vendors'), href: '/admin/vendors' },
    { title: t('nav.bills'), description: t('admin.modules.bills'), href: '/admin/bills' },
    { title: t('nav.billPayments'), description: t('admin.modules.billPayments'), href: '/admin/bill-payments' },
  ]

  const barsyModules = [
    { title: t('nav.suppliers'), description: t('admin.modules.suppliers'), href: '/admin/suppliers' },
    { title: t('nav.sync'), description: t('admin.modules.sync'), href: '/admin/barsy-sync' },
    { title: t('nav.invoices'), description: t('admin.modules.invoices'), href: '/admin/barsy-bills' },
  ]

  const settingsModules = [
    { title: t('nav.brands'), description: t('admin.modules.brands'), href: '/admin/brands' },
    { title: t('nav.locations'), description: t('admin.modules.locations'), href: '/admin/locations' },
    { title: t('nav.skills'), description: t('admin.modules.skills'), href: '/admin/skills' },
  ]

  const renderSection = (title: string, modules: typeof coreModules) => (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Card key={module.href} className="hover:border-primary transition-colors">
            <CardHeader>
              <CardTitle>{module.title}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={module.href}>
                <Button className="w-full">{t('admin.manage')}</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.dashboard')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('admin.description')}
        </p>
      </div>

      {renderSection(t('admin.core'), coreModules)}
      {renderSection(t('admin.finance'), financeModules)}
      {renderSection(t('admin.barsyIntegration'), barsyModules)}
      {renderSection(t('nav.settings'), settingsModules)}
    </div>
  )
}


