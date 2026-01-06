'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { createTransaction, type CreateTransactionData } from '@/lib/actions/transactions'
import { X, Plus } from 'lucide-react'

interface Location { id: number; name: string }
interface Product { id: number; name: string; sku: string | null; selling_price: number | null }

interface LineItem {
  productId: number
  productName: string
  quantity: number
  unitPrice: number
}

export const CreateTransactionForm = ({ locations, products }: { locations: Location[], products: Product[] }) => {
  const [locationId, setLocationId] = useState<string>(locations.length === 1 ? locations[0].id.toString() : '')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'invoice' | 'comp'>('cash')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [quantity, setQuantity] = useState('1')
  const [taxAmount, setTaxAmount] = useState('')
  const [tipAmount, setTipAmount] = useState('')
  const [isComp, setIsComp] = useState(false)
  const [compReason, setCompReason] = useState('')
  const [transactionNumber, setTransactionNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const addLineItem = () => {
    if (!selectedProduct) return
    const product = products.find(p => p.id === Number(selectedProduct))
    if (!product) return

    setLineItems([...lineItems, {
      productId: product.id,
      productName: product.name,
      quantity: Number(quantity),
      unitPrice: product.selling_price || 0,
    }])
    setSelectedProduct('')
    setQuantity('1')
  }

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  const total = subtotal + Number(taxAmount || 0) + Number(tipAmount || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!locationId || lineItems.length === 0) {
      setError('Please select a location and add at least one line item')
      return
    }

    setError('')
    setIsLoading(true)

    const data: CreateTransactionData = {
      locationId: Number(locationId),
      paymentMethod,
      lineItems: lineItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      taxAmount: taxAmount ? Number(taxAmount) : undefined,
      tipAmount: tipAmount ? Number(tipAmount) : undefined,
      isComp,
      compReason: isComp ? compReason : undefined,
      transactionNumber: transactionNumber || undefined,
    }

    const result = await createTransaction(data)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      // Reset form
      setLocationId('')
      setPaymentMethod('cash')
      setLineItems([])
      setTaxAmount('')
      setTipAmount('')
      setIsComp(false)
      setCompReason('')
      setTransactionNumber('')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Location</Label>
          <Select value={locationId} onValueChange={setLocationId} disabled={isLoading}>
            <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
            <SelectContent>
              {locations.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Payment Method</Label>
          <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} disabled={isLoading}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
              <SelectItem value="comp">Comp</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Transaction Number (Optional)</Label>
        <Input value={transactionNumber} onChange={(e) => setTransactionNumber(e.target.value)} disabled={isLoading} />
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="font-semibold">Line Items</h3>
        <div className="flex gap-2">
          <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={isLoading}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
            <SelectContent>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name} {p.sku ? `(${p.sku})` : ''} - {p.selling_price?.toFixed(2)} BGN
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-24" min="1" disabled={isLoading} />
          <Button type="button" onClick={addLineItem} disabled={!selectedProduct || isLoading}><Plus className="h-4 w-4" /></Button>
        </div>

        {lineItems.map((item, index) => (
          <Card key={index} className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} x {item.unitPrice.toFixed(2)} BGN = {(item.quantity * item.unitPrice).toFixed(2)} BGN
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeLineItem(index)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Tax Amount (BGN)</Label>
          <Input type="number" step="0.01" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} disabled={isLoading} />
        </div>
        <div className="space-y-2">
          <Label>Tip Amount (BGN)</Label>
          <Input type="number" step="0.01" value={tipAmount} onChange={(e) => setTipAmount(e.target.value)} disabled={isLoading} />
        </div>
        <div className="flex items-end">
          <div className="text-lg font-semibold">Total: {total.toFixed(2)} BGN</div>
        </div>
      </div>

      {(paymentMethod === 'comp' || isComp) && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox checked={isComp} onCheckedChange={(c) => setIsComp(!!c)} />
            <Label>This is a comp transaction</Label>
          </div>
          {isComp && (
            <Textarea value={compReason} onChange={(e) => setCompReason(e.target.value)} placeholder="Reason for comp" disabled={isLoading} />
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isLoading || !locationId || lineItems.length === 0}>
        {isLoading ? 'Creating...' : 'Create Transaction'}
      </Button>
    </form>
  )
}

