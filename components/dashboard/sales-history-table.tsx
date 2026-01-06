'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatSofiaTime } from '@/lib/utils/timezone'

interface SalesRecord {
  id: number
  business_date: string
  cash_amount: number
  cash_tips: number | null
  card_tips: number | null
  is_cash_edited: boolean
  total_card: number
  total: number
  locations: { id: number; name: string }
}

export const SalesHistoryTable = ({ sales }: { sales: SalesRecord[] }) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-right">Cash Sales</TableHead>
          <TableHead className="text-right">Card Sales</TableHead>
          <TableHead className="text-right">Cash Tips</TableHead>
          <TableHead className="text-right">Card Tips</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              No sales records found
            </TableCell>
          </TableRow>
        ) : (
          sales.map((sale) => (
            <TableRow key={sale.id}>
              <TableCell className="font-medium">{sale.business_date}</TableCell>
              <TableCell>{sale.locations.name}</TableCell>
              <TableCell className="text-right">
                {Number(sale.cash_amount).toFixed(2)} BGN
              </TableCell>
              <TableCell className="text-right">
                {sale.total_card.toFixed(2)} BGN
              </TableCell>
              <TableCell className="text-right">
                {sale.cash_tips ? `${Number(sale.cash_tips).toFixed(2)} BGN` : '—'}
              </TableCell>
              <TableCell className="text-right">
                {sale.card_tips ? `${Number(sale.card_tips).toFixed(2)} BGN` : '—'}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {sale.total.toFixed(2)} BGN
              </TableCell>
              <TableCell>
                {sale.is_cash_edited && (
                  <Badge variant="secondary" className="text-xs">Edited</Badge>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

