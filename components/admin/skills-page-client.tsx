'use client'

import { SkillsTable } from '@/components/admin/skills-table'
import { Card, CardContent } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

interface SkillsPageClientProps {
  skills: any[]
}

export const SkillsPageClient = ({ skills }: SkillsPageClientProps) => {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/admin">{t('common.admin')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/admin/settings">{t('nav.settings')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('nav.skills')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-2">
          <h1 className="text-2xl sm:text-3xl font-bold">{t('skills.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('skills.description')}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <SkillsTable skills={skills} />
        </CardContent>
      </Card>
    </div>
  )
}


