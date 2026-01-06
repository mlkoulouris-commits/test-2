"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getZeroAmountTransactions,
  type ZeroAmountTransaction,
} from "@/lib/actions/zero-amount-transactions";
import { ArrowRightLeft, ChevronDown, ChevronRight, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";

interface ZeroAmountTransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  locationId?: string;
  useFiscalDate?: boolean;
  excludeVat?: boolean;
  excludeNoPayment?: boolean;
}

export const ZeroAmountTransactionsModal = ({
  open,
  onOpenChange,
  date,
  locationId,
  useFiscalDate = false,
  excludeVat = false,
  excludeNoPayment = false,
}: ZeroAmountTransactionsModalProps) => {
  const [transactions, setTransactions] = React.useState<
    ZeroAmountTransaction[]
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(
    new Set()
  );

  React.useEffect(() => {
    if (open) {
      loadTransactions();
    }
  }, [open, date, locationId, useFiscalDate, excludeVat, excludeNoPayment]);

  const loadTransactions = async () => {
    setLoading(true);
    const result = await getZeroAmountTransactions(date, locationId, useFiscalDate, excludeVat, excludeNoPayment);
    if (result.data) {
      setTransactions(result.data);
    }
    setLoading(false);
  };

  const formatAmount = (amount: number): string => {
    if (amount >= 100) {
      return Math.round(amount).toLocaleString("en-US");
    }
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDateTime = (dateStr: string): string => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 10) return dateStr;
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const totalStorno = transactions.reduce((sum, t) => sum + t.stornoAmount, 0);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zero Amount Transactions</DialogTitle>
          <DialogDescription>
            {formatDateForDisplay(date)} • {transactions.length} transaction
            {transactions.length !== 1 ? "s" : ""} • Total Storno:{" "}
            {formatAmount(totalStorno)} BGN
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">
              No zero-amount transactions found
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Account #</TableHead>
                <TableHead>Place</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Open Time</TableHead>
                <TableHead>Close Time</TableHead>
                <TableHead className="text-right">Storno Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                const isExpanded = expandedRows.has(transaction.id);
                const hasItems = transaction.lineItems.length > 0;

                return (
                  <React.Fragment key={transaction.id}>
                    <TableRow
                      className={
                        hasItems ? "cursor-pointer hover:bg-muted/50" : ""
                      }
                    >
                      <TableCell
                        onClick={() => hasItems && toggleRow(transaction.id)}
                      >
                        {hasItems &&
                          (isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          ))}
                      </TableCell>
                      <TableCell className="font-medium">
                        {transaction.accountNumber}
                      </TableCell>
                      <TableCell>{transaction.placeName}</TableCell>
                      <TableCell>{transaction.userName}</TableCell>
                      <TableCell>
                        {formatDateTime(transaction.openDate)}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(transaction.closeDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.stornoAmount > 0
                          ? formatAmount(transaction.stornoAmount) + " BGN"
                          : "-"}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasItems && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <div className="px-4 py-3">
                            <h4 className="text-sm font-medium mb-2">
                              Line Items ({transaction.lineItems.length})
                            </h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Article</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="text-right">
                                    Qty
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Unit Price
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Total
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {transaction.lineItems.map((item, idx) => (
                                  <TableRow
                                    key={idx}
                                    className={cn(
                                      item.voidType === "transfer" && "bg-blue-50 dark:bg-blue-950/30",
                                      item.voidType === "pure_void" && "bg-red-50 dark:bg-red-950/30"
                                    )}
                                  >
                                    <TableCell>{item.articleName}</TableCell>
                                    <TableCell>
                                      {item.voidType === "transfer" ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                          <ArrowRightLeft className="h-2.5 w-2.5" />
                                          Transfer
                                        </span>
                                      ) : item.voidType === "pure_void" ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                          <XCircle className="h-2.5 w-2.5" />
                                          Void
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground text-xs">—</span>
                                      )}
                                    </TableCell>
                                    <TableCell className={cn(
                                      "text-right",
                                      item.quantity < 0 && "text-red-600 dark:text-red-400"
                                    )}>
                                      {item.quantity}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatAmount(item.unitPrice)} BGN
                                    </TableCell>
                                    <TableCell className={cn(
                                      "text-right",
                                      item.total < 0 && "text-red-600 dark:text-red-400"
                                    )}>
                                      {formatAmount(item.total)} BGN
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};
