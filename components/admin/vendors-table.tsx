'use client'

import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toggleVendorStatus } from '@/lib/actions/vendors'
import { useLanguage } from '@/lib/i18n/context'

interface Vendor {
  id: number
  name: string
  name_bg?: string | null
  tax_id: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  payment_terms: string | null
  is_active: boolean
}

interface VendorsTableProps {
  vendors: Vendor[]
  loading?: boolean
  onRefresh?: () => void
}

export const VendorsTable = ({ vendors, loading, onRefresh }: VendorsTableProps) => {
  const { t } = useLanguage()
  
  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const result = await toggleVendorStatus(id, !currentStatus)
    if (!result.error && onRefresh) {
      onRefresh()
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('common.name')}</TableHead>
          <TableHead>{t('vendors.contact')}</TableHead>
          <TableHead>{t('users.email')}</TableHead>
          <TableHead>{t('vendors.phone')}</TableHead>
          <TableHead>{t('vendors.paymentTerms')}</TableHead>
          <TableHead>{t('common.status')}</TableHead>
          <TableHead>{t('common.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              {t('common.loading')}
            </TableCell>
          </TableRow>
        ) : vendors.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              {t('vendors.noVendors')}
            </TableCell>
          </TableRow>
        ) : (
          vendors.map((vendor) => (
            <TableRow key={vendor.id}>
              <TableCell className="font-medium">
                <Link 
                  href={`/admin/vendors/${vendor.id}`}
                  className="text-primary hover:underline"
                >
                  <div className="flex items-center gap-2">
                    <span>{vendor.name}</span>
                    {!vendor.tax_id && (
                      <Badge variant="destructive" className="text-xs">
                        {t('vendors.noTaxId')}
                      </Badge>
                    )}
                  </div>
                  {vendor.name_bg && (
                    <div className="text-xs text-muted-foreground font-normal">{vendor.name_bg}</div>
                  )}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {vendor.contact_name || '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {vendor.contact_email || '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {vendor.contact_phone || '—'}
              </TableCell>
              <TableCell className="text-sm">
                {vendor.payment_terms || '—'}
              </TableCell>
              <TableCell>
                <Badge variant={vendor.is_active ? 'default' : 'secondary'}>
                  {vendor.is_active ? t('common.active') : t('common.inactive')}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleStatus(vendor.id, vendor.is_active)}
                >
                  {vendor.is_active ? t('vendors.deactivate') : t('vendors.activate')}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

