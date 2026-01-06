"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createSnapshot,
  getArticlesWithCosts,
  getArticlesWithoutCost,
  getAvailableSnapshotDates,
  getCurrentInventoryValue,
  getCurrentStock,
  getCurrentStockSummary,
  getInventoryMovements,
  getPnLInventoryValues,
  syncCurrentStock,
  type InventoryArticle,
  type InventoryType,
  type InventoryValueSummary,
  type PeriodInventorySummary,
  type StockItem,
} from "@/lib/actions/admin-inventory";
import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import { cn } from "@/lib/utils";
import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Package,
  RefreshCw,
  Search,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface InventoryPageClientProps {
  locations: { id: string; name: string }[];
}

export const InventoryPageClient = ({
  locations,
}: InventoryPageClientProps) => {
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();

  // State
  const [loading, setLoading] = useState(true);
  const [articlesWithCost, setArticlesWithCost] = useState<InventoryArticle[]>(
    []
  );
  const [articlesWithoutCost, setArticlesWithoutCost] = useState<
    InventoryArticle[]
  >([]);
  const [periodData, setPeriodData] = useState<PeriodInventorySummary[]>([]);
  const [valueSummary, setValueSummary] = useState<
    {
      location_id: string;
      location_name: string;
      total_articles: number;
      articles_with_cost: number;
      articles_without_cost: number;
      estimated_value: number;
    }[]
  >([]);

  // Stock state
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockSummary, setStockSummary] = useState<InventoryValueSummary[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // P&L Snapshot state
  const [snapshotStartDate, setSnapshotStartDate] = useState<Date>(
    startOfMonth(subMonths(new Date(), 1))
  );
  const [snapshotEndDate, setSnapshotEndDate] = useState<Date>(
    subDays(startOfMonth(new Date()), 1)
  );
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [pnlData, setPnlData] = useState<{
    openingTotal: number;
    closingTotal: number;
    inventoryChange: number;
  } | null>(null);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);

  // Filters
  const [locationId, setLocationId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [stockSearchTerm, setStockSearchTerm] = useState("");
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<
    InventoryType | "all"
  >("all");
  const [showZeroQuantity, setShowZeroQuantity] = useState(false);

  // Pagination state
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(50);

  // Stock location filter (for summary card click)
  const [stockLocationFilter, setStockLocationFilter] = useState<string | null>(
    null
  );

  // Sorting state
  type SortColumn =
    | "article_name"
    | "location_name"
    | "quantity"
    | "cost_price"
    | "total_value";
  type SortDirection = "asc" | "desc";
  const [stockSortColumn, setStockSortColumn] =
    useState<SortColumn>("article_name");
  const [stockSortDirection, setStockSortDirection] =
    useState<SortDirection>("asc");
  const [dateFrom, setDateFrom] = useState<Date>(
    startOfMonth(subMonths(new Date(), 1))
  );
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));

  // Expanded state for period items
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(
    new Set()
  );

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      withCostResult,
      withoutCostResult,
      valueResult,
      stockResult,
      stockSummaryResult,
    ] = await Promise.all([
      getArticlesWithCosts(locationId || undefined),
      getArticlesWithoutCost(locationId || undefined),
      getCurrentInventoryValue(),
      getCurrentStock(locationId || undefined, showZeroQuantity),
      getCurrentStockSummary(),
    ]);

    setArticlesWithCost(withCostResult.data || []);
    setArticlesWithoutCost(withoutCostResult.data || []);
    setValueSummary(valueResult.data || []);
    setStockItems(stockResult.data || []);
    setStockSummary(stockSummaryResult.data || []);
    setLoading(false);
  }, [locationId, showZeroQuantity]);

  const loadPeriodData = useCallback(async () => {
    const result = await getInventoryMovements(
      format(dateFrom, "yyyy-MM-dd"),
      format(dateTo, "yyyy-MM-dd"),
      locationId || undefined
    );
    setPeriodData(result.data || []);
  }, [dateFrom, dateTo, locationId]);

  const loadAvailableDates = useCallback(async () => {
    const result = await getAvailableSnapshotDates(locationId || undefined);
    setAvailableDates(result.data || []);
  }, [locationId]);

  const loadPnLData = useCallback(async () => {
    const result = await getPnLInventoryValues(
      format(snapshotStartDate, "yyyy-MM-dd"),
      format(snapshotEndDate, "yyyy-MM-dd"),
      locationId || undefined
    );
    if (result.data) {
      setPnlData({
        openingTotal: result.data.openingTotal,
        closingTotal: result.data.closingTotal,
        inventoryChange: result.data.inventoryChange,
      });
    }
  }, [snapshotStartDate, snapshotEndDate, locationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadPeriodData();
  }, [loadPeriodData]);

  useEffect(() => {
    loadAvailableDates();
  }, [loadAvailableDates]);

  useEffect(() => {
    loadPnLData();
  }, [loadPnLData]);

  const handleSyncCurrentStock = async () => {
    if (!locationId) {
      setSyncMessage({
        type: "error",
        text: t("inventory.selectLocationFirst"),
      });
      return;
    }

    setSyncing(true);
    setSyncMessage(null);

    const result = await syncCurrentStock(locationId);

    if (result.success) {
      setSyncMessage({
        type: "success",
        text: t("inventory.syncSuccess").replace(
          "{count}",
          String(result.recordsSynced || 0)
        ),
      });
      loadData();
    } else {
      setSyncMessage({
        type: "error",
        text: result.error || t("inventory.syncError"),
      });
    }

    setSyncing(false);
  };

  const handleCreateSnapshot = async (date: Date) => {
    if (!locationId) {
      setSyncMessage({
        type: "error",
        text: t("inventory.selectLocationFirst"),
      });
      return;
    }

    setCreatingSnapshot(true);
    setSyncMessage(null);

    const result = await createSnapshot(locationId, format(date, "yyyy-MM-dd"));

    if (result.success) {
      setSyncMessage({
        type: "success",
        text: t("inventory.snapshotCreated").replace(
          "{count}",
          String(result.recordsSynced || 0)
        ),
      });
      loadAvailableDates();
      loadPnLData();
    } else {
      setSyncMessage({
        type: "error",
        text: result.error || t("inventory.snapshotError"),
      });
    }

    setCreatingSnapshot(false);
  };

  const setQuickDate = (
    period: "this-month" | "last-month" | "last-3-months"
  ) => {
    const now = new Date();
    switch (period) {
      case "this-month":
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
        break;
      case "last-month":
        const lastMonth = subMonths(now, 1);
        setDateFrom(startOfMonth(lastMonth));
        setDateTo(endOfMonth(lastMonth));
        break;
      case "last-3-months":
        setDateFrom(startOfMonth(subMonths(now, 3)));
        setDateTo(endOfMonth(now));
        break;
    }
  };

  const toggleLocation = (locId: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locId)) {
      newExpanded.delete(locId);
    } else {
      newExpanded.add(locId);
    }
    setExpandedLocations(newExpanded);
  };

  // Filter articles by search term
  const filteredArticles = articlesWithCost.filter(
    (a) =>
      a.article_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredWithoutCost = articlesWithoutCost.filter(
    (a) =>
      a.article_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter stock items by search term, inventory type, and location
  const filteredStock = stockItems.filter((s) => {
    const matchesSearch =
      s.article_name.toLowerCase().includes(stockSearchTerm.toLowerCase()) ||
      s.depot_name?.toLowerCase().includes(stockSearchTerm.toLowerCase());
    const matchesType =
      inventoryTypeFilter === "all" || s.inventory_type === inventoryTypeFilter;
    const matchesLocation =
      !stockLocationFilter || s.location_id === stockLocationFilter;
    return matchesSearch && matchesType && matchesLocation;
  });

  // Sort filtered stock
  const sortedStock = [...filteredStock].sort((a, b) => {
    const multiplier = stockSortDirection === "asc" ? 1 : -1;

    switch (stockSortColumn) {
      case "article_name":
        return multiplier * a.article_name.localeCompare(b.article_name);
      case "location_name":
        return (
          multiplier *
          (a.location_name || "").localeCompare(b.location_name || "")
        );
      case "quantity":
        return multiplier * (a.quantity - b.quantity);
      case "cost_price":
        return multiplier * ((a.cost_price || 0) - (b.cost_price || 0));
      case "total_value":
        return multiplier * ((a.total_value || 0) - (b.total_value || 0));
      default:
        return 0;
    }
  });

  // Paginated stock items
  const paginatedStock = sortedStock.slice(
    (stockPage - 1) * stockPageSize,
    stockPage * stockPageSize
  );

  // Handle column sort
  const handleStockSort = (column: SortColumn) => {
    if (stockSortColumn === column) {
      setStockSortDirection(stockSortDirection === "asc" ? "desc" : "asc");
    } else {
      setStockSortColumn(column);
      setStockSortDirection("asc");
    }
    setStockPage(1);
  };

  // Sort icon helper
  const getSortIcon = (column: SortColumn) => {
    if (stockSortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground/50" />;
    }
    return stockSortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" />
    );
  };

  // Reset page when filters change
  useEffect(() => {
    setStockPage(1);
  }, [stockSearchTerm, stockLocationFilter]);

  // Reset location filter when main location changes (reloads data)
  useEffect(() => {
    setStockLocationFilter(null);
  }, [locationId]);

  // Calculate totals
  const totalEstimatedValue = valueSummary.reduce(
    (sum, v) => sum + v.estimated_value,
    0
  );
  const totalArticles = valueSummary.reduce(
    (sum, v) => sum + v.total_articles,
    0
  );
  const totalWithoutCost = valueSummary.reduce(
    (sum, v) => sum + v.articles_without_cost,
    0
  );

  const totalPeriodValue = periodData.reduce(
    (sum, p) => sum + p.value_added,
    0
  );

  // Stock totals
  const totalStockItems = stockSummary.reduce(
    (sum, s) => sum + s.total_items,
    0
  );
  const totalStockValue = stockSummary.reduce(
    (sum, s) => sum + s.total_value,
    0
  );
  const latestSyncTime =
    stockSummary.length > 0
      ? stockSummary.reduce((latest, s) => {
          if (!s.synced_at) return latest;
          if (!latest) return s.synced_at;
          return s.synced_at > latest ? s.synced_at : latest;
        }, null as string | null)
      : null;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">{t("common.admin")}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t("nav.inventory")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">{t("inventory.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("inventory.description")}
        </p>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <Alert
          variant={syncMessage.type === "error" ? "destructive" : "default"}
        >
          <AlertDescription>{syncMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("inventory.currentStockValue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {formatAmount(totalStockValue)}
              </span>
            </div>
            {latestSyncTime && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("inventory.lastSync")}:{" "}
                {format(new Date(latestSyncTime), "dd MMM HH:mm")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("inventory.stockItems")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{totalStockItems}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("inventory.withoutCost")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold text-amber-500">
                {totalWithoutCost}
              </span>
              <span className="text-sm text-muted-foreground">
                ({((totalWithoutCost / totalArticles) * 100 || 0).toFixed(1)}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("inventory.valueDeliveryPrices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">
                {formatAmount(totalEstimatedValue)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Sync Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full sm:w-64">
              <label className="text-sm font-medium mb-2 block">
                {t("common.location")}
              </label>
              <Select
                value={locationId || "all"}
                onValueChange={(v) => setLocationId(v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("billsFilters.allLocations")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("billsFilters.allLocations")}
                  </SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">
                {t("common.search")}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("products.searchByName")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSyncCurrentStock}
                disabled={syncing || !locationId}
                variant="outline"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {t("inventory.syncStock")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="current-stock" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="current-stock">
            <Warehouse className="h-4 w-4 mr-1" />
            {t("inventory.currentStock")}
            <Badge variant="secondary" className="ml-2">
              {filteredStock.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pnl-snapshot">
            <Download className="h-4 w-4 mr-1" />
            {t("inventory.pnlSnapshot")}
          </TabsTrigger>
          <TabsTrigger value="all-articles">
            {t("inventory.allArticles")}
            <Badge variant="secondary" className="ml-2">
              {filteredArticles.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="without-cost">
            {t("inventory.withoutCostTab")}
            <Badge variant="destructive" className="ml-2">
              {filteredWithoutCost.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="period">{t("inventory.byPeriod")}</TabsTrigger>
        </TabsList>

        {/* Current Stock Tab */}
        <TabsContent value="current-stock">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                {t("inventory.currentStockTitle")}
                {stockLocationFilter && (
                  <Badge variant="secondary" className="ml-2">
                    {stockSummary.find(
                      (s) => s.location_id === stockLocationFilter
                    )?.location_name || stockLocationFilter}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {t("inventory.currentStockDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stockItems.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    {t("inventory.noStockData")}
                  </p>
                  <Button
                    onClick={handleSyncCurrentStock}
                    disabled={syncing || !locationId}
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {t("inventory.syncFromBarsy")}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Stock Search & Filters */}
                  <div className="mb-4 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t("inventory.searchStock")}
                        value={stockSearchTerm}
                        onChange={(e) => setStockSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select
                      value={inventoryTypeFilter}
                      onValueChange={(v) => {
                        setInventoryTypeFilter(v as InventoryType | "all");
                        setStockPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue
                          placeholder={t("inventory.filterByType")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("inventory.allTypes")}
                        </SelectItem>
                        <SelectItem value="product">
                          {t("inventory.typeProduct")}
                        </SelectItem>
                        <SelectItem value="ingredient">
                          {t("inventory.typeIngredient")}
                        </SelectItem>
                        <SelectItem value="asset">
                          {t("inventory.typeAsset")}
                        </SelectItem>
                        <SelectItem value="consumable">
                          {t("inventory.typeConsumable")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="show-zero-quantity"
                        checked={showZeroQuantity}
                        onCheckedChange={(checked) =>
                          setShowZeroQuantity(checked === true)
                        }
                      />
                      <label
                        htmlFor="show-zero-quantity"
                        className="text-sm font-medium cursor-pointer select-none"
                      >
                        {t("inventory.showZeroQuantity")}
                      </label>
                    </div>
                  </div>

                  {/* Stock Summary by Location */}
                  {stockSummary.length > 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {/* All Locations Card */}
                      <Card
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          stockLocationFilter === null
                            ? "ring-2 ring-primary bg-primary/5"
                            : "bg-muted/50 hover:bg-muted"
                        )}
                        onClick={() => setStockLocationFilter(null)}
                      >
                        <CardContent className="pt-4">
                          <div className="font-medium flex items-center gap-2">
                            <Warehouse className="h-4 w-4" />
                            {t("billsFilters.allLocations")}
                          </div>
                          <div className="text-2xl font-bold mt-1">
                            {formatAmount(totalStockValue)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {totalStockItems} {t("inventory.items")}
                          </div>
                        </CardContent>
                      </Card>
                      {stockSummary.map((summary) => (
                        <Card
                          key={summary.location_id}
                          className={cn(
                            "cursor-pointer transition-all hover:shadow-md",
                            stockLocationFilter === summary.location_id
                              ? "ring-2 ring-primary bg-primary/5"
                              : "bg-muted/50 hover:bg-muted"
                          )}
                          onClick={() =>
                            setStockLocationFilter(
                              stockLocationFilter === summary.location_id
                                ? null
                                : summary.location_id
                            )
                          }
                        >
                          <CardContent className="pt-4">
                            <div className="font-medium">
                              {summary.location_name}
                            </div>
                            <div className="text-2xl font-bold mt-1">
                              {formatAmount(summary.total_value)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {summary.total_items} {t("inventory.items")} •{" "}
                              {summary.items_with_value}{" "}
                              {t("inventory.withValue")}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Stock Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <button
                              className="flex items-center hover:text-foreground transition-colors"
                              onClick={() => handleStockSort("article_name")}
                            >
                              {t("inventory.article")}
                              {getSortIcon("article_name")}
                            </button>
                          </TableHead>
                          <TableHead>{t("inventory.inventoryType")}</TableHead>
                          <TableHead>
                            <button
                              className="flex items-center hover:text-foreground transition-colors"
                              onClick={() => handleStockSort("location_name")}
                            >
                              {t("inventory.location")}
                              {getSortIcon("location_name")}
                            </button>
                          </TableHead>
                          <TableHead>{t("inventory.depot")}</TableHead>
                          <TableHead className="text-right">
                            <button
                              className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                              onClick={() => handleStockSort("quantity")}
                            >
                              {t("inventory.quantity")}
                              {getSortIcon("quantity")}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button
                              className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                              onClick={() => handleStockSort("cost_price")}
                            >
                              {t("inventory.unitCost")}
                              {getSortIcon("cost_price")}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button
                              className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                              onClick={() => handleStockSort("total_value")}
                            >
                              {t("inventory.totalValue")}
                              {getSortIcon("total_value")}
                            </button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedStock.map((item, idx) => (
                          <TableRow
                            key={item.id}
                            className={cn(idx % 2 === 0 && "bg-muted/50")}
                          >
                            <TableCell className="font-medium">
                              {item.article_name}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.inventory_type === "product"
                                    ? "default"
                                    : item.inventory_type === "ingredient"
                                    ? "secondary"
                                    : "outline"
                                }
                                className="text-xs"
                              >
                                {item.inventory_type === "product"
                                  ? t("inventory.typeProduct")
                                  : item.inventory_type === "ingredient"
                                  ? t("inventory.typeIngredient")
                                  : item.inventory_type === "asset"
                                  ? t("inventory.typeAsset")
                                  : t("inventory.typeConsumable")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.location_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.depot_name || "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.quantity.toLocaleString()} {item.unit || ""}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.cost_price
                                ? formatAmount(item.cost_price)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {item.total_value
                                ? formatAmount(item.total_value)
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="mt-4">
                    <DataTablePagination
                      currentPage={stockPage}
                      pageSize={stockPageSize}
                      totalItems={filteredStock.length}
                      onPageChange={setStockPage}
                      onPageSizeChange={(size) => {
                        setStockPageSize(size);
                        setStockPage(1);
                      }}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* P&L Snapshot Tab */}
        <TabsContent value="pnl-snapshot">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                {t("inventory.pnlSnapshotTitle")}
              </CardTitle>
              <CardDescription>
                {t("inventory.pnlSnapshotDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("inventory.openingDate")}
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(snapshotStartDate, "dd MMM yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={snapshotStartDate}
                        onSelect={(d) => d && setSnapshotStartDate(d)}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleCreateSnapshot(snapshotStartDate)}
                    disabled={creatingSnapshot || !locationId}
                  >
                    {creatingSnapshot ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {t("inventory.createOpeningSnapshot")}
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("inventory.closingDate")}
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(snapshotEndDate, "dd MMM yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={snapshotEndDate}
                        onSelect={(d) => d && setSnapshotEndDate(d)}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleCreateSnapshot(snapshotEndDate)}
                    disabled={creatingSnapshot || !locationId}
                  >
                    {creatingSnapshot ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {t("inventory.createClosingSnapshot")}
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("inventory.quickPeriod")}
                  </label>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const lastMonth = subMonths(new Date(), 1);
                        setSnapshotStartDate(startOfMonth(lastMonth));
                        setSnapshotEndDate(endOfMonth(lastMonth));
                      }}
                    >
                      {t("inventory.lastMonth")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSnapshotStartDate(startOfMonth(new Date()));
                        setSnapshotEndDate(subDays(new Date(), 1));
                      }}
                    >
                      {t("inventory.thisMonthToDate")}
                    </Button>
                  </div>
                </div>
              </div>

              {/* P&L Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50 dark:bg-blue-950/30">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">
                      {t("inventory.openingInventory")}
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {formatAmount(pnlData?.openingTotal || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(snapshotStartDate, "dd MMM yyyy")}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 dark:bg-green-950/30">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">
                      {t("inventory.closingInventory")}
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {formatAmount(pnlData?.closingTotal || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(snapshotEndDate, "dd MMM yyyy")}
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    (pnlData?.inventoryChange || 0) >= 0
                      ? "bg-green-50 dark:bg-green-950/30"
                      : "bg-red-50 dark:bg-red-950/30"
                  )}
                >
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">
                      {t("inventory.inventoryChange")}
                    </div>
                    <div
                      className={cn(
                        "text-2xl font-bold mt-1",
                        (pnlData?.inventoryChange || 0) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {(pnlData?.inventoryChange || 0) >= 0 ? "+" : ""}
                      {formatAmount(pnlData?.inventoryChange || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("inventory.changeDescription")}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Available Snapshots */}
              {availableDates.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    {t("inventory.availableSnapshots")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {availableDates.slice(0, 10).map((date) => (
                      <Badge key={date} variant="secondary">
                        {format(new Date(date), "dd MMM yyyy")}
                      </Badge>
                    ))}
                    {availableDates.length > 10 && (
                      <Badge variant="outline">
                        +{availableDates.length - 10} {t("inventory.more")}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* No Snapshots Warning */}
              {availableDates.length === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {t("inventory.noSnapshotsWarning")}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Articles Tab */}
        <TabsContent value="all-articles">
          <Card>
            <CardHeader>
              <CardTitle>{t("inventory.articlesWithValue")}</CardTitle>
              <CardDescription>
                {t("inventory.articlesWithValueDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("inventory.article")}</TableHead>
                        <TableHead>{t("inventory.category")}</TableHead>
                        <TableHead>{t("inventory.location")}</TableHead>
                        <TableHead className="text-right">
                          {t("inventory.costPrice")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("inventory.avgDelivery")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("inventory.lastDelivery")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("inventory.effectiveCost")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredArticles.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-8 text-muted-foreground"
                          >
                            {t("inventory.noArticles")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredArticles.slice(0, 100).map((article, idx) => (
                          <TableRow
                            key={article.barsy_article_id}
                            className={cn(idx % 2 === 0 && "bg-muted/50")}
                          >
                            <TableCell className="font-medium">
                              {article.article_name}
                              {article.is_for_sale && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-xs"
                                >
                                  {t("inventory.forSale")}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {article.category_name || "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {article.location_name || "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {article.cost_price
                                ? formatAmount(article.cost_price)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {article.avg_delivery_price
                                ? formatAmount(article.avg_delivery_price)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {article.delivery_price_last
                                ? formatAmount(article.delivery_price_last)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {article.effective_cost ? (
                                formatAmount(article.effective_cost)
                              ) : (
                                <span className="text-amber-500">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {filteredArticles.length > 100 && (
                    <div className="p-4 text-center text-muted-foreground border-t">
                      {t("inventory.showingFirst")} {filteredArticles.length}{" "}
                      {t("inventory.articles")}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Without Cost Tab */}
        <TabsContent value="without-cost">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {t("inventory.articlesWithoutCost")}
              </CardTitle>
              <CardDescription>
                {t("inventory.articlesWithoutCostDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : filteredWithoutCost.length === 0 ? (
                <div className="py-8 text-center text-green-600">
                  ✓ {t("inventory.allHaveCosts")}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("inventory.article")}</TableHead>
                        <TableHead>{t("inventory.category")}</TableHead>
                        <TableHead>{t("inventory.location")}</TableHead>
                        <TableHead>{t("inventory.unit")}</TableHead>
                        <TableHead>{t("inventory.type")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWithoutCost.slice(0, 100).map((article, idx) => (
                        <TableRow
                          key={article.barsy_article_id}
                          className={cn(idx % 2 === 0 && "bg-muted/50")}
                        >
                          <TableCell className="font-medium">
                            {article.article_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {article.category_name || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {article.location_name || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {article.amount_unit || "-"}
                          </TableCell>
                          <TableCell>
                            {article.is_for_sale ? (
                              <Badge variant="outline">
                                {t("inventory.forSale")}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {t("inventory.ingredient")}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredWithoutCost.length > 100 && (
                    <div className="p-4 text-center text-muted-foreground border-t">
                      {t("inventory.showingFirst")} {filteredWithoutCost.length}{" "}
                      {t("inventory.articles")}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Period Tab */}
        <TabsContent value="period">
          <Card>
            <CardHeader>
              <CardTitle>{t("inventory.movementsByPeriod")}</CardTitle>
              <CardDescription>
                {t("inventory.movementsByPeriodDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Period Filters */}
              <div className="flex flex-wrap gap-4 pb-4 border-b">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("inventory.fromDate")}
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-[180px] justify-start"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dateFrom, "dd MMM yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={(d) => d && setDateFrom(d)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("inventory.toDate")}
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-[180px] justify-start"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dateTo, "dd MMM yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={(d) => d && setDateTo(d)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("inventory.quickSelect")}
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickDate("this-month")}
                    >
                      {t("inventory.thisMonth")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickDate("last-month")}
                    >
                      {t("inventory.lastMonth")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickDate("last-3-months")}
                    >
                      {t("inventory.last3Months")}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Period Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">
                      {t("inventory.totalLoadedPeriod")}
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {formatAmount(totalPeriodValue)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">
                      {t("inventory.locationsWithActivity")}
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {periodData.length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Period Data by Location */}
              {periodData.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {t("inventory.noLoadsFound")}
                </div>
              ) : (
                <div className="space-y-4">
                  {periodData.map((locSummary) => (
                    <div
                      key={locSummary.location_id}
                      className="border rounded-lg overflow-hidden"
                    >
                      <button
                        className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted transition-colors"
                        onClick={() => toggleLocation(locSummary.location_id)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedLocations.has(locSummary.location_id) ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                          <span className="font-semibold">
                            {locSummary.location_name}
                          </span>
                          <Badge variant="secondary">
                            {locSummary.items.length} {t("inventory.articles")}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {formatAmount(locSummary.value_added)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {locSummary.quantity_added.toLocaleString()}{" "}
                            {t("inventory.units")}
                          </div>
                        </div>
                      </button>

                      {expandedLocations.has(locSummary.location_id) && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("inventory.article")}</TableHead>
                              <TableHead className="text-right">
                                {t("inventory.quantity")}
                              </TableHead>
                              <TableHead className="text-right">
                                {t("inventory.unitPrice")}
                              </TableHead>
                              <TableHead className="text-right">
                                {t("inventory.value")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {locSummary.items.map((item, idx) => (
                              <TableRow
                                key={item.barsy_article_id}
                                className={cn(idx % 2 === 0 && "bg-muted/30")}
                              >
                                <TableCell className="font-medium">
                                  {item.article_name}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {item.quantity_added.toLocaleString()}{" "}
                                  {item.unit || ""}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {item.unit_price
                                    ? formatAmount(item.unit_price)
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                  {formatAmount(item.value_added)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
