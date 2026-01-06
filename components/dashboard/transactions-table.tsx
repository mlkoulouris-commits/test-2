'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatSofiaTime } from '@/lib/utils/timezone'

interface Transaction {
  id: number
  business_date: string
  actual_timestamp: string
  transaction_number: string | null
  total_amount: number
  payment_method: string
  is_comp: boolean
  locations: { id: number; name: string }
  transaction_line_items: Array<{
    quantity: number
    products: { name: string }
  }>
}

export const TransactionsTable = ({ transactions }: { transactions: Transaction[] }) => {
  const getPaymentBadge = (method: string, isComp: boolean) => {
    if (isComp) return <Badge variant="destructive">Comp</Badge>
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      cash: 'default',
      card: 'secondary',
      invoice: 'outline',
    }
    return <Badge variant={variants[method] || 'outline'}>{method}</Badge>
  }

  return (
    <div className="space-y-4">
      {transactions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No transactions found</p>
      ) : (
        transactions.map((tx) => (
          <div key={tx.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Transaction #{tx.id}</span>
                  {tx.transaction_number && (
                    <Badge variant="outline" className="text-xs">{tx.transaction_number}</Badge>
                  )}
                  {getPaymentBadge(tx.payment_method, tx.is_comp)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {tx.locations.name} • {formatSofiaTime(tx.actual_timestamp, 'PPp')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">{Number(tx.total_amount).toFixed(2)} BGN</div>
                <div className="text-xs text-muted-foreground">Business Date: {tx.business_date}</div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {tx.transaction_line_items.length} item(s): {' '}
              {tx.transaction_line_items.map((item, i) => (
                <span key={i}>
                  {item.quantity}x {item.products.name}
                  {i < tx.transaction_line_items.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

