"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  generateRecurringBills,
  getPendingRecurringBills,
} from "@/lib/actions/recurring-bills";
import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import { useDateFormatter } from "@/lib/i18n/date-formatter";
import { PendingRecurringBill } from "@/lib/types/bill";
import { AlertCircle, CheckCircle2, Loader2, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface GenerateRecurringBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GenerateRecurringBillsDialog = ({
  open,
  onOpenChange,
}: GenerateRecurringBillsDialogProps) => {
  const { locale } = useLanguage();
  const { formatAmount } = useCurrency();
  const { formatDate } = useDateFormatter();

  const [pendingBills, setPendingBills] = useState<PendingRecurringBill[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{
    generated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const loadPendingBills = async () => {
    setIsLoading(true);
    const response = await getPendingRecurringBills();
    if (response.data) {
      setPendingBills(response.data);
      // Auto-select bills that don't already exist
      setSelectedIds(
        response.data.filter((b) => !b.already_exists).map((b) => b.template.id)
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (open) {
      loadPendingBills();
      setResult(null);
    }
  }, [open]);

  const handleToggleSelect = (templateId: number) => {
    setSelectedIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleSelectAll = () => {
    const selectableBills = pendingBills.filter((b) => !b.already_exists);
    if (selectedIds.length === selectableBills.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableBills.map((b) => b.template.id));
    }
  };

  const handleGenerate = async () => {
    if (selectedIds.length === 0) return;

    setIsGenerating(true);
    const response = await generateRecurringBills(selectedIds);
    setResult(response);
    setIsGenerating(false);

    // Reload to show updated state
    await loadPendingBills();
  };

  const selectableBills = pendingBills.filter((b) => !b.already_exists);
  const allSelected =
    selectableBills.length > 0 && selectedIds.length === selectableBills.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {locale === "bg" ? "Генериране на фактури" : "Generate Bills"}
          </DialogTitle>
          <DialogDescription>
            {locale === "bg"
              ? "Прегледай и избери кои периодични фактури да бъдат създадени"
              : "Review and select which recurring bills to generate"}
          </DialogDescription>
        </DialogHeader>

        {/* Result message */}
        {result && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 ${
              result.errors.length > 0
                ? "bg-yellow-50 dark:bg-yellow-950/20"
                : "bg-green-50 dark:bg-green-950/20"
            }`}
          >
            {result.errors.length > 0 ? (
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-medium">
                {locale === "bg"
                  ? `Създадени: ${result.generated}, Пропуснати: ${result.skipped}`
                  : `Generated: ${result.generated}, Skipped: ${result.skipped}`}
              </p>
              {result.errors.length > 0 && (
                <ul className="text-sm text-muted-foreground">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="flex-grow overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingBills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p>
                {locale === "bg"
                  ? "Няма фактури за генериране"
                  : "No bills pending generation"}
              </p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        disabled={selectableBills.length === 0}
                      />
                    </TableHead>
                    <TableHead>
                      {locale === "bg" ? "Локация" : "Location"}
                    </TableHead>
                    <TableHead>
                      {locale === "bg" ? "Доставчик" : "Vendor"}
                    </TableHead>
                    <TableHead>
                      {locale === "bg" ? "Период" : "Period"}
                    </TableHead>
                    <TableHead>
                      {locale === "bg" ? "Падеж" : "Due Date"}
                    </TableHead>
                    <TableHead className="text-right">
                      {locale === "bg" ? "Сума" : "Amount"}
                    </TableHead>
                    <TableHead>
                      {locale === "bg" ? "Статус" : "Status"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingBills.map((pending, index) => (
                    <TableRow
                      key={pending.template.id}
                      className={`${index % 2 === 0 ? "bg-muted/50" : ""} ${
                        pending.already_exists ? "opacity-50" : ""
                      }`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(pending.template.id)}
                          onCheckedChange={() =>
                            handleToggleSelect(pending.template.id)
                          }
                          disabled={pending.already_exists}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {pending.template.location_name}
                      </TableCell>
                      <TableCell>{pending.template.vendor_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {formatDate(pending.period_start)} -{" "}
                            {formatDate(pending.period_end)}
                          </span>
                          {pending.template.description && (
                            <span className="text-xs text-muted-foreground">
                              {pending.template.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(pending.due_date)}</TableCell>
                      <TableCell className="text-right">
                        {pending.template.default_amount > 0
                          ? formatAmount(pending.template.default_amount, "BGN")
                          : locale === "bg"
                          ? "Въведи ръчно"
                          : "Manual entry"}
                      </TableCell>
                      <TableCell>
                        {pending.already_exists ? (
                          <Badge variant="secondary">
                            {locale === "bg"
                              ? "Вече съществува"
                              : "Already exists"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600">
                            {locale === "bg"
                              ? "Готово за създаване"
                              : "Ready to create"}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <div className="flex-grow text-sm text-muted-foreground">
            {selectedIds.length > 0 && (
              <>
                {selectedIds.length} {locale === "bg" ? "избрани" : "selected"}
              </>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            {locale === "bg" ? "Затвори" : "Close"}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || selectedIds.length === 0}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {locale === "bg" ? "Генериране..." : "Generating..."}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                {locale === "bg"
                  ? `Генерирай ${selectedIds.length} фактури`
                  : `Generate ${selectedIds.length} Bill${
                      selectedIds.length > 1 ? "s" : ""
                    }`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
