"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InventorySummary } from "@/lib/actions/inventory";
import { useCurrency } from "@/lib/i18n/currency";
import { AlertTriangle, CheckCircle2, DollarSign, Package } from "lucide-react";

interface InventorySummaryProps {
  summary: InventorySummary;
  loading?: boolean;
}

export function InventorySummaryCards({
  summary,
  loading,
}: InventorySummaryProps) {
  const { formatAmount } = useCurrency();

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.total_items}</div>
          <p className="text-xs text-muted-foreground">Inventory items</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Calculated Value
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatAmount(summary.calculated_total_value)}
          </div>
          <p className="text-xs text-muted-foreground">From our calculation</p>
        </CardContent>
      </Card>

      {summary.barsy_total_value !== null && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Barsy Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatAmount(summary.barsy_total_value)}
              </div>
              <p className="text-xs text-muted-foreground">
                From Barsy snapshot
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Variance
              </CardTitle>
              {summary.total_variance !== null &&
              summary.total_variance !== 0 ? (
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  summary.total_variance !== null &&
                  summary.total_variance !== 0
                    ? "text-yellow-600 dark:text-yellow-400"
                    : ""
                }`}
              >
                {summary.total_variance !== null
                  ? `${summary.total_variance > 0 ? "+" : ""}${formatAmount(
                      summary.total_variance
                    )}`
                  : "-"}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.items_with_discrepancies} items with discrepancies
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {summary.barsy_total_value === null && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discrepancies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.items_with_discrepancies}
            </div>
            <p className="text-xs text-muted-foreground">
              Items needing review
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}









