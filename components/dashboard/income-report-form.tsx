"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  BillBreakdown,
  submitIncomeReport,
  updateIncomeReport,
} from "@/lib/actions/employee-income";
import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import { useDateFormatter } from "@/lib/i18n/date-formatter";
import { cn } from "@/lib/utils";
import {
  getCurrentBusinessDate,
  isInNextDayPeriod,
} from "@/lib/utils/business-date";
import { collectSubmissionMetadata } from "@/lib/utils/submission-metadata";
import { formatSofiaTime } from "@/lib/utils/timezone";
import {
  Banknote,
  CalendarIcon,
  Coins,
  CreditCard,
  MessageSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Location {
  id: number;
  name: string;
}

interface EditReport {
  id: number;
  location_id: number;
  business_date: string;
  bill_breakdown: {
    under_5_total: number;
    count_5: number;
    count_10: number;
    count_20: number;
    count_50: number;
    count_100: number;
    count_200: number;
  };
  cash_tips: number;
  card_sales: number;
  card_tips: number;
  note: string | null;
}

interface IncomeReportFormProps {
  locations: Location[];
  onSuccess?: () => void;
  editingReport?: EditReport | null;
  onCancelEdit?: () => void;
}

export const IncomeReportForm = ({
  locations,
  onSuccess,
  editingReport,
  onCancelEdit,
}: IncomeReportFormProps) => {
  const { t } = useLanguage();
  const { formatAmount, getCurrencySymbol } = useCurrency();
  const { formatDate } = useDateFormatter();

  const [selectedLocation, setSelectedLocation] = useState<number | null>(
    editingReport
      ? editingReport.location_id
      : locations.length === 1
      ? locations[0].id
      : null
  );
  const [businessDate, setBusinessDate] = useState(
    editingReport ? editingReport.business_date : getCurrentBusinessDate()
  );

  // Bill breakdown
  const [under5Total, setUnder5Total] = useState(
    editingReport ? editingReport.bill_breakdown.under_5_total.toString() : ""
  );
  const [count5, setCount5] = useState(
    editingReport ? editingReport.bill_breakdown.count_5.toString() : ""
  );
  const [count10, setCount10] = useState(
    editingReport ? editingReport.bill_breakdown.count_10.toString() : ""
  );
  const [count20, setCount20] = useState(
    editingReport ? editingReport.bill_breakdown.count_20.toString() : ""
  );
  const [count50, setCount50] = useState(
    editingReport ? editingReport.bill_breakdown.count_50.toString() : ""
  );
  const [count100, setCount100] = useState(
    editingReport ? editingReport.bill_breakdown.count_100.toString() : ""
  );
  const [count200, setCount200] = useState(
    editingReport ? editingReport.bill_breakdown.count_200.toString() : ""
  );

  // Other income
  const [cashTips, setCashTips] = useState(
    editingReport ? editingReport.cash_tips.toString() : ""
  );
  const [cardSales, setCardSales] = useState(
    editingReport ? editingReport.card_sales.toString() : ""
  );
  const [cardTips, setCardTips] = useState(
    editingReport ? editingReport.card_tips.toString() : ""
  );
  const [note, setNote] = useState(editingReport?.note || "");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const currentTime = new Date();
  const isNextDayPeriod = isInNextDayPeriod(currentTime);

  // Calculate cash total from bill breakdown
  const calculateCashTotal = () => {
    const under5 = parseFloat(under5Total) || 0;
    const bills5 = (parseFloat(count5) || 0) * 5;
    const bills10 = (parseFloat(count10) || 0) * 10;
    const bills20 = (parseFloat(count20) || 0) * 20;
    const bills50 = (parseFloat(count50) || 0) * 50;
    const bills100 = (parseFloat(count100) || 0) * 100;
    const bills200 = (parseFloat(count200) || 0) * 200;

    return under5 + bills5 + bills10 + bills20 + bills50 + bills100 + bills200;
  };

  const cashTotal = calculateCashTotal();
  const grandTotal =
    cashTotal +
    (parseFloat(cashTips) || 0) +
    (parseFloat(cardSales) || 0) +
    (parseFloat(cardTips) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedLocation) {
      setError(t("incomeForm.selectLocation"));
      return;
    }

    setIsLoading(true);

    const billBreakdown: BillBreakdown = {
      under_5_total: parseFloat(under5Total) || 0,
      count_5: parseInt(count5) || 0,
      count_10: parseInt(count10) || 0,
      count_20: parseInt(count20) || 0,
      count_50: parseInt(count50) || 0,
      count_100: parseInt(count100) || 0,
      count_200: parseInt(count200) || 0,
    };

    // Collect submission metadata (browser, device, geolocation, etc.)
    const submissionMetadata = await collectSubmissionMetadata(true);

    const reportData = {
      locationId: selectedLocation,
      businessDate,
      billBreakdown,
      cashTips: parseFloat(cashTips) || 0,
      cardSales: parseFloat(cardSales) || 0,
      cardTips: parseFloat(cardTips) || 0,
      note: note.trim() || undefined,
      submissionMetadata,
    };

    const result = editingReport
      ? await updateIncomeReport(editingReport.id, reportData)
      : await submitIncomeReport(reportData);

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(
        editingReport
          ? t("incomeForm.updateSuccess")
          : t("incomeForm.submitSuccess")
      );

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Reset form after a delay
      setTimeout(() => {
        setUnder5Total("");
        setCount5("");
        setCount10("");
        setCount20("");
        setCount50("");
        setCount100("");
        setCount200("");
        setCashTips("");
        setCardSales("");
        setCardTips("");
        setNote("");
        setSuccess("");
      }, 2000);

      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isNextDayPeriod && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 border border-yellow-200 dark:border-yellow-800">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>{t("incomeForm.note")}:</strong>{" "}
            {t("incomeForm.nextDayNote", {
              time: formatSofiaTime(currentTime, "HH:mm"),
              date: businessDate,
            })}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="location" className="text-sm">
            {t("incomeForm.location")}
          </Label>
          <Select
            value={selectedLocation?.toString()}
            onValueChange={(val) => setSelectedLocation(Number(val))}
            disabled={isLoading}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder={t("incomeForm.selectLocation")} />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id.toString()}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="businessDate" className="text-sm">
            {t("incomeForm.businessDate")}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="businessDate"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-10",
                  !businessDate && "text-muted-foreground"
                )}
                disabled={isLoading}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {businessDate ? (
                  formatDate(new Date(businessDate), "MMM dd, yyyy")
                ) : (
                  <span>{t("incomeForm.pickDate")}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={businessDate ? new Date(businessDate) : undefined}
                onSelect={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const day = String(date.getDate()).padStart(2, "0");
                    setBusinessDate(`${year}-${month}-${day}`);
                  }
                }}
                weekStartsOn={1}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {selectedLocation && (
        <>
          <Separator className="my-3" />

          {/* Cash Total Display - Sticky */}
          <Card className="bg-primary text-primary-foreground sticky top-4 z-10 shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90">
                    {t("incomeForm.cashTotal")}
                  </p>
                  <p className="text-2xl font-bold">
                    {formatAmount(cashTotal, "BGN")} {getCurrencySymbol("BGN")}
                  </p>
                </div>
                <Coins className="h-10 w-10 opacity-80" />
              </div>
            </CardContent>
          </Card>

          {/* Bill Denominations */}
          <Card>
            <CardHeader className="pb-3 pt-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                {t("incomeForm.cashBreakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              {/* Bill Denominations */}
              <div className="grid gap-2 sm:grid-cols-2">
                {/* Under 5 BGN - Coins & Small */}
                <div className="flex items-center justify-between gap-2 py-1 sm:col-span-2">
                  <Label className="text-sm font-medium whitespace-nowrap">
                    {t("incomeForm.coinsSmall")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={under5Total}
                      onChange={(e) => setUnder5Total(e.target.value)}
                      disabled={isLoading}
                      placeholder="0.00"
                      className="h-9 w-20"
                    />
                    <span className="w-16"></span>
                  </div>
                </div>

                {[
                  { value: 5, count: count5, setter: setCount5 },
                  { value: 10, count: count10, setter: setCount10 },
                  { value: 20, count: count20, setter: setCount20 },
                  { value: 50, count: count50, setter: setCount50 },
                  { value: 100, count: count100, setter: setCount100 },
                  { value: 200, count: count200, setter: setCount200 },
                ].map(({ value, count, setter }) => {
                  const subtotal = (parseInt(count) || 0) * value;
                  return (
                    <div
                      key={value}
                      className="flex items-center justify-between gap-2 py-1"
                    >
                      <Label className="text-sm font-medium">
                        {formatAmount(value, "BGN")} {getCurrencySymbol("BGN")}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={count}
                          onChange={(e) => setter(e.target.value)}
                          disabled={isLoading}
                          placeholder="0"
                          className="h-9 w-20"
                        />
                        <span className="text-xs text-muted-foreground w-16 text-right">
                          {subtotal > 0 ? subtotal.toFixed(0) : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Separator className="my-3" />

          {/* Tips and Card Sales */}
          <Card>
            <CardHeader className="pb-3 pt-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t("incomeForm.tipsCardSales")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div className="flex items-center justify-between gap-3 py-1">
                <Label className="text-sm font-medium">
                  {t("incomeForm.cashTips")}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={cashTips}
                  onChange={(e) => setCashTips(e.target.value)}
                  disabled={isLoading}
                  placeholder="0.00"
                  className="h-9 w-32"
                />
              </div>

              <div className="flex items-center justify-between gap-3 py-1">
                <Label className="text-sm font-medium">
                  {t("incomeForm.cardPosSales")}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={cardSales}
                  onChange={(e) => setCardSales(e.target.value)}
                  disabled={isLoading}
                  placeholder="0.00"
                  className="h-9 w-32"
                />
              </div>

              <div className="flex items-center justify-between gap-3 py-1">
                <Label className="text-sm font-medium">
                  {t("incomeForm.cardPosTips")}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={cardTips}
                  onChange={(e) => setCardTips(e.target.value)}
                  disabled={isLoading}
                  placeholder="0.00"
                  className="h-9 w-32"
                />
              </div>
            </CardContent>
          </Card>

          <Separator className="my-3" />

          {/* Note */}
          <Card>
            <CardHeader className="pb-3 pt-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("incomeForm.note")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isLoading}
                placeholder={t("incomeForm.notePlaceholder")}
                className="min-h-[80px] resize-none"
              />
            </CardContent>
          </Card>

          <Separator className="my-3" />

          {/* Grand Total */}
          <Card className="bg-secondary">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("incomeForm.totalIncome")}
                  </p>
                  <p className="text-xl font-bold">
                    {formatAmount(grandTotal, "BGN")} {getCurrencySymbol("BGN")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              {success}
            </div>
          )}

          <div className="flex gap-2">
            {editingReport && onCancelEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancelEdit}
                disabled={isLoading}
                className="flex-1 h-10"
              >
                {t("common.cancel")}
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || !selectedLocation}
              className={cn(
                "h-10 font-semibold",
                editingReport ? "flex-1" : "w-full",
                !editingReport &&
                  "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              )}
            >
              {isLoading
                ? editingReport
                  ? t("incomeForm.updating")
                  : t("incomeForm.submitting")
                : editingReport
                ? t("incomeForm.updateReport")
                : t("incomeForm.reportSales")}
            </Button>
          </div>
        </>
      )}
    </form>
  );
};
