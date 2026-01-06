'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface SyncLog {
  id: string
  sync_type: string
  date_from: string | null
  date_to: string | null
  records_synced: number
  status: string
  error_message: string | null
  completed_at: string | null
  created_at: string
  location_name?: string
}

interface BarsySyncHistoryTableProps {
  syncHistory: SyncLog[]
}

export const BarsySyncHistoryTable = ({ syncHistory }: BarsySyncHistoryTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Location</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Date Range</TableHead>
          <TableHead className="text-right">Records</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Completed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {syncHistory.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No sync history yet
            </TableCell>
          </TableRow>
        ) : (
          syncHistory.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="font-medium">{log.location_name || '—'}</TableCell>
              <TableCell>{log.sync_type}</TableCell>
              <TableCell>
                {log.date_from && log.date_to ? (
                  <>
                    {format(new Date(log.date_from), 'MMM d')} - {format(new Date(log.date_to), 'MMM d, yyyy')}
                  </>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="text-right">{log.records_synced.toLocaleString()}</TableCell>
              <TableCell>
                {log.status === 'completed' || log.status === 'success' ? (
                  <Badge variant="default" className="bg-green-600">Success</Badge>
                ) : log.status === 'failed' ? (
                  <Badge variant="destructive">Failed</Badge>
                ) : (
                  <Badge variant="secondary">{log.status}</Badge>
                )}
              </TableCell>
              <TableCell>
                {log.completed_at ? format(new Date(log.completed_at), 'MMM d, h:mm a') : '—'}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
