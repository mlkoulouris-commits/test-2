import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Expense Management</h1>
        <p className="text-muted-foreground mt-2">
          Track expenses and manage assets
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expenses & Assets</CardTitle>
          <CardDescription>Feature coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This feature will allow you to:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Record expenses by category</li>
            <li>Track capital vs consumable assets</li>
            <li>Upload and link invoices</li>
            <li>Manage asset depreciation</li>
            <li>Categorize COGS vs operational expenses</li>
            <li>View expense history</li>
            <li>Generate expense reports</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

