'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toggleBrandStatus } from '@/lib/actions/brands'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/context'
import { useDateFormatter } from '@/lib/i18n/date-formatter'

interface Brand {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

interface BrandsTableProps {
  brands: Brand[]
}

export const BrandsTable = ({ brands }: BrandsTableProps) => {
  const router = useRouter()
  const { t } = useLanguage()
  const { formatDate } = useDateFormatter()

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const result = await toggleBrandStatus(id, !currentStatus)
    if (!result.error) {
      router.refresh()
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('brands.name')}</TableHead>
          <TableHead>{t('common.description')}</TableHead>
          <TableHead>{t('common.status')}</TableHead>
          <TableHead>{t('brands.created')}</TableHead>
          <TableHead>{t('common.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {brands.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              {t('brands.noBrands')}
            </TableCell>
          </TableRow>
        ) : (
          brands.map((brand) => (
            <TableRow key={brand.id}>
              <TableCell className="font-medium">{brand.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {brand.description || '—'}
              </TableCell>
              <TableCell>
                <Badge variant={brand.is_active ? 'default' : 'secondary'}>
                  {brand.is_active ? t('common.active') : t('common.inactive')}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(brand.created_at)}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleStatus(brand.id, brand.is_active)}
                >
                  {brand.is_active ? t('banks.deactivate') : t('banks.activate')}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

