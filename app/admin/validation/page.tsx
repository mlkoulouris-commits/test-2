"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { format, subDays } from "date-fns";
import { CalendarIcon, CheckCircle2, XCircle, Receipt, Percent, HandCoins, Trash2, ShoppingCart, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import { cn } from "@/lib/utils";
import {
  getValidationData,
  getValidationLocations,
  type ValidationData,
  type CategorySalesRow,
  type ArticleSalesRow,
  type PaymentMethodFilter,
} from "@/lib/actions/validation";

// Default location ID for Memento NDK
const DEFAULT_LOCATION_ID = "382064d5-1542-487a-a566-db269d83526d";

export default function ValidationPage() {
  const { locale, t } = useLanguage();
  const { formatAmount } = useCurrency();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ValidationData | null>(null);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  // Filters
  const [selectedDate, setSelectedDate] = useState<Date>(subDays(new Date(), 1));
  const [locationId, setLocationId] = useState<string>(DEFAULT_LOCATION_ID);

  // Display options
  const [excludeVat, setExcludeVat] = useState(true);
  const [excludeTipsWaste, setExcludeTipsWaste] = useState(true);
  const [excludeNoPayment, setExcludeNoPayment] = useState(true);
  const [useFiscalDate, setUseFiscalDate] = useState(true);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>("all");
  const [showCOS, setShowCOS] = useState(false);

  // Expanded categories for article breakdown
  const [expandedCategories, setExpandedCategories] = useState<Set<number | null>>(new Set());

  const toggleCategory = (categoryId: number | null) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Load locations on mount
  useEffect(() => {
    loadLocations();
  }, []);

  // Load data when filters change
  useEffect(() => {
    if (locationId) {
      loadData();
    }
  }, [selectedDate, locationId, useFiscalDate, paymentMethodFilter]);

  const loadLocations = async () => {
    const result = await getValidationLocations();
    if (result.data) {
      setLocations(result.data);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const result = await getValidationData({
      date: format(selectedDate, "yyyy-MM-dd"),
      locationId,
      useFiscalDate,
      paymentMethodFilter,
    });

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setData(result.data);
    }
    setLoading(false);
  };

  // Calculate displayed totals based on toggles
  const displayedData = useMemo(() => {
    if (!data) return null;

    let categories = [...data.categories];
    let totalSales = excludeVat ? data.netTotalSales : data.totalSales;
    let totalDiscounts = excludeVat ? data.totalDiscounts / 1.2 : data.totalDiscounts;
    let tipsAmount = excludeVat ? data.netTotalTips : data.totalTips;
    let wasteAmount = excludeVat ? data.netTotalWaste : data.totalWaste;
    let noPaymentAmount = excludeVat ? data.netSalesWithNoPayment : data.salesWithNoPayment;

    // If we're excluding no payment, we need to recalculate
    // Note: The actual filtering happens in the query, but we show the amounts being excluded

    return {
      categories: categories.map(c => ({
        ...c,
        displaySales: excludeVat ? c.netSales : c.totalSales,
        displayDiscount: excludeVat ? c.discountAmount / 1.2 : c.discountAmount,
        displayCOS: excludeVat ? c.netCostOfSales : c.costOfSales,
        articles: c.articles.map(a => ({
          ...a,
          displaySales: excludeVat ? a.netSales : a.totalSales,
          displayDiscount: excludeVat ? a.discountAmount / 1.2 : a.discountAmount,
          displayCOS: excludeVat ? a.netCostOfSales : a.costOfSales,
        })),
      })),
      totalSales,
      totalDiscounts,
      totalCOS: excludeVat ? data.netTotalCostOfSales : data.totalCostOfSales,
      tipsAmount,
      wasteAmount,
      noPaymentAmount,
      noPaymentCount: data.salesWithNoPaymentCount,
    };
  }, [data, excludeVat]);

  // Calculate final total after exclusions
  const finalTotal = useMemo(() => {
    if (!displayedData) return 0;
    let total = displayedData.totalSales;

    // Tips and waste are already excluded from category aggregates
    // but we show them separately

    return total;
  }, [displayedData]);

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/admin">{t("common.admin")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {locale === "bg" ? "Валидация" : "Validation"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">
          {locale === "bg" ? "Дневна валидация" : "Daily Validation"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {locale === "bg"
            ? "Продажби по категории за избрана дата"
            : "Sales by category for selected date"}
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Picker */}
            <div className="space-y-2">
              <Label>
                {locale === "bg" ? "Дата" : "Date"}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Location Selector */}
            <div className="space-y-2">
              <Label>
                {locale === "bg" ? "Локация" : "Location"}
              </Label>
              <Select
                value={locationId}
                onValueChange={setLocationId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={locale === "bg" ? "Изберете локация" : "Select location"} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick date buttons */}
            <div className="space-y-2">
              <Label>
                {locale === "bg" ? "Бърз избор" : "Quick Select"}
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setSelectedDate(subDays(new Date(), 1))}
                >
                  {locale === "bg" ? "Вчера" : "Yesterday"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setSelectedDate(new Date())}
                >
                  {locale === "bg" ? "Днес" : "Today"}
                </Button>
              </div>
            </div>

            {/* Payment Method Filter */}
            <div className="space-y-2">
              <Label>
                {locale === "bg" ? "Метод на плащане" : "Payment Method"}
              </Label>
              <Select
                value={paymentMethodFilter}
                onValueChange={(v) => setPaymentMethodFilter(v as PaymentMethodFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={locale === "bg" ? "Всички" : "All"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {locale === "bg" ? "Всички плащания" : "All Payments"}
                  </SelectItem>
                  <SelectItem value="cash">
                    {locale === "bg" ? "В брой" : "Cash"}
                  </SelectItem>
                  <SelectItem value="card">
                    {locale === "bg" ? "Карта" : "Card"}
                  </SelectItem>
                  <SelectItem value="wallet">
                    {locale === "bg" ? "Изход (Портфейл)" : "Wallet/House"}
                  </SelectItem>
                  <SelectItem value="bank_transfer">
                    {locale === "bg" ? "Банков превод" : "Bank Transfer"}
                  </SelectItem>
                  <SelectItem value="no_payment">
                    {locale === "bg" ? "Без плащане" : "No Payment"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fiscal Date Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {locale === "bg" ? "Фискален период" : "Fiscal Period"}
              </Label>
              <div className="flex items-center gap-3 h-9">
                <Switch
                  id="fiscal-date"
                  checked={useFiscalDate}
                  onCheckedChange={setUseFiscalDate}
                />
                <Label htmlFor="fiscal-date" className="text-sm cursor-pointer">
                  {useFiscalDate
                    ? (locale === "bg" ? "6:45 - 6:44" : "6:45 AM - 6:44 AM")
                    : (locale === "bg" ? "00:00 - 23:59" : "12:00 AM - 11:59 PM")}
                </Label>
              </div>
            </div>
          </div>

          {/* Display Options */}
          <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t">
            <div className="flex items-center gap-3">
              <Switch
                id="exclude-vat"
                checked={excludeVat}
                onCheckedChange={setExcludeVat}
              />
              <Label htmlFor="exclude-vat" className="text-sm cursor-pointer">
                {locale === "bg" ? "Без ДДС (нето)" : "Exclude VAT (net)"}
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="exclude-tips-waste"
                checked={excludeTipsWaste}
                onCheckedChange={setExcludeTipsWaste}
              />
              <Label htmlFor="exclude-tips-waste" className="text-sm cursor-pointer">
                {locale === "bg" ? "Без бакшиш/брак" : "Exclude Tips/Waste"}
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="exclude-no-payment"
                checked={excludeNoPayment}
                onCheckedChange={setExcludeNoPayment}
              />
              <Label htmlFor="exclude-no-payment" className="text-sm cursor-pointer">
                {locale === "bg" ? "Без метод на плащане" : "Exclude No Payment"}
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="show-cos"
                checked={showCOS}
                onCheckedChange={setShowCOS}
              />
              <Label htmlFor="show-cos" className="text-sm cursor-pointer">
                {locale === "bg" ? "Покажи себестойност" : "Show Cost of Sales"}
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {displayedData && !loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Sales */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {locale === "bg" ? "Общо продажби" : "Total Sales"}
              </CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatAmount(displayedData.totalSales)}
              </div>
              <p className="text-xs text-muted-foreground">
                {excludeVat
                  ? (locale === "bg" ? "Нето (без ДДС)" : "Net (excl. VAT)")
                  : (locale === "bg" ? "Бруто (с ДДС)" : "Gross (incl. VAT)")}
              </p>
            </CardContent>
          </Card>

          {/* Cost of Sales */}
          {showCOS && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {locale === "bg" ? "Себестойност" : "Cost of Sales"}
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatAmount(displayedData.totalCOS)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {locale === "bg" ? "Общо COS" : "Total COS"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Total Discounts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {locale === "bg" ? "Общо отстъпки" : "Total Discounts"}
              </CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatAmount(displayedData.totalDiscounts)}
              </div>
              <p className="text-xs text-muted-foreground">
                {locale === "bg" ? "Дадени отстъпки" : "Given discounts"}
              </p>
            </CardContent>
          </Card>

          {/* Tips & Waste */}
          <Card className={cn(excludeTipsWaste && "opacity-60")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {locale === "bg" ? "Бакшиш / Брак" : "Tips / Waste"}
              </CardTitle>
              <div className="flex gap-1">
                <HandCoins className="h-4 w-4 text-muted-foreground" />
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div>
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {formatAmount(displayedData.tipsAmount)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {locale === "bg" ? "Бакшиши" : "Tips"}
                  </p>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {formatAmount(displayedData.wasteAmount)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {locale === "bg" ? "Брак" : "Waste"}
                  </p>
                </div>
              </div>
              {excludeTipsWaste && (
                <p className="text-xs text-muted-foreground mt-1">
                  {locale === "bg" ? "Изключено от общото" : "Excluded from total"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* No Payment Sales */}
          <Card className={cn(excludeNoPayment && "opacity-60")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {locale === "bg" ? "Без плащане" : "No Payment"}
              </CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatAmount(displayedData.noPaymentAmount)}
              </div>
              <p className="text-xs text-muted-foreground">
                {locale === "bg"
                  ? `${displayedData.noPaymentCount} продажби`
                  : `${displayedData.noPaymentCount} sales`}
              </p>
              {excludeNoPayment && (
                <p className="text-xs text-muted-foreground">
                  {locale === "bg" ? "Изключено от общото" : "Excluded from total"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sales by Category Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            {locale === "bg" ? "Продажби по категории" : "Sales by Category"}
          </CardTitle>
          <CardDescription>
            {data?.locationName && `${data.locationName} • `}
            {format(selectedDate, "dd MMM yyyy")}
            {useFiscalDate && (locale === "bg" ? " (фискален период)" : " (fiscal period)")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              {locale === "bg" ? "Зареждане..." : "Loading..."}
            </div>
          ) : error ? (
            <div className="py-12 text-center text-destructive">{error}</div>
          ) : displayedData && displayedData.categories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[35%]">
                    {locale === "bg" ? "Категория" : "Category"}
                  </TableHead>
                  <TableHead className="text-center w-[80px]">
                    {locale === "bg" ? "Сметка" : "Account"}
                  </TableHead>
                  <TableHead className="text-right">
                    {locale === "bg" ? "Брой" : "Count"}
                  </TableHead>
                  {showCOS && (
                    <TableHead className="text-right">
                      {locale === "bg" ? "Себестойност" : "COS"}
                    </TableHead>
                  )}
                  <TableHead className="text-right">
                    {locale === "bg" ? "Отстъпки" : "Discounts"}
                  </TableHead>
                  <TableHead className="text-right">
                    {excludeVat
                      ? (locale === "bg" ? "Нето" : "Net")
                      : (locale === "bg" ? "Сума" : "Amount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedData.categories.map((category, index) => {
                  const isExpanded = expandedCategories.has(category.categoryId);
                  const hasArticles = category.articles.length > 0;

                  return (
                    <Fragment key={category.categoryId ?? "uncategorized"}>
                      <TableRow
                        className={cn(
                          index % 2 === 0 ? "bg-background" : "bg-muted/30",
                          hasArticles && "cursor-pointer hover:bg-muted/50 transition-colors"
                        )}
                        onClick={() => hasArticles && toggleCategory(category.categoryId)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {hasArticles && (
                              <span className="text-muted-foreground">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </span>
                            )}
                            {!hasArticles && <span className="w-4" />}
                            {category.categoryName}
                            {hasArticles && (
                              <span className="text-xs text-muted-foreground">
                                ({category.articles.length})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {category.revenueAccountCode ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help text-sm font-mono text-primary hover:underline">
                                  {category.revenueAccountCode}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{category.revenueAccountName || category.revenueAccountCode}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {category.orderCount}
                        </TableCell>
                        {showCOS && (
                          <TableCell className="text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">
                            {category.displayCOS > 0
                              ? formatAmount(category.displayCOS)
                              : "-"}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                          {category.displayDiscount > 0
                            ? formatAmount(category.displayDiscount)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-semibold">
                          {formatAmount(category.displaySales)}
                        </TableCell>
                      </TableRow>

                      {/* Article breakdown rows */}
                      {isExpanded && category.articles.map((article) => (
                        <TableRow
                          key={`${category.categoryId}-${article.articleId}`}
                          className="bg-muted/10 border-l-4 border-l-primary/20"
                        >
                          <TableCell className="font-normal text-muted-foreground pl-10">
                            <span className="text-sm">{article.articleName}</span>
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                            {article.quantity}
                          </TableCell>
                          {showCOS && (
                            <TableCell className="text-right font-mono tabular-nums text-sm text-blue-500/70 dark:text-blue-400/70">
                              {article.displayCOS > 0
                                ? formatAmount(article.displayCOS)
                                : "-"}
                            </TableCell>
                          )}
                          <TableCell className="text-right font-mono tabular-nums text-sm text-amber-500/70 dark:text-amber-400/70">
                            {article.displayDiscount > 0
                              ? formatAmount(article.displayDiscount)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                            {formatAmount(article.displaySales)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}

                {/* Totals Row */}
                <TableRow className="bg-primary/10 font-bold border-t-2">
                  <TableCell>
                    {locale === "bg" ? "ОБЩО" : "TOTAL"}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono tabular-nums">
                    {displayedData.categories.reduce((sum, c) => sum + c.orderCount, 0)}
                  </TableCell>
                  {showCOS && (
                    <TableCell className="text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">
                      {formatAmount(displayedData.totalCOS)}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    {formatAmount(displayedData.totalDiscounts)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-lg">
                    {formatAmount(displayedData.totalSales)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              {locale === "bg" ? "Няма данни за тази дата" : "No data for this date"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
