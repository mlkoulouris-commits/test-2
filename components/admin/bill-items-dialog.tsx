"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBillDetails, getBillItems } from "@/lib/actions/bills";
import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import { useDateFormatter } from "@/lib/i18n/date-formatter";
import { useEffect, useState } from "react";
import { AttachmentsList } from "./attachments-list";
import { FileUpload } from "./file-upload";

interface BillItem {
  id: number;
  barsy_article_id: number | null;
  article_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  amount_type: string | null;
  account_id: number | null;
  account_code?: string | null;
  account_name?: string | null;
  vat_rate?: number | null;
  vat_amount?: number | null;
}

interface BillDetails {
  id: number;
  source: "barsy" | "manual";
  doc_num: string | null;
  doc_date: string | null;
  vendor_name: string | null;
  location_id: number;
  location_name: string | null;
  total_amount: number;
  total_paid: number;
  balance: number;
  status: "approved" | "partially_paid" | "paid" | "voided";
  due_date: string | null;
  description: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  account_id?: number | null;
  account_code?: string | null;
  account_name?: string | null;
  vendor_default_account_id?: number | null;
  vendor_default_account_code?: string | null;
  vendor_default_account_name?: string | null;
  has_vat?: boolean;
  vat_rate?: number | null;
  vat_amount?: number | null;
}

interface BillItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: number;
}

export const BillItemsDialog = ({
  open,
  onOpenChange,
  billId,
}: BillItemsDialogProps) => {
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();
  const { formatDate: formatDateLocale } = useDateFormatter();
  const [items, setItems] = useState<BillItem[]>([]);
  const [billDetails, setBillDetails] = useState<BillDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshAttachments, setRefreshAttachments] = useState(0);

  useEffect(() => {
    if (open && billId) {
      setLoading(true);
      Promise.all([getBillItems(billId), getBillDetails(billId)]).then(
        ([itemsResult, detailsResult]) => {
          if (itemsResult.data) {
            setItems(itemsResult.data);
          }
          if (detailsResult.data) {
            setBillDetails(detailsResult.data as BillDetails);
          }
          setLoading(false);
        }
      );
    }
  }, [open, billId]);

  const itemsTotal = items.reduce(
    (sum, item) => sum + (item.total_price || 0),
    0
  );
  const totalAmount = billDetails ? Number(billDetails.total_amount || 0) : 0;
  const totalPaid = billDetails ? Number(billDetails.total_paid || 0) : 0;
  const balance = billDetails ? Number(billDetails.balance || 0) : 0;

  // Calculate VAT totals
  const hasVat = billDetails?.has_vat || false;
  const billVatAmount = billDetails?.vat_amount ? Number(billDetails.vat_amount) : 0;
  const itemsVatTotal = items.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0);
  const totalVatAmount = billVatAmount > 0 ? billVatAmount : itemsVatTotal;
  const grandTotal = totalAmount + totalVatAmount;
  const hasAnyItemAccount = items.some((item) => Boolean(item.account_code));
  const hasBillAccount = Boolean(billDetails?.account_code);
  const hasVendorDefaultAccount = Boolean(billDetails?.vendor_default_account_code);

  const effectiveAccountCode =
    billDetails?.account_code ||
    billDetails?.vendor_default_account_code ||
    null;
  const effectiveAccountName =
    billDetails?.account_name ||
    billDetails?.vendor_default_account_name ||
    null;
  const effectiveAccountSource = hasBillAccount
    ? "bill"
    : hasVendorDefaultAccount
    ? "vendor"
    : null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return formatDateLocale(date, "MMM d, yyyy");
  };

  const getStatusBadge = () => {
    if (!billDetails) return null;

    const statusLabels = {
      paid: t("billStatus.paid"),
      partially_paid: t("billStatus.partiallyPaid"),
      approved: t("billStatus.approved"),
      voided: t("billStatus.voided"),
    };

    return (
      <StatusBadge
        status={billDetails.status}
        labels={statusLabels}
        className={
          billDetails.status === "approved"
            ? "bg-blue-600 hover:bg-blue-700"
            : ""
        }
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-7xl w-[90vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl">
            {t("billDialog.bill")} {billDetails?.doc_num || `#${billId}`}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : billDetails ? (
          <Tabs
            defaultValue="details"
            className="flex flex-col flex-1 overflow-hidden"
          >
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="details">
                {t("billDialog.billDetails")}
              </TabsTrigger>
              <TabsTrigger value="attachments">
                {t("billDialog.files")}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="details"
              className="space-y-6 overflow-y-auto overflow-x-hidden pr-2 flex-1 mt-4"
            >
              {/* Bill Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("billDialog.vendor")}
                  </div>
                  <div className="font-medium text-sm">
                    {billDetails.vendor_name || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("billDialog.location")}
                  </div>
                  <div className="font-medium text-sm">
                    {billDetails.location_name || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("billDialog.source")}
                  </div>
                  <div className="font-medium text-sm">
                    {billDetails.source === "barsy"
                      ? t("billDialog.sourceBarsy")
                      : t("billDialog.sourceManual")}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("billDialog.billDate")}
                  </div>
                  <div className="font-medium text-sm">
                    {formatDate(billDetails.doc_date)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("billDialog.dueDate")}
                  </div>
                  <div className="font-medium text-sm">
                    {formatDate(billDetails.due_date)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("billDialog.dateEntered")}
                  </div>
                  <div className="font-medium text-sm">
                    {formatDate(billDetails.created_at)}
                  </div>
                </div>

                {billDetails.approved_at && (
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {t("billDialog.approvedDate")}
                    </div>
                    <div className="font-medium text-sm">
                      {formatDate(billDetails.approved_at)}
                    </div>
                  </div>
                )}

                {billDetails.approved_by && (
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {t("billDialog.approvedBy")}
                    </div>
                    <div className="font-medium text-sm">
                      {billDetails.approved_by}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("common.status")}
                  </div>
                  <div className="mt-1">{getStatusBadge()}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("billDialog.totalAmount")}
                  </div>
                  <div className="font-semibold text-base">
                    {formatAmount(totalAmount, "BGN")}
                  </div>
                </div>

                {hasVat && totalVatAmount > 0 && (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        VAT {billDetails?.vat_rate ? `(${billDetails.vat_rate}%)` : ""}
                      </div>
                      <div className="font-semibold text-base text-amber-600 dark:text-amber-400">
                        {formatAmount(totalVatAmount, "BGN")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Grand Total
                      </div>
                      <div className="font-semibold text-base text-amber-700 dark:text-amber-300">
                        {formatAmount(grandTotal, "BGN")}
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("billsTable.paid")}
                  </div>
                  <div className="font-semibold text-base text-green-600 dark:text-green-400">
                    {formatAmount(totalPaid, "BGN")}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("billsTable.balance")}
                  </div>
                  <div className="font-semibold text-base text-orange-600 dark:text-orange-400">
                    {formatAmount(balance, "BGN")}
                  </div>
                </div>

                {billDetails.description && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <div className="text-xs text-muted-foreground">
                      {t("billDialog.description")}
                    </div>
                    <div className="font-medium text-sm">
                      {billDetails.description}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Bill Account */}
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {t("billDialog.billAccount")}
                    </div>
                    {effectiveAccountCode ? (
                      <div className="font-medium text-sm">
                        <span className="font-mono text-purple-600 dark:text-purple-400">
                          {effectiveAccountCode}
                        </span>
                        {effectiveAccountName ? (
                          <>
                            {" - "}
                            {effectiveAccountName}
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {t("billDialog.noAccountAssigned")}
                      </div>
                    )}
                    {!hasBillAccount && hasAnyItemAccount && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {t("billDialog.itemAccountsHint")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {effectiveAccountSource === "vendor" && (
                      <span className="text-xs text-muted-foreground">
                        {t("billDialog.vendorDefault")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h3 className="text-base font-semibold mb-3">
                  {t("billDialog.billItems")}
                </h3>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("billDialog.noItems")}
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full border-collapse min-w-[700px]">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[30%]">
                              {t("billDialog.articleName")}
                            </th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground w-[12%]">
                              {t("billDialog.quantity")}
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[8%]">
                              {t("billDialog.unit")}
                            </th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground w-[15%]">
                              {t("billDialog.unitPrice")}
                            </th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground w-[15%]">
                              {t("billDialog.totalPrice")}
                            </th>
                            {hasVat && items.some(item => item.vat_rate !== null) && (
                              <>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground w-[10%]">
                                  VAT Rate (%)
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground w-[12%]">
                                  VAT Amount
                                </th>
                              </>
                            )}
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[20%]">
                              {t("billDialog.account")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr
                              key={item.id}
                              className={`border-b transition-colors hover:bg-muted/50 ${
                                idx % 2 === 0 ? "" : "bg-muted/30"
                              }`}
                            >
                              <td className="p-4 align-middle text-sm font-medium">
                                <div
                                  className="truncate"
                                  title={item.article_name || "—"}
                                >
                                  {item.article_name || "—"}
                                </div>
                              </td>
                              <td className="p-4 align-middle text-sm text-right">
                                {Number(item.quantity || 0).toFixed(2)}
                              </td>
                              <td className="p-4 align-middle text-sm">
                                {item.amount_type || "—"}
                              </td>
                              <td className="p-4 align-middle text-sm text-right whitespace-nowrap">
                                {formatAmount(
                                  Number(item.unit_price || 0),
                                  "BGN"
                                )}
                              </td>
                              <td className="p-4 align-middle text-sm text-right font-medium whitespace-nowrap">
                                {formatAmount(
                                  Number(item.total_price || 0),
                                  "BGN"
                                )}
                              </td>
                              {hasVat && items.some(item => item.vat_rate !== null) && (
                                <>
                                  <td className="p-4 align-middle text-sm text-right">
                                    {item.vat_rate ? `${Number(item.vat_rate).toFixed(2)}%` : "—"}
                                  </td>
                                  <td className="p-4 align-middle text-sm text-right font-medium whitespace-nowrap">
                                    {item.vat_amount ? formatAmount(Number(item.vat_amount), "BGN") : "—"}
                                  </td>
                                </>
                              )}
                              <td className="p-4 align-middle text-sm">
                                {item.account_code ? (
                                  <span
                                    className="text-purple-600 dark:text-purple-400"
                                    title={item.account_name || ""}
                                  >
                                    <span className="font-mono">
                                      {item.account_code}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-muted/50 font-semibold border-b">
                            <td
                              colSpan={hasVat && items.some(item => item.vat_rate !== null) ? 4 : 4}
                              className="p-4 align-middle text-sm text-right"
                            >
                              {t("billDialog.total")}:
                            </td>
                            <td className="p-4 align-middle text-base text-right whitespace-nowrap">
                              {formatAmount(itemsTotal, "BGN")}
                            </td>
                            {hasVat && items.some(item => item.vat_rate !== null) && (
                              <>
                                <td></td>
                                <td className="p-4 align-middle text-base text-right whitespace-nowrap">
                                  {formatAmount(itemsVatTotal, "BGN")}
                                </td>
                              </>
                            )}
                            <td></td>
                          </tr>
                          {hasVat && totalVatAmount > 0 && (
                            <tr className="bg-amber-50 dark:bg-amber-950/30 font-semibold border-b">
                              <td
                                colSpan={hasVat && items.some(item => item.vat_rate !== null) ? 5 : 4}
                                className="p-4 align-middle text-sm text-right"
                              >
                                Total VAT:
                              </td>
                              <td className="p-4 align-middle text-base text-right whitespace-nowrap text-amber-700 dark:text-amber-300">
                                {formatAmount(totalVatAmount, "BGN")}
                              </td>
                              {hasVat && items.some(item => item.vat_rate !== null) && <td></td>}
                              <td></td>
                            </tr>
                          )}
                          {hasVat && grandTotal > 0 && (
                            <tr className="bg-amber-100 dark:bg-amber-900/40 font-bold border-b-2 border-amber-600 dark:border-amber-500">
                              <td
                                colSpan={hasVat && items.some(item => item.vat_rate !== null) ? 5 : 4}
                                className="p-4 align-middle text-base text-right"
                              >
                                Grand Total:
                              </td>
                              <td className="p-4 align-middle text-lg text-right whitespace-nowrap text-amber-800 dark:text-amber-200">
                                {formatAmount(grandTotal, "BGN")}
                              </td>
                              {hasVat && items.some(item => item.vat_rate !== null) && <td></td>}
                              <td></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="attachments"
              className="space-y-4 overflow-y-auto overflow-x-hidden pr-2 flex-1 mt-4"
            >
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold mb-3">
                    {t("billDialog.uploadFiles")}
                  </h3>
                  <FileUpload
                    entityType="bill"
                    entityId={billId.toString()}
                    locationId={billDetails.location_id.toString()}
                    onUploadComplete={() =>
                      setRefreshAttachments((prev) => prev + 1)
                    }
                  />
                </div>

                <Separator />

                <div>
                  <h3 className="text-base font-semibold mb-3">
                    {t("billDialog.attachedFiles")}
                  </h3>
                  <AttachmentsList
                    entityType="bill"
                    entityId={billId.toString()}
                    refreshTrigger={refreshAttachments}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
