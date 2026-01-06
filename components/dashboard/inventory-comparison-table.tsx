"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InventoryComparison } from "@/lib/actions/inventory";
import { useCurrency } from "@/lib/i18n/currency";
import { cn } from "@/lib/utils";

interface InventoryComparisonTableProps {
  data: InventoryComparison[];
  loading?: boolean;
}

export function InventoryComparisonTable({
  data,
  loading,
}: InventoryComparisonTableProps) {
  const { formatAmount } = useCurrency();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading inventory data...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">
          No inventory data found for the selected date.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Article Name</TableHead>
            <TableHead>Depot</TableHead>
            <TableHead className="text-right">Calculated Qty</TableHead>
            <TableHead className="text-right">Barsy Qty</TableHead>
            <TableHead className="text-right">Qty Variance</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Calculated Cost</TableHead>
            <TableHead className="text-right">Barsy Cost</TableHead>
            <TableHead className="text-right">Calculated Value</TableHead>
            <TableHead className="text-right">Barsy Value</TableHead>
            <TableHead className="text-right">Value Variance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => {
            const hasQuantityVariance =
              item.quantity_variance !== null && item.quantity_variance !== 0;
            const hasValueVariance =
              item.value_variance !== null &&
              Math.abs(item.value_variance) > 0.01;
            const hasDiscrepancy = hasQuantityVariance || hasValueVariance;

            return (
              <TableRow
                key={`${item.barsy_article_id}-${
                  item.depot_id || "null"
                }-${index}`}
                className={cn(
                  index % 2 === 0 && "bg-muted/50",
                  hasDiscrepancy && "bg-yellow-50 dark:bg-yellow-950/20"
                )}
              >
                <TableCell className="font-medium">
                  {item.article_name}
                </TableCell>
                <TableCell>{item.depot_name || "-"}</TableCell>
                <TableCell className="text-right">
                  {item.quantity.toFixed(4)}
                </TableCell>
                <TableCell className="text-right">
                  {item.barsy_quantity !== null
                    ? item.barsy_quantity.toFixed(4)
                    : "-"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    hasQuantityVariance &&
                      item.quantity_variance! > 0 &&
                      "text-green-600 dark:text-green-400",
                    hasQuantityVariance &&
                      item.quantity_variance! < 0 &&
                      "text-red-600 dark:text-red-400"
                  )}
                >
                  {item.quantity_variance !== null ? (
                    <>
                      {item.quantity_variance > 0 ? "+" : ""}
                      {item.quantity_variance.toFixed(4)}
                    </>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{item.unit || "-"}</TableCell>
                <TableCell className="text-right">
                  {item.cost_price !== null
                    ? formatAmount(item.cost_price)
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {item.barsy_cost_price !== null
                    ? formatAmount(item.barsy_cost_price)
                    : "-"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatAmount(item.total_value)}
                </TableCell>
                <TableCell className="text-right">
                  {item.barsy_total_value !== null
                    ? formatAmount(item.barsy_total_value)
                    : "-"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    hasValueVariance &&
                      item.value_variance! > 0 &&
                      "text-green-600 dark:text-green-400",
                    hasValueVariance &&
                      item.value_variance! < 0 &&
                      "text-red-600 dark:text-red-400"
                  )}
                >
                  {item.value_variance !== null ? (
                    <>
                      {item.value_variance > 0 ? "+" : ""}
                      {formatAmount(item.value_variance)}
                    </>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {hasDiscrepancy ? (
                    <Badge variant="destructive">Discrepancy</Badge>
                  ) : item.barsy_quantity !== null ? (
                    <Badge variant="default">Match</Badge>
                  ) : (
                    <Badge variant="secondary">Calculated Only</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}









