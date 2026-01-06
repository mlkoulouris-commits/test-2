"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StaffPerformanceData } from "@/lib/actions/barsy-transactions";
import { ArrowUpDown, ArrowUp, ArrowDown, User } from "lucide-react";
import { useState, useMemo } from "react";

interface StaffPerformanceTableProps {
  data: StaffPerformanceData[];
  loading?: boolean;
}

type SortField =
  | "user_name"
  | "transactions"
  | "revenue"
  | "cash"
  | "card"
  | "wallet"
  | "tips"
  | "waste"
  | "total_discounts"
  | "avg_transaction"
  | "items_sold"
  | "void_rate";

type SortDirection = "asc" | "desc";

const formatAmount = (amount: number | null | undefined) => {
  if (amount == null) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatNumber = (num: number | null | undefined) => {
  if (num == null) return "0";
  return Math.round(num).toLocaleString("en-US");
};

const formatPercent = (num: number | null | undefined) => {
  if (num == null) return "0.0%";
  return `${num.toFixed(1)}%`;
};

export const StaffPerformanceTable = ({
  data,
  loading = false,
}: StaffPerformanceTableProps) => {
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedData = useMemo(() => {
    if (!data) return [];

    return [...data].sort((a, b) => {
      let aValue: string | number = a[sortField];
      let bValue: string | number = b[sortField];

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [data, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5" />
    );
  };

  const SortableHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent"
        onClick={() => handleSort(field)}
      >
        {children}
        <SortIcon field={field} />
      </Button>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <User className="h-12 w-12 mb-4 opacity-50" />
        <p>No staff performance data available for this period</p>
      </div>
    );
  }

  // Calculate totals for summary row
  const totals = data.reduce(
    (acc, row) => ({
      transactions: acc.transactions + row.transactions,
      revenue: acc.revenue + row.revenue,
      cash: acc.cash + row.cash,
      card: acc.card + row.card,
      wallet: acc.wallet + row.wallet,
      tips: acc.tips + row.tips,
      waste: acc.waste + row.waste,
      items_sold: acc.items_sold + row.items_sold,
      discounted_orders: acc.discounted_orders + row.discounted_orders,
      total_discounts: acc.total_discounts + row.total_discounts,
      void_count: acc.void_count + row.void_count,
    }),
    {
      transactions: 0,
      revenue: 0,
      cash: 0,
      card: 0,
      wallet: 0,
      tips: 0,
      waste: 0,
      items_sold: 0,
      discounted_orders: 0,
      total_discounts: 0,
      void_count: 0,
    }
  );

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="user_name">Staff Member</SortableHeader>
            <SortableHeader field="transactions" className="text-right">
              Transactions
            </SortableHeader>
            <SortableHeader field="revenue" className="text-right">
              Revenue
            </SortableHeader>
            <SortableHeader field="cash" className="text-right">
              Cash
            </SortableHeader>
            <SortableHeader field="card" className="text-right">
              Card
            </SortableHeader>
            <SortableHeader field="wallet" className="text-right">
              Wallet
            </SortableHeader>
            <SortableHeader field="tips" className="text-right">
              Tips
            </SortableHeader>
            <SortableHeader field="waste" className="text-right">
              Waste
            </SortableHeader>
            <SortableHeader field="total_discounts" className="text-right">
              Discounts
            </SortableHeader>
            <SortableHeader field="avg_transaction" className="text-right">
              Avg Transaction
            </SortableHeader>
            <SortableHeader field="items_sold" className="text-right">
              Items Sold
            </SortableHeader>
            <SortableHeader field="void_rate" className="text-right">
              Void Rate
            </SortableHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((staff, index) => (
            <TableRow
              key={staff.user_name}
              className={cn(index % 2 === 1 && "bg-muted/50")}
            >
              <TableCell className="font-medium">{staff.user_name}</TableCell>
              <TableCell className="text-right">
                {formatNumber(staff.transactions)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatAmount(staff.revenue)} BGN
              </TableCell>
              <TableCell className="text-right">
                {staff.cash !== 0 ? (
                  <span>{formatAmount(staff.cash)} BGN</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {staff.card !== 0 ? (
                  <span>{formatAmount(staff.card)} BGN</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {staff.wallet !== 0 ? (
                  <span>{formatAmount(staff.wallet)} BGN</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {staff.tips !== 0 ? (
                  <span className="text-amber-700 dark:text-amber-300">
                    {formatAmount(staff.tips)} BGN
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {staff.waste !== 0 ? (
                  <span className="text-red-700 dark:text-red-300">
                    {formatAmount(staff.waste)} BGN
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {staff.total_discounts > 0 ? (
                  <span className="text-orange-600">
                    {formatAmount(staff.total_discounts)} BGN
                    {staff.discounted_orders > 0 && (
                      <span className="text-xs ml-1 text-muted-foreground">
                        ({formatNumber(staff.discounted_orders)})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {formatAmount(staff.avg_transaction)} BGN
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(staff.items_sold)}
              </TableCell>
              <TableCell className="text-right">
                {staff.void_rate > 0 ? (
                  <span
                    className={cn(
                      staff.void_rate > 5
                        ? "text-red-600 font-medium"
                        : staff.void_rate > 2
                          ? "text-orange-600"
                          : "text-muted-foreground"
                    )}
                  >
                    {formatPercent(staff.void_rate)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {/* Summary row */}
          <TableRow className="bg-muted font-semibold border-t-2">
            <TableCell>Total ({data.length} staff)</TableCell>
            <TableCell className="text-right">
              {formatNumber(totals.transactions)}
            </TableCell>
            <TableCell className="text-right">
              {formatAmount(totals.revenue)} BGN
            </TableCell>
            <TableCell className="text-right">
              {formatAmount(totals.cash)} BGN
            </TableCell>
            <TableCell className="text-right">
              {formatAmount(totals.card)} BGN
            </TableCell>
            <TableCell className="text-right">
              {formatAmount(totals.wallet)} BGN
            </TableCell>
            <TableCell className="text-right text-amber-700 dark:text-amber-300">
              {formatAmount(totals.tips)} BGN
            </TableCell>
            <TableCell className="text-right text-red-700 dark:text-red-300">
              {formatAmount(totals.waste)} BGN
            </TableCell>
            <TableCell className="text-right text-orange-600">
              {formatAmount(totals.total_discounts)} BGN
              {totals.discounted_orders > 0 && (
                <span className="text-xs ml-1 text-muted-foreground">
                  ({formatNumber(totals.discounted_orders)})
                </span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {formatAmount(
                totals.transactions > 0
                  ? totals.revenue / totals.transactions
                  : 0
              )}{" "}
              BGN
            </TableCell>
            <TableCell className="text-right">
              {formatNumber(totals.items_sold)}
            </TableCell>
            <TableCell className="text-right">-</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
