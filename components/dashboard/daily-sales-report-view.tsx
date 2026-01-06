"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type PaymentType } from "@/lib/actions/payment-transactions";
import { type TipsWasteType } from "@/lib/actions/tips-waste-transactions";
import {
  getDailySalesReport,
  type DailySalesReport,
} from "@/lib/actions/sales-report";
import { cn } from "@/lib/utils";
import { getCurrentSofiaTime } from "@/lib/utils/timezone";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DateRange } from "react-day-picker";
import { PaymentTransactionsModal } from "./payment-transactions-modal";
import { SalesChart } from "./sales-chart";
import { TipsWasteTransactionsModal } from "./tips-waste-transactions-modal";
import { TransactionsChart } from "./transactions-chart";
import { WalletTransactionsModal } from "./wallet-transactions-modal";
import { ZeroAmountTransactionsModal } from "./zero-amount-transactions-modal";

const formatAmount = (amount: number): string => {
  if (amount >= 100) {
    return Math.round(amount).toLocaleString("en-US");
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (dateString: string): string => {
  if (!dateString) return "Invalid Date";

  // Handle YYYY-MM-DD format
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString; // Return as-is if not expected format

  const [year, month, day] = parts.map(Number);

  // Validate the parsed values
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return dateString; // Return as-is if parsing failed
  }

  const date = new Date(year, month - 1, day);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

interface Location {
  id: string;
  name: string;
}

interface DailySalesReportViewProps {
  locations: Location[];
}

export const DailySalesReportView = ({
  locations,
}: DailySalesReportViewProps) => {
  const [selectedLocationId, setSelectedLocationId] = useState<
    string | undefined
  >();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = getCurrentSofiaTime();
    return {
      from: subDays(now, 30),
      to: now,
    };
  });
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [reportData, setReportData] = useState<DailySalesReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [zeroAmountModalOpen, setZeroAmountModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] =
    useState<PaymentType>("cash");
  const [tipsWasteModalOpen, setTipsWasteModalOpen] = useState(false);
  const [selectedTipsWasteType, setSelectedTipsWasteType] =
    useState<TipsWasteType>("tips");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedRowDate, setSelectedRowDate] = useState<string | null>(null);
  const [dailyBreakdownLimit, setDailyBreakdownLimit] = useState<number>(30);
  const [useFiscalDate, setUseFiscalDate] = useState(true);
  const [excludeVat, setExcludeVat] = useState(true);
  const [excludeNoPayment, setExcludeNoPayment] = useState(true);

  const handlePresetClick = (preset: string) => {
    const now = getCurrentSofiaTime();
    let from: Date;
    let to: Date = now;

    switch (preset) {
      case "thisWeek":
        from = startOfWeek(now, { weekStartsOn: 1 });
        to = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "lastWeek":
        const lastWeek = subDays(now, 7);
        from = startOfWeek(lastWeek, { weekStartsOn: 1 });
        to = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      case "last7":
        from = subDays(now, 6);
        break;
      case "last30":
        from = subDays(now, 29);
        break;
      case "thisMonth":
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      case "thisYear":
        from = startOfYear(now);
        to = endOfYear(now);
        break;
      default:
        return;
    }

    setTempDateRange({ from, to });
  };

  const handleApply = () => {
    if (tempDateRange) {
      setDateRange(tempDateRange);
    }
    setIsPopoverOpen(false);
  };

  const handleClear = () => {
    setTempDateRange(undefined);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setTempDateRange(dateRange);
    }
    setIsPopoverOpen(open);
  };

  const loadReport = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      return;
    }

    setLoading(true);
    const startStr = format(dateRange.from, "yyyy-MM-dd");
    const endStr = format(dateRange.to, "yyyy-MM-dd");
    const result = await getDailySalesReport(
      startStr,
      endStr,
      selectedLocationId,
      useFiscalDate,
      excludeVat,
      excludeNoPayment
    );

    if (result.data) {
      setReportData(result.data);
    }

    setLoading(false);
  }, [dateRange, selectedLocationId, useFiscalDate, excludeVat, excludeNoPayment]);

  // Load data when dates or location change
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      loadReport();
    }
  }, [dateRange, loadReport]);

  const totals = reportData.reduce(
    (acc, day) => ({
      totalSales: acc.totalSales + day.totalSales,
      totalTransactions: acc.totalTransactions + day.totalTransactions,
      zeroAmountTransactions:
        acc.zeroAmountTransactions + day.zeroAmountTransactions,
      zeroAmountItemsSum: acc.zeroAmountItemsSum + day.zeroAmountItemsSum,
      regularSales: acc.regularSales + day.regularSales,
      regularTransactions: acc.regularTransactions + day.regularTransactions,
      cashSales: acc.cashSales + day.cashSales,
      cashTransactions: acc.cashTransactions + day.cashTransactions,
      cardSales: acc.cardSales + day.cardSales,
      cardTransactions: acc.cardTransactions + day.cardTransactions,
      invoiceSales: acc.invoiceSales + day.invoiceSales,
      invoiceTransactions: acc.invoiceTransactions + day.invoiceTransactions,
      compSales: acc.compSales + day.compSales,
      compTransactions: acc.compTransactions + day.compTransactions,
      walletSales: acc.walletSales + day.walletSales,
      walletTransactions: acc.walletTransactions + day.walletTransactions,
      noPaymentSales: acc.noPaymentSales + day.noPaymentSales,
      noPaymentTransactions:
        acc.noPaymentTransactions + day.noPaymentTransactions,
      tips: acc.tips + day.tips,
      waste: acc.waste + day.waste,
    }),
    {
      totalSales: 0,
      totalTransactions: 0,
      zeroAmountTransactions: 0,
      zeroAmountItemsSum: 0,
      regularSales: 0,
      regularTransactions: 0,
      cashSales: 0,
      cashTransactions: 0,
      cardSales: 0,
      cardTransactions: 0,
      invoiceSales: 0,
      invoiceTransactions: 0,
      compSales: 0,
      compTransactions: 0,
      walletSales: 0,
      walletTransactions: 0,
      noPaymentSales: 0,
      noPaymentTransactions: 0,
      tips: 0,
      waste: 0,
    }
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select date range and location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[0.8fr_1.4fr_1fr_1fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select
                value={selectedLocationId || "all"}
                onValueChange={(value) =>
                  setSelectedLocationId(value === "all" ? undefined : value)
                }
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <Popover open={isPopoverOpen} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 max-w-fit" align="start">
                  <div className="flex flex-col">
                    <div className="flex">
                      <div className="border-r p-3 space-y-0.5 w-[130px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start font-normal text-sm h-8 px-2 hover:bg-accent"
                          onClick={() => handlePresetClick("thisWeek")}
                        >
                          This Week
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start font-normal text-sm h-8 px-2 hover:bg-accent"
                          onClick={() => handlePresetClick("lastWeek")}
                        >
                          Last Week
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start font-normal text-sm h-8 px-2 hover:bg-accent"
                          onClick={() => handlePresetClick("last7")}
                        >
                          Last 7 Days
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start font-normal text-sm h-8 px-2 hover:bg-accent"
                          onClick={() => handlePresetClick("last30")}
                        >
                          Last 30 Days
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start font-normal text-sm h-8 px-2 hover:bg-accent"
                          onClick={() => handlePresetClick("thisMonth")}
                        >
                          This Month
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start font-normal text-sm h-8 px-2 hover:bg-accent"
                          onClick={() => handlePresetClick("lastMonth")}
                        >
                          Last Month
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start font-normal text-sm h-8 px-2 hover:bg-accent"
                          onClick={() => handlePresetClick("thisYear")}
                        >
                          This Year
                        </Button>
                      </div>
                      <div className="p-2">
                        <Calendar
                          mode="range"
                          defaultMonth={tempDateRange?.from}
                          selected={tempDateRange}
                          onSelect={setTempDateRange}
                          numberOfMonths={2}
                          initialFocus
                        />
                      </div>
                    </div>
                    <div className="border-t p-2 px-3 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {tempDateRange?.from && tempDateRange?.to ? (
                          <>
                            {format(tempDateRange.from, "MM/dd/yyyy")} -{" "}
                            {format(tempDateRange.to, "MM/dd/yyyy")}
                          </>
                        ) : (
                          <span>Select a date range</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClear}
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleApply}
                          disabled={!tempDateRange?.from || !tempDateRange?.to}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fiscal-date">Fiscal Date</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch
                  id="fiscal-date"
                  checked={useFiscalDate}
                  onCheckedChange={setUseFiscalDate}
                />
                <span className="text-sm text-muted-foreground">
                  {useFiscalDate ? "On (6:45 AM cutoff)" : "Off"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exclude-vat">Exclude VAT</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch
                  id="exclude-vat"
                  checked={excludeVat}
                  onCheckedChange={setExcludeVat}
                />
                <span className="text-sm text-muted-foreground">
                  {excludeVat ? "Net (excl. 20% VAT)" : "Gross"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exclude-no-payment">Exclude No Payment</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch
                  id="exclude-no-payment"
                  checked={excludeNoPayment}
                  onCheckedChange={setExcludeNoPayment}
                />
                <span className="text-sm text-muted-foreground">
                  {excludeNoPayment ? "Excluded" : "Included"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <>
          <SalesChart
            data={reportData}
            startDate={dateRange?.from}
            endDate={dateRange?.to}
          />
          <TransactionsChart
            data={reportData}
            startDate={dateRange?.from}
            endDate={dateRange?.to}
          />
        </>
      )}

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold whitespace-nowrap">
              {formatAmount(totals.totalSales)} BGN
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.totalTransactions.toLocaleString("en-US")} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold whitespace-nowrap text-green-600 dark:text-green-400">
              {formatAmount(totals.tips)} BGN
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              not included in total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Waste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold whitespace-nowrap text-red-600 dark:text-red-400">
              {formatAmount(totals.waste)} BGN
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              not included in total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Zero Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.zeroAmountTransactions.toLocaleString("en-US")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average/Day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold whitespace-nowrap">
              {reportData.length > 0
                ? formatAmount(totals.regularSales / reportData.length)
                : "0.00"}{" "}
              BGN
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {reportData.length} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Regular Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold whitespace-nowrap">
              {formatAmount(totals.regularSales)} BGN
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.regularTransactions.toLocaleString("en-US")} transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>Sales breakdown by payment type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "grid gap-4 md:grid-cols-2",
            excludeNoPayment ? "lg:grid-cols-3" : "lg:grid-cols-4"
          )}>
            <div className="border rounded-lg p-4">
              <div className="text-sm font-medium text-muted-foreground">
                Cash
              </div>
              <div className="text-2xl font-bold mt-2 whitespace-nowrap">
                {formatAmount(totals.cashSales)} BGN
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totals.cashTransactions.toLocaleString("en-US")} transactions
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm font-medium text-muted-foreground">
                Card
              </div>
              <div className="text-2xl font-bold mt-2 whitespace-nowrap">
                {formatAmount(totals.cardSales)} BGN
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totals.cardTransactions.toLocaleString("en-US")} transactions
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm font-medium text-muted-foreground">
                Wallet
              </div>
              <div className="text-2xl font-bold mt-2 whitespace-nowrap">
                {formatAmount(totals.walletSales)} BGN
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totals.walletTransactions.toLocaleString("en-US")} transactions
              </p>
            </div>
            {!excludeNoPayment && (
              <div className="border rounded-lg p-4">
                <div className="text-sm font-medium text-muted-foreground">
                  No Payment
                </div>
                <div className="text-2xl font-bold mt-2 whitespace-nowrap">
                  {formatAmount(totals.noPaymentSales)} BGN
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totals.noPaymentTransactions.toLocaleString("en-US")}{" "}
                  transactions
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Daily Breakdown</CardTitle>
              <CardDescription>Sales and transactions per day</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="daily-limit"
                className="text-sm text-muted-foreground"
              >
                Show:
              </Label>
              <Select
                value={dailyBreakdownLimit.toString()}
                onValueChange={(value) => setDailyBreakdownLimit(Number(value))}
              >
                <SelectTrigger id="daily-limit" className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : reportData.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No data for selected period
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Cash</TableHead>
                    <TableHead className="text-right">Card</TableHead>
                    <TableHead className="text-right">Wallet</TableHead>
                    {!excludeNoPayment && (
                      <TableHead className="text-right">No Payment</TableHead>
                    )}
                    <TableHead className="text-right">Tips</TableHead>
                    <TableHead className="text-right">Waste</TableHead>
                    <TableHead className="text-right">Zero Amt</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Total Trans.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData
                    .slice(0, dailyBreakdownLimit)
                    .map((day, index) => (
                      <TableRow
                        key={day.date}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedRowDate === day.date
                            ? "bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/40"
                            : index % 2 === 1
                            ? "bg-muted/50 hover:bg-muted"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() =>
                          setSelectedRowDate(
                            selectedRowDate === day.date ? null : day.date
                          )
                        }
                      >
                        <TableCell className="font-medium">
                          {formatDate(day.date)}
                        </TableCell>
                        <TableCell
                          className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(day.date);
                            setSelectedPaymentType("cash");
                            setPaymentModalOpen(true);
                          }}
                        >
                          <span className="underline decoration-dotted">
                            {formatAmount(day.cashSales)}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({day.cashTransactions})
                            </span>
                          </span>
                        </TableCell>
                        <TableCell
                          className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(day.date);
                            setSelectedPaymentType("card");
                            setPaymentModalOpen(true);
                          }}
                        >
                          <span className="underline decoration-dotted">
                            {formatAmount(day.cardSales)}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({day.cardTransactions})
                            </span>
                          </span>
                        </TableCell>
                        <TableCell
                          className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(day.date);
                            setWalletModalOpen(true);
                          }}
                        >
                          <span className="underline decoration-dotted">
                            {formatAmount(day.walletSales)}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({day.walletTransactions})
                            </span>
                          </span>
                        </TableCell>
                        {!excludeNoPayment && (
                          <TableCell
                            className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(day.date);
                              setSelectedPaymentType("no_payment");
                              setPaymentModalOpen(true);
                            }}
                          >
                            <span className="underline decoration-dotted">
                              {formatAmount(day.noPaymentSales)}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({day.noPaymentTransactions})
                              </span>
                            </span>
                          </TableCell>
                        )}
                        <TableCell
                          className="text-right text-green-600 dark:text-green-400 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(day.date);
                            setSelectedTipsWasteType("tips");
                            setTipsWasteModalOpen(true);
                          }}
                        >
                          <span className="underline decoration-dotted">
                            {formatAmount(day.tips)}
                          </span>
                        </TableCell>
                        <TableCell
                          className="text-right text-red-600 dark:text-red-400 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(day.date);
                            setSelectedTipsWasteType("waste");
                            setTipsWasteModalOpen(true);
                          }}
                        >
                          <span className="underline decoration-dotted">
                            {formatAmount(day.waste)}
                          </span>
                        </TableCell>
                        <TableCell
                          className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(day.date);
                            setZeroAmountModalOpen(true);
                          }}
                        >
                          <span className="underline decoration-dotted">
                            {formatAmount(day.zeroAmountItemsSum)}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({day.zeroAmountTransactions})
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">
                          {formatAmount(day.totalSales)} BGN
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {day.totalTransactions.toLocaleString("en-US")}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ZeroAmountTransactionsModal
        open={zeroAmountModalOpen}
        onOpenChange={setZeroAmountModalOpen}
        date={selectedDate}
        locationId={selectedLocationId}
        useFiscalDate={useFiscalDate}
        excludeVat={excludeVat}
        excludeNoPayment={excludeNoPayment}
      />

      <WalletTransactionsModal
        open={walletModalOpen}
        onOpenChange={setWalletModalOpen}
        date={selectedDate}
        locationId={selectedLocationId}
        useFiscalDate={useFiscalDate}
        excludeVat={excludeVat}
        excludeNoPayment={excludeNoPayment}
      />

      <PaymentTransactionsModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        date={selectedDate}
        paymentType={selectedPaymentType}
        locationId={selectedLocationId}
        useFiscalDate={useFiscalDate}
        excludeVat={excludeVat}
        excludeNoPayment={excludeNoPayment}
      />

      <TipsWasteTransactionsModal
        open={tipsWasteModalOpen}
        onOpenChange={setTipsWasteModalOpen}
        date={selectedDate}
        type={selectedTipsWasteType}
        locationId={selectedLocationId}
        useFiscalDate={useFiscalDate}
        excludeVat={excludeVat}
      />
    </div>
  );
};
