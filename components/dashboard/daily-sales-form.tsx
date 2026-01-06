'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon } from 'lucide-react'
import { createOrUpdateDailySales, createCardSale, getDailySales, getCardTerminals } from '@/lib/actions/sales'
import { getCurrentBusinessDate, isInNextDayPeriod } from '@/lib/utils/business-date'
import { formatSofiaTime } from '@/lib/utils/timezone'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface Location {
  id: number
  name: string
}

interface CardTerminal {
  id: number
  terminal_name: string
  terminal_id: string
}

export const DailySalesForm = ({ locations }: { locations: Location[] }) => {
  const [selectedLocation, setSelectedLocation] = useState<number | null>(
    locations.length === 1 ? locations[0].id : null
  )
  const [businessDate, setBusinessDate] = useState(getCurrentBusinessDate())
  const [cashAmount, setCashAmount] = useState('')
  const [cashTips, setCashTips] = useState('')
  const [cardTips, setCardTips] = useState('')
  const [terminals, setTerminals] = useState<CardTerminal[]>([])
  const [terminalAmounts, setTerminalAmounts] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const currentTime = new Date()
  const isNextDayPeriod = isInNextDayPeriod(currentTime)

  useEffect(() => {
    if (selectedLocation) {
      loadTerminals()
      loadExistingSales()
    }
  }, [selectedLocation, businessDate])

  const loadTerminals = async () => {
    if (!selectedLocation) return
    const result = await getCardTerminals(selectedLocation)
    if (result.data) {
      setTerminals(result.data)
    }
  }

  const loadExistingSales = async () => {
    if (!selectedLocation) return
    const result = await getDailySales(selectedLocation, businessDate)
    if (result.data) {
      setCashAmount(result.data.cash_amount?.toString() || '')
      setCashTips(result.data.cash_tips?.toString() || '')
      setCardTips(result.data.card_tips?.toString() || '')
      
      // Load card sales
      if (result.data.card_sales) {
        const amounts: Record<number, string> = {}
        result.data.card_sales.forEach((cs: any) => {
          amounts[cs.terminal_id] = cs.amount.toString()
        })
        setTerminalAmounts(amounts)
      }
    } else {
      // Reset form
      setCashAmount('')
      setCashTips('')
      setCardTips('')
      setTerminalAmounts({})
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLocation) return

    setError('')
    setSuccess('')
    setIsLoading(true)

    // Save daily sales
    const salesResult = await createOrUpdateDailySales({
      locationId: selectedLocation,
      businessDate,
      cashAmount: Number(cashAmount) || 0,
      cashTips: cashTips ? Number(cashTips) : undefined,
      cardTips: cardTips ? Number(cardTips) : undefined,
    })

    if (salesResult.error) {
      setError(salesResult.error)
      setIsLoading(false)
      return
    }

    // Save card sales for each terminal
    for (const terminal of terminals) {
      const amount = terminalAmounts[terminal.id]
      if (amount && Number(amount) > 0) {
        await createCardSale({
          dailySalesId: salesResult.id!,
          terminalId: terminal.id,
          amount: Number(amount),
          businessDate,
        })
      }
    }

    setSuccess('Sales recorded successfully')
    setIsLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isNextDayPeriod && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> It's currently {formatSofiaTime(currentTime, 'HH:mm')} (before 8am).
            Sales entered now will count for business date <strong>{businessDate}</strong> (yesterday).
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Select
            value={selectedLocation?.toString()}
            onValueChange={(val) => setSelectedLocation(Number(val))}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id.toString()}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessDate">Business Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="businessDate"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !businessDate && "text-muted-foreground"
                )}
                disabled={isLoading}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {businessDate ? format(new Date(businessDate), 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={businessDate ? new Date(businessDate) : undefined}
                onSelect={(date) => date && setBusinessDate(format(date, 'yyyy-MM-dd'))}
                weekStartsOn={1}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {selectedLocation && (
        <>
          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Cash Sales</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cashAmount">Cash Amount (BGN)</Label>
                <Input
                  id="cashAmount"
                  type="number"
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  disabled={isLoading}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cashTips">Cash Tips (BGN)</Label>
                <Input
                  id="cashTips"
                  type="number"
                  step="0.01"
                  value={cashTips}
                  onChange={(e) => setCashTips(e.target.value)}
                  disabled={isLoading}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardTips">Card Tips (BGN)</Label>
                <Input
                  id="cardTips"
                  type="number"
                  step="0.01"
                  value={cardTips}
                  onChange={(e) => setCardTips(e.target.value)}
                  disabled={isLoading}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {terminals.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Card Sales by Terminal</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {terminals.map((terminal) => (
                    <Card key={terminal.id} className="p-4">
                      <div className="space-y-2">
                        <Label htmlFor={`terminal-${terminal.id}`}>
                          {terminal.terminal_name}
                          <span className="text-xs text-muted-foreground ml-2">
                            ({terminal.terminal_id})
                          </span>
                        </Label>
                        <Input
                          id={`terminal-${terminal.id}`}
                          type="number"
                          step="0.01"
                          value={terminalAmounts[terminal.id] || ''}
                          onChange={(e) => setTerminalAmounts({
                            ...terminalAmounts,
                            [terminal.id]: e.target.value
                          })}
                          disabled={isLoading}
                          placeholder="0.00"
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          {success && (
            <div className="text-sm text-green-600 dark:text-green-400">{success}</div>
          )}

          <Button type="submit" disabled={isLoading || !selectedLocation}>
            {isLoading ? 'Saving...' : 'Save Sales Entry'}
          </Button>
        </>
      )}
    </form>
  )
}

