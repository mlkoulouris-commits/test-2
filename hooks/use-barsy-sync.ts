import { useState } from 'react'
import { format } from 'date-fns'

interface SyncResult {
  success?: boolean
  error?: string
  errors?: string
  recordsSynced?: number
  synced?: number
  count?: number
}

type SyncFunction = (locationId: string, ...args: string[]) => Promise<SyncResult>

interface UseBarsySyncOptions {
  selectedLocation: string | null
  dateFrom?: Date | undefined
  dateTo?: Date | undefined
  onSuccess?: () => void
  successMessage?: (result: SyncResult, dateFrom?: Date, dateTo?: Date) => string
  errorMessage?: string
  loadingMessage?: string
}

export const useBarsySync = ({
  selectedLocation,
  dateFrom,
  dateTo,
  onSuccess,
  successMessage,
  errorMessage = 'Sync failed',
  loadingMessage,
}: UseBarsySyncOptions) => {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('')

  const handleSync = async (syncFn: SyncFunction, requiresDates = false) => {
    if (!selectedLocation) return
    if (requiresDates && (!dateFrom || !dateTo)) return

    setLoading(true)
    setMessage(null)
    if (loadingMessage) {
      setCurrentLoadingMessage(loadingMessage)
    }

    try {
      const args: string[] = []
      if (requiresDates && dateFrom && dateTo) {
        args.push(format(dateFrom, 'yyyy-MM-dd'))
        args.push(format(dateTo, 'yyyy-MM-dd'))
      }

      const result = await syncFn(selectedLocation, ...args)

      if (result.success) {
        const defaultSuccessMessage = `Successfully synced ${
          result.recordsSynced?.toLocaleString() || 
          result.synced?.toLocaleString() || 
          result.count?.toLocaleString() || 
          0
        } records`
        
        setMessage({
          type: 'success',
          text: successMessage ? successMessage(result, dateFrom, dateTo) : defaultSuccessMessage,
        })
        
        if (onSuccess) {
          onSuccess()
        }
      } else {
        setMessage({
          type: 'error',
          text: result.error || result.errors || errorMessage,
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred',
      })
    } finally {
      setLoading(false)
      setCurrentLoadingMessage('')
    }
  }

  return {
    loading,
    message,
    loadingMessage: currentLoadingMessage,
    handleSync,
    setMessage,
  }
}

