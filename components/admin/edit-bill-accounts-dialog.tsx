"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BillItem,
  getBillDetails,
  getBillItems,
  updateBillAccounts,
} from "@/lib/actions/bills";
import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import { BookOpen, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountSelector } from "./account-selector";

interface BillDetails {
  id: number;
  source: "barsy" | "manual";
  doc_num: string | null;
  vendor_name: string | null;
  location_name: string | null;
  total_amount: number;
  account_id: number | null;
  account_code: string | null;
  account_name: string | null;
  vendor_default_account_id: number | null;
}

interface EditBillAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: number;
  onSuccess?: () => void;
}

export const EditBillAccountsDialog = ({
  open,
  onOpenChange,
  billId,
  onSuccess,
}: EditBillAccountsDialogProps) => {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { formatAmount } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [billDetails, setBillDetails] = useState<BillDetails | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);

  // Form state
  const [billAccountId, setBillAccountId] = useState<number | null>(null);
  const [itemAccounts, setItemAccounts] = useState<Map<number, number | null>>(
    new Map()
  );

  useEffect(() => {
    if (open && billId) {
      loadData();
    }
  }, [open, billId]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [detailsResult, itemsResult] = await Promise.all([
        getBillDetails(billId),
        getBillItems(billId),
      ]);

      if (detailsResult.data) {
        setBillDetails(detailsResult.data as BillDetails);
        setBillAccountId(detailsResult.data.account_id || null);
      }

      if (itemsResult.data) {
        setItems(itemsResult.data);
        // Initialize item accounts
        const accountsMap = new Map<number, number | null>();
        itemsResult.data.forEach((item) => {
          accountsMap.set(item.id, item.account_id);
        });
        setItemAccounts(accountsMap);
      }
    } catch (e) {
      setError("Failed to load bill details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    // Build items update array
    const itemsToUpdate = items.map((item) => ({
      id: item.id,
      accountId: itemAccounts.get(item.id) ?? null,
    }));

    const result = await updateBillAccounts(billId, {
      accountId: billAccountId,
      items: itemsToUpdate,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
    } else {
      setSaving(false);
      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    }
  };

  const updateItemAccount = (itemId: number, accountId: number | null) => {
    setItemAccounts((prev) => {
      const next = new Map(prev);
      next.set(itemId, accountId);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-4xl w-[90vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {locale === "bg" ? "Категоризиране на фактура" : "Categorize Bill"}
          </DialogTitle>
          <DialogDescription>
            {locale === "bg"
              ? "Задай сметка от сметкоплан за цялата фактура или за отделни артикули"
              : "Assign chart of accounts for the entire bill or individual items"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : billDetails ? (
          <div className="flex flex-col flex-grow overflow-hidden space-y-4">
            {/* Bill Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg flex-shrink-0">
              <div>
                <div className="text-xs text-muted-foreground">
                  {locale === "bg" ? "Номер" : "Bill #"}
                </div>
                <div className="font-medium">
                  {billDetails.doc_num || `#${billId}`}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  {locale === "bg" ? "Доставчик" : "Vendor"}
                </div>
                <div className="font-medium">
                  {billDetails.vendor_name || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  {locale === "bg" ? "Локация" : "Location"}
                </div>
                <div className="font-medium">
                  {billDetails.location_name || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  {locale === "bg" ? "Сума" : "Amount"}
                </div>
                <div className="font-semibold">
                  {formatAmount(billDetails.total_amount, "BGN")}
                </div>
              </div>
              <div className="col-span-2 md:col-span-4">
                <div className="text-xs text-muted-foreground mb-1">
                  {locale === "bg" ? "Източник" : "Source"}
                </div>
                <Badge
                  variant={
                    billDetails.source === "barsy" ? "secondary" : "outline"
                  }
                >
                  {billDetails.source === "barsy"
                    ? "Barsy"
                    : locale === "bg"
                    ? "Ръчно въведена"
                    : "Manual"}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Bill-level Account */}
            <div className="space-y-2 flex-shrink-0">
              <Label className="text-base font-semibold">
                {locale === "bg"
                  ? "Сметка за цялата фактура"
                  : "Account for Entire Bill"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {locale === "bg"
                  ? "Тази сметка ще се използва за всички артикули, които нямат индивидуална сметка"
                  : "This account will be used for all items without individual account assignments"}
              </p>
              <AccountSelector
                value={billAccountId}
                onChange={setBillAccountId}
                placeholder={
                  locale === "bg" ? "Избери сметка..." : "Select account..."
                }
              />
            </div>

            <Separator />

            {/* Line Item Accounts */}
            <div className="flex-grow overflow-hidden flex flex-col">
              <Label className="text-base font-semibold mb-2 flex-shrink-0">
                {locale === "bg" ? "Сметки по артикули" : "Item Accounts"}
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  (
                  {locale === "bg"
                    ? "опционално - за различни сметки по артикули"
                    : "optional - for different accounts per item"}
                  )
                </span>
              </Label>

              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {locale === "bg" ? "Няма артикули" : "No items found"}
                </div>
              ) : (
                <div className="flex-grow overflow-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">
                          {locale === "bg" ? "Артикул" : "Item"}
                        </TableHead>
                        <TableHead className="w-[15%] text-right">
                          {locale === "bg" ? "Количество" : "Qty"}
                        </TableHead>
                        <TableHead className="w-[15%] text-right">
                          {locale === "bg" ? "Сума" : "Amount"}
                        </TableHead>
                        <TableHead className="w-[30%]">
                          {locale === "bg" ? "Сметка" : "Account"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow
                          key={item.id}
                          className={idx % 2 === 0 ? "bg-muted/30" : ""}
                        >
                          <TableCell className="font-medium">
                            <div
                              className="truncate"
                              title={item.article_name || "—"}
                            >
                              {item.article_name || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.quantity || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {formatAmount(Number(item.total_price || 0), "BGN")}
                          </TableCell>
                          <TableCell>
                            <AccountSelector
                              value={itemAccounts.get(item.id) ?? null}
                              onChange={(accountId) =>
                                updateItemAccount(item.id, accountId)
                              }
                              placeholder={
                                locale === "bg" ? "По подр." : "Default"
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {error && (
              <div className="text-destructive text-sm flex-shrink-0">
                {error}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save className="h-4 w-4 mr-2" />
            {saving
              ? locale === "bg"
                ? "Запазване..."
                : "Saving..."
              : locale === "bg"
              ? "Запази"
              : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
