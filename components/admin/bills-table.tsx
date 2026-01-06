"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { voidBill } from "@/lib/actions/bills";
import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import { useDateFormatter } from "@/lib/i18n/date-formatter";
import { BookOpen, CreditCard, Edit, Paperclip, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BillItemsDialog } from "./bill-items-dialog";
import { BillPaymentHistoryDialog } from "./bill-payment-history-dialog";
import { EditBillAccountsDialog } from "./edit-bill-accounts-dialog";
import { EditBillDialog } from "./edit-bill-dialog";
import { RecordMultiBillPaymentDialog } from "./record-multi-bill-payment-dialog";

interface Bill {
  id: number;
  source: "barsy" | "manual";
  location_id: number;
  vendor_id: number;
  doc_num: string | null;
  doc_date: string | null;
  due_date: string | null;
  total_amount: number;
  total_amount_including_vat?: number;
  total_paid: number;
  balance: number;
  status: "approved" | "partially_paid" | "paid" | "voided";
  vendor_name: string | null;
  location_name: string | null;
  description: string | null;
  attachment_count?: number;
  has_vat?: boolean;
  vat_rate?: number | null;
  vat_amount?: number | null;
  vat_amount_total?: number;
}

interface BillsTableProps {
  bills: Bill[];
  currentPage: number;
}

export const BillsTable = ({ bills, currentPage }: BillsTableProps) => {
  const { t } = useLanguage();
  const { formatAmount, getCurrencySymbol } = useCurrency();
  const { formatDate: formatDateLocale } = useDateFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<number | null>(null);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [selectedBillForItems, setSelectedBillForItems] = useState<Bill | null>(
    null
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [billToEdit, setBillToEdit] = useState<number | null>(null);
  const [accountsDialogOpen, setAccountsDialogOpen] = useState(false);
  const [billToEditAccounts, setBillToEditAccounts] = useState<number | null>(
    null
  );
  const [pageSize, setPageSize] = useState(10);

  const paginatedBills = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return bills.slice(startIndex, endIndex);
  }, [bills, currentPage, pageSize]);

  const handleEditClick = (billId: number) => {
    setBillToEdit(billId);
    setEditDialogOpen(true);
  };

  const handleEditAccountsClick = (billId: number) => {
    setBillToEditAccounts(billId);
    setAccountsDialogOpen(true);
  };

  const handleDeleteClick = (billId: number) => {
    setBillToDelete(billId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!billToDelete) return;

    const result = await voidBill(billToDelete);
    if (!result.error) {
      router.refresh();
    }
    setDeleteDialogOpen(false);
    setBillToDelete(null);
  };

  const handleRowClick = (bill: Bill) => {
    setSelectedBillForItems(bill);
    setItemsDialogOpen(true);
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const getStatusBadge = (bill: Bill) => {
    // Check for overdue first
    if (isOverdue(bill)) {
      return <Badge variant="destructive">{t("billStatus.overdue")}</Badge>;
    }

    const statusLabels = {
      paid: t("billStatus.paid"),
      partially_paid: t("billStatus.partiallyPaid"),
      approved: t("billStatus.approved"),
      voided: t("billStatus.voided"),
    };

    // Then check bill status
    return (
      <StatusBadge
        status={bill.status}
        labels={statusLabels}
        className={
          bill.status === "approved" ? "bg-blue-600 hover:bg-blue-700" : ""
        }
      />
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const currentYear = new Date().getFullYear();
    const dateYear = date.getFullYear();

    if (dateYear === currentYear) {
      return formatDateLocale(date, "MMM d");
    }
    return formatDateLocale(date, "MMM d, yyyy");
  };

  const updatePageParam = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    router.push(`?${params.toString()}`);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    updatePageParam(1);
  };

  const isOverdue = (bill: Bill) => {
    if (bill.status === "paid" || bill.status === "voided") return false;
    if (!bill.due_date) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(bill.due_date);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today && bill.balance > 0;
  };

  const canEditBill = (bill: Bill) => {
    return (
      bill.source === "manual" &&
      (bill.status === "approved" || bill.status === "partially_paid")
    );
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("billsTable.billNumber")}</TableHead>
            <TableHead>{t("billsTable.vendor")}</TableHead>
            <TableHead>{t("billsTable.billDate")}</TableHead>
            <TableHead>{t("billsTable.dueDate")}</TableHead>
            <TableHead className="text-right">
              {t("billsTable.amount")}
            </TableHead>
            <TableHead className="text-right">{t("billsTable.vat")}</TableHead>
            <TableHead className="text-right">{t("billsTable.paid")}</TableHead>
            <TableHead className="text-right">
              {t("billsTable.balance")}
            </TableHead>
            <TableHead className="text-center">{t("common.status")}</TableHead>
            <TableHead className="text-center">
              {t("billsTable.files")}
            </TableHead>
            <TableHead className="text-center">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedBills.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={11}
                className="text-center text-muted-foreground"
              >
                {t("billsTable.noBills")}
              </TableCell>
            </TableRow>
          ) : (
            paginatedBills.map((bill, index) => (
              <TableRow
                key={bill.id}
                className={`cursor-pointer hover:bg-muted/50 ${
                  index % 2 === 1 ? "bg-muted/30" : ""
                }`}
                onClick={() => handleRowClick(bill)}
              >
                <TableCell className="font-medium">
                  {bill.doc_num || `#${bill.id}`}
                  {bill.source === "manual" && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {t("billsTable.manual")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{bill.vendor_name || "—"}</TableCell>
                <TableCell>{formatDate(bill.doc_date)}</TableCell>
                <TableCell>
                  <div>
                    {formatDate(bill.due_date)}
                    {isOverdue(bill) && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        {t("billStatus.overdue")}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatAmount(
                    bill.total_amount_including_vat ?? bill.total_amount,
                    "BGN"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {bill.has_vat
                    ? formatAmount(
                        bill.vat_amount_total ?? bill.vat_amount ?? 0,
                        "BGN"
                      )
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-green-600 dark:text-green-400">
                  {formatAmount(bill.total_paid, "BGN")}
                </TableCell>
                <TableCell className="text-right font-medium text-orange-600 dark:text-orange-400">
                  {formatAmount(bill.balance, "BGN")}
                </TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(bill)}
                </TableCell>
                <TableCell className="text-center">
                  {bill.attachment_count && bill.attachment_count > 0 ? (
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                      <span className="text-xs">{bill.attachment_count}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell onClick={handleActionClick}>
                  <TooltipProvider>
                    <div className="flex justify-center gap-2">
                      <div className="w-8">
                        {bill.balance > 0 && bill.status !== "voided" ? (
                          <RecordMultiBillPaymentDialog
                            initialLocationId={bill.location_id}
                            initialVendorId={bill.vendor_id || undefined}
                            initialBillId={bill.id}
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                title={t("billsTable.payBill")}
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                            }
                          />
                        ) : (
                          <div className="h-8 w-8" />
                        )}
                      </div>
                      <div className="w-8">
                        {bill.total_paid > 0 ? (
                          <BillPaymentHistoryDialog
                            billId={bill.id}
                            billNumber={bill.doc_num || `#${bill.id}`}
                          />
                        ) : (
                          <div className="h-8 w-8" />
                        )}
                      </div>
                      <div className="w-8">
                        {canEditBill(bill) ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleEditClick(bill.id)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("billsTable.editBill")}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <div className="h-8 w-8" />
                        )}
                      </div>
                      <div className="w-8">
                        {bill.status !== "voided" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700"
                                onClick={() => handleEditAccountsClick(bill.id)}
                              >
                                <BookOpen className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("billsTable.categorize")}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="w-8">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteClick(bill.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("billsTable.deleteBill")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {bills.length > 10 && (
        <div className="py-4">
          <DataTablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={bills.length}
            onPageChange={updatePageParam}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}

      {selectedBillForItems && (
        <BillItemsDialog
          open={itemsDialogOpen}
          onOpenChange={setItemsDialogOpen}
          billId={selectedBillForItems.id}
        />
      )}

      {billToEdit && (
        <EditBillDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          billId={billToEdit}
        />
      )}

      {billToEditAccounts && (
        <EditBillAccountsDialog
          open={accountsDialogOpen}
          onOpenChange={setAccountsDialogOpen}
          billId={billToEditAccounts}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("billsTable.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("billsTable.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t("billsTable.voidBill")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
