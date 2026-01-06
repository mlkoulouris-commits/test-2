'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Check, X, AlertCircle } from 'lucide-react'
import { syncAllBarsyBills, SyncAllResult } from '@/lib/actions/barsy-bills-sync-all'

export const SyncBarsyBillsButton = () => {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [daysBack, setDaysBack] = useState('30')
  const [result, setResult] = useState<SyncAllResult | null>(null)

  const handleSync = async () => {
    setIsSyncing(true)
    setResult(null)
    
    const syncResult = await syncAllBarsyBills(parseInt(daysBack))
    
    setResult(syncResult)
    setIsSyncing(false)
    router.refresh()
  }

  const handleClose = () => {
    setIsOpen(false)
    setResult(null)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Sync from Barsy
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Sync Bills from Barsy</DialogTitle>
            <DialogDescription>
              Pull new bills (store loads) from all active Barsy locations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!result && (
              <>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <Select value={daysBack} onValueChange={setDaysBack} disabled={isSyncing}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="14">Last 14 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="60">Last 60 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How far back to sync bills from Barsy
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex-1"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Start Sync
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSyncing}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {result && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    <h3 className="font-semibold">
                      {result.success ? 'Sync Complete' : 'Sync Failed'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Total Locations</div>
                      <div className="font-medium">{result.totalLocations}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Bills Synced</div>
                      <div className="font-medium text-green-600">{result.totalBillsSynced}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Successful</div>
                      <div className="font-medium text-green-600">{result.successfulSyncs}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Failed</div>
                      <div className="font-medium text-destructive">{result.failedSyncs}</div>
                    </div>
                  </div>
                </div>

                {/* Per-location results */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Location Results</h4>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {result.results.map((loc) => (
                      <div
                        key={loc.locationId}
                        className="flex items-center justify-between p-3 rounded-md border"
                      >
                        <div className="flex items-center gap-2">
                          {loc.success ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm font-medium">{loc.locationName}</span>
                        </div>
                        <div>
                          {loc.success ? (
                            <Badge variant="secondary">
                              {loc.count} bill{loc.count !== 1 ? 's' : ''}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              {loc.error || 'Failed'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={handleClose} className="w-full">
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}



