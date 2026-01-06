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
  getTipsWasteTransactions,
  type TipsWasteOrder,
  type TipsWasteType,
} from "@/lib/actions/tips-waste-transactions";
import * as React from "react";

interface TipsWasteTransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  type: TipsWasteType;
  locationId?: string;
  useFiscalDate?: boolean;
  excludeVat?: boolean;
}

const getTypeTitle = (type: TipsWasteType): string => {
  switch (type) {
    case "tips":
      return "Tips";
    case "waste":
      return "Waste";
    default:
      return "Transactions";
  }
};

export const TipsWasteTransactionsModal = ({
  open,
  onOpenChange,
  date,
  type,
  locationId,
  useFiscalDate = false,
  excludeVat = false,
}: TipsWasteTransactionsModalProps) => {
  const [transactions, setTransactions] = React.useState<TipsWasteOrder[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      loadTransactions();
    }
  }, [open, date, type, locationId, useFiscalDate, excludeVat]);

  const loadTransactions = async () => {
    setLoading(true);
    const result = await getTipsWasteTransactions(
      date,
      type,
      locationId,
      useFiscalDate,
      excludeVat
    );
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
      const dateObj = new Date(year, month - 1, day);
      return dateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const totalAmount = transactions.reduce((sum, t) => sum + t.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTypeTitle(type)} Transactions</DialogTitle>
          <DialogDescription>
            {formatDateForDisplay(date)} • {transactions.length} item
            {transactions.length !== 1 ? "s" : ""} • Total:{" "}
            {formatAmount(totalAmount)} BGN
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">No {type} found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Account #</TableHead>
                <TableHead>Place</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction, index) => (
                <TableRow
                  key={transaction.id}
                  className={index % 2 === 1 ? "bg-muted/30" : ""}
                >
                  <TableCell className="font-medium">
                    {transaction.articleName}
                  </TableCell>
                  <TableCell>{transaction.accountNumber || "-"}</TableCell>
                  <TableCell>{transaction.placeName}</TableCell>
                  <TableCell>{transaction.userName}</TableCell>
                  <TableCell>{formatDateTime(transaction.orderDate)}</TableCell>
                  <TableCell className="text-right">
                    {transaction.quantity}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(transaction.unitPrice)} BGN
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(transaction.total)} BGN
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};
