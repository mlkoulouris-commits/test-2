"use client";

import { StaffPerformanceTable } from "@/components/admin/staff-performance-table";
import { CreateTransactionForm } from "@/components/dashboard/create-transaction-form";
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
import { DataTablePagination } from "@/components/ui/data-table-pagination";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBarsyAccountTransactions } from "@/lib/actions/barsy-accounts-sync";
import {
  getBarsyLocations,
  getBarsyOrders,
  getBarsyOrderStats,
  getBarsyStaff,
} from "@/lib/actions/barsy-orders";
import {
  getBarsyTransactions,
  getBarsyTransactionStats,
  getStaffPerformanceStats,
  type StaffPerformanceData,
} from "@/lib/actions/barsy-transactions";
import { getAllLocations } from "@/lib/actions/locations";
import { getAllProducts } from "@/lib/actions/products";
import { cn } from "@/lib/utils";
import { formatSofiaTime } from "@/lib/utils/timezone";
import { format } from "date-fns";
import {
  ArrowRightLeft,
  CalendarIcon,
  DollarSign,
  Download,
  FileSpreadsheet,
  HandCoins,
  Info,
  Percent,
  Receipt,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";

const formatAmount = (amount: number | null | undefined) => {
  if (amount == null) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;

  const today = new Date();
  const sevenDaysAgo = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 7
  );

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: sevenDaysAgo,
    to: today,
  });
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"orders" | "grouped" | "accounts">(
    "grouped"
  );
  const [discountFilter, setDiscountFilter] = useState<
    "all" | "with_discount" | "no_discount"
  >("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [voidFilter, setVoidFilter] = useState<
    | "all"
    | "positive_only"
    | "voided_only"
    | "transfers_only"
    | "pure_voids_only"
  >("all");
  const [useFiscalDate, setUseFiscalDate] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [barsyLocations, setBarsyLocations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [barsyStaff, setBarsyStaff] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("barsy");
  const [staffPerformance, setStaffPerformance] = useState<
    StaffPerformanceData[]
  >([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const updatePageParam = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", page.toString());
      router.push(`/admin/transactions?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      setPageSize(newPageSize);
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      router.push(`/admin/transactions?${params.toString()}`);
    },
    [router, searchParams]
  );

  const loadOrders = useCallback(
    async (page = 1) => {
      if (!dateRange?.from || !dateRange?.to) return;

      setLoading(true);

      try {
        const dateFromStr = format(dateRange.from, "yyyy-MM-dd");
        const dateToStr = format(dateRange.to, "yyyy-MM-dd");
        const locationFilter =
          selectedLocation === "all" ? undefined : selectedLocation;

        let staffNameFilter: string | undefined;
        let staffIdFilter: string | undefined;
        if (selectedStaff !== "all") {
          try {
            const parsed = JSON.parse(selectedStaff);
            staffNameFilter = parsed.name;
            staffIdFilter = parsed.id?.toString();
          } catch {
            // Fallback if not JSON
            staffNameFilter = selectedStaff;
          }
        }

        if (viewMode === "accounts") {
          // Load account-based transactions (bills)
          const accountResult = await getBarsyAccountTransactions(
            dateFromStr,
            dateToStr,
            locationFilter,
            page,
            pageSize,
            staffIdFilter,
            discountFilter,
            paymentMethodFilter,
            useFiscalDate
          );

          if (accountResult.error) {
            console.error("Error loading account transactions:", accountResult.error);
          }

          if (accountResult.data) {
            setAccountTransactions(accountResult.data);
            setTotalPages(accountResult.totalPages || 1);
            setTotalCount(accountResult.count || 0);
          }

          // For accounts, stats are just total accounts and revenue
          if (page === 1) {
            setStats({
              totalAccounts: accountResult.count || 0,
              totalRevenue:
                accountResult.data?.reduce(
                  (sum: number, acc: any) => sum + (acc.total_amount || 0),
                  0
                ) || 0,
            });
          }
        } else if (viewMode === "grouped") {
          // Load grouped transactions
          const txResult = await getBarsyTransactions(
            dateFromStr,
            dateToStr,
            locationFilter,
            page,
            pageSize,
            staffNameFilter,
            discountFilter,
            paymentMethodFilter,
            voidFilter,
            useFiscalDate
          );

          if (txResult.error) {
            console.error("Error loading grouped transactions:", txResult.error);
          }

          if (txResult.data) {
            setTransactions(txResult.data);
            setTotalPages(txResult.totalPages || 1);
            setTotalCount(txResult.count || 0);
          }

          if (page === 1) {
            const statsResult = await getBarsyTransactionStats(
              dateFromStr,
              dateToStr,
              locationFilter,
              staffNameFilter,
              discountFilter,
              paymentMethodFilter,
              useFiscalDate
            );
            if (statsResult.data) {
              setStats(statsResult.data);
            }
          }
        } else {
          // Load individual orders
          const ordersResult = await getBarsyOrders(
            dateFromStr,
            dateToStr,
            locationFilter,
            page,
            pageSize,
            discountFilter,
            staffNameFilter,
            paymentMethodFilter,
            voidFilter,
            useFiscalDate
          );

          if (ordersResult.error) {
            console.error("Error loading orders:", ordersResult.error);
          }

          if (ordersResult.data) {
            setOrders(ordersResult.data);
            setTotalPages(ordersResult.totalPages || 1);
            setTotalCount(ordersResult.count || 0);
          }

          if (page === 1) {
            const statsResult = await getBarsyOrderStats(
              dateFromStr,
              dateToStr,
              locationFilter,
              discountFilter,
              staffNameFilter,
              paymentMethodFilter,
              useFiscalDate
            );
            if (statsResult.data) {
              setStats(statsResult.data);
            }
          }
        }
      } catch (error) {
        console.error("Error loading orders:", error);
      } finally {
        setLoading(false);
      }
    },
    [
      dateRange,
      selectedLocation,
      selectedStaff,
      viewMode,
      discountFilter,
      paymentMethodFilter,
      voidFilter,
      useFiscalDate,
      pageSize,
    ]
  );

  // Create a ref to track if this is filter-triggered reload
  const prevFiltersRef = useRef<string>("");

  // Build a filter key to detect changes
  const filterKey = JSON.stringify({
    dateRange,
    selectedLocation,
    selectedStaff,
    viewMode,
    discountFilter,
    paymentMethodFilter,
    voidFilter,
    useFiscalDate,
    pageSize,
  });

  // Load data when filters or page changes
  useEffect(() => {
    const filtersChanged =
      prevFiltersRef.current !== "" && prevFiltersRef.current !== filterKey;
    prevFiltersRef.current = filterKey;

    // If filters changed and we're not on page 1, reset to page 1
    if (filtersChanged && currentPage !== 1) {
      updatePageParam(1);
      return; // The page change will trigger another load
    }

    // Load data for current page
    loadOrders(currentPage);
  }, [currentPage, filterKey, loadOrders, updatePageParam]);

  const loadInitialData = async () => {
    try {
      const [
        locationsResult,
        productsResult,
        barsyLocationsResult,
        barsyStaffResult,
      ] = await Promise.all([
        getAllLocations().catch((e) => {
          console.error("Failed to load locations:", e);
          return { data: [] };
        }),
        getAllProducts().catch((e) => {
          console.error("Failed to load products:", e);
          return { data: [] };
        }),
        getBarsyLocations().catch((e) => {
          console.error("Failed to load barsy locations:", e);
          return { data: [] };
        }),
        getBarsyStaff().catch((e) => {
          console.error("Failed to load barsy staff:", e);
          return { data: [] };
        }),
      ]);
      setLocations(locationsResult.data?.filter((l) => l.is_active) || []);
      setProducts(productsResult.data?.filter((p) => p.is_active) || []);
      setBarsyLocations(barsyLocationsResult.data || []);
      setBarsyStaff(barsyStaffResult.data || []);
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  };

  const loadStaffPerformance = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    setStaffLoading(true);

    const dateFromStr = format(dateRange.from, "yyyy-MM-dd");
    const dateToStr = format(dateRange.to, "yyyy-MM-dd");
    const locationFilter =
      selectedLocation === "all" ? undefined : selectedLocation;

    const result = await getStaffPerformanceStats(
      dateFromStr,
      dateToStr,
      locationFilter,
      useFiscalDate
    );

    if (result.data) {
      setStaffPerformance(result.data);
    }

    setStaffLoading(false);
    setStaffLoaded(true);
  }, [dateRange, selectedLocation, useFiscalDate]);

  // Load staff performance when tab is selected or filters change
  useEffect(() => {
    if (activeTab === "staff") {
      loadStaffPerformance();
    } else {
      // Reset staffLoaded when leaving the tab so it reloads on next visit
      setStaffLoaded(false);
    }
  }, [activeTab, loadStaffPerformance]);

  // Export functions
  const fetchAllDataForExport = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return null;

    const dateFromStr = format(dateRange.from, "yyyy-MM-dd");
    const dateToStr = format(dateRange.to, "yyyy-MM-dd");
    const locationFilter =
      selectedLocation === "all" ? undefined : selectedLocation;

    let staffNameFilter: string | undefined;
    let staffIdFilter: string | undefined;
    if (selectedStaff !== "all") {
      try {
        const parsed = JSON.parse(selectedStaff);
        staffNameFilter = parsed.name;
        staffIdFilter = parsed.id?.toString();
      } catch {
        staffNameFilter = selectedStaff;
      }
    }

    // Fetch all data (use large page size to get everything)
    const maxExportSize = 10000;

    if (viewMode === "accounts") {
      const result = await getBarsyAccountTransactions(
        dateFromStr,
        dateToStr,
        locationFilter,
        1,
        maxExportSize,
        staffIdFilter,
        discountFilter,
        paymentMethodFilter,
        useFiscalDate
      );
      return result.data || [];
    } else if (viewMode === "grouped") {
      const result = await getBarsyTransactions(
        dateFromStr,
        dateToStr,
        locationFilter,
        1,
        maxExportSize,
        staffNameFilter,
        discountFilter,
        paymentMethodFilter,
        voidFilter,
        useFiscalDate
      );
      return result.data || [];
    } else {
      const result = await getBarsyOrders(
        dateFromStr,
        dateToStr,
        locationFilter,
        1,
        maxExportSize,
        discountFilter,
        staffNameFilter,
        paymentMethodFilter,
        voidFilter,
        useFiscalDate
      );
      return result.data || [];
    }
  }, [
    dateRange,
    selectedLocation,
    selectedStaff,
    viewMode,
    discountFilter,
    paymentMethodFilter,
    voidFilter,
    useFiscalDate,
  ]);

  type ExportRow = {
    date: string;
    time: string;
    transactionId: string;
    product: string;
    status: string;
    location: string;
    staff: string;
    paymentMethod: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    total: string;
  };

  const buildExportRows = (data: any[]): ExportRow[] => {
    const rows: ExportRow[] = [];

    if (viewMode === "orders") {
      // Individual orders - one row per order
      for (const order of data) {
        const discount = order.raw_data?.discount
          ? Math.abs(Number(order.raw_data.discount))
          : 0;
        const voidType = order.void_type as "transfer" | "pure_void" | null;
        const status =
          voidType === "transfer"
            ? "Transfer"
            : voidType === "pure_void"
            ? "Voided"
            : "Sale";

        rows.push({
          date: formatSofiaTime(order.order_date, "yyyy-MM-dd"),
          time: formatSofiaTime(order.order_date, "HH:mm:ss"),
          transactionId: order.raw_data?.account_id?.toString() || "-",
          product: order.article_name || "-",
          status,
          location: order.barsy_locations?.name || "-",
          staff: order.user_name || "-",
          paymentMethod:
            order.payment_methods?.join(", ") || "-",
          quantity: formatAmount(Number(order.amount)),
          unitPrice: formatAmount(Number(order.actual_price)),
          discount: discount > 0 ? `${discount}%` : "-",
          total: formatAmount(
            Number(order.amount) * Number(order.actual_price)
          ),
        });
      }
    } else {
      // Grouped transactions or accounts - one row per line item
      for (const transaction of data) {
        const accountId =
          viewMode === "accounts"
            ? transaction.account_number
            : transaction.account_id;
        const orderDate = viewMode === "accounts"
          ? transaction.open_date
          : transaction.order_date;

        for (const item of transaction.line_items || []) {
          const voidType = item.void_type as "transfer" | "pure_void" | null;
          const status =
            voidType === "transfer"
              ? "Transfer"
              : voidType === "pure_void"
              ? "Voided"
              : "Sale";

          rows.push({
            date: formatSofiaTime(orderDate, "yyyy-MM-dd"),
            time: formatSofiaTime(orderDate, "HH:mm:ss"),
            transactionId: String(accountId),
            product: item.article_name || "-",
            status,
            location: transaction.location_name || "-",
            staff: transaction.user_name || "-",
            paymentMethod:
              transaction.payment_methods?.join(", ") || "-",
            quantity: formatAmount(item.quantity),
            unitPrice: formatAmount(item.unit_price),
            discount: item.discount > 0 ? `${item.discount}%` : "-",
            total: formatAmount(item.total),
          });
        }
      }
    }

    return rows;
  };

  const exportToExcel = async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    setExporting(true);
    try {
      const data = await fetchAllDataForExport();
      if (!data || data.length === 0) {
        setExporting(false);
        return;
      }

      const rows = buildExportRows(data);

      const headers = [
        "Date",
        "Time",
        viewMode === "accounts" ? "Account #" : "Transaction ID",
        "Product",
        "Status",
        "Location",
        "Staff",
        "Payment Method",
        "Quantity",
        "Unit Price",
        "Discount",
        "Total (BGN)",
      ];

      const title = `Barsy ${
        viewMode === "accounts"
          ? "Accounts"
          : viewMode === "grouped"
          ? "Transactions"
          : "Orders"
      }`;
      const dateRangeStr = `${format(dateRange.from, "yyyy-MM-dd")} - ${format(
        dateRange.to,
        "yyyy-MM-dd"
      )}`;

      const wsData: Array<Array<string | number>> = [
        [title],
        [dateRangeStr],
        [],
        headers,
        ...rows.map((row) => [
          row.date,
          row.time,
          row.transactionId,
          row.product,
          row.status,
          row.location,
          row.staff,
          row.paymentMethod,
          row.quantity,
          row.unitPrice,
          row.discount,
          row.total,
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [
        { wch: 12 }, // Date
        { wch: 10 }, // Time
        { wch: 15 }, // Transaction ID
        { wch: 30 }, // Product
        { wch: 10 }, // Status
        { wch: 15 }, // Location
        { wch: 15 }, // Staff
        { wch: 15 }, // Payment Method
        { wch: 10 }, // Quantity
        { wch: 12 }, // Unit Price
        { wch: 10 }, // Discount
        { wch: 12 }, // Total
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");

      const fileName = `transactions_${format(
        dateRange.from,
        "yyyy-MM-dd"
      )}_${format(dateRange.to, "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setExporting(false);
    }
  };

  const exportToCSV = async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    setExporting(true);
    try {
      const data = await fetchAllDataForExport();
      if (!data || data.length === 0) {
        setExporting(false);
        return;
      }

      const rows = buildExportRows(data);

      const headers = [
        "Date",
        "Time",
        viewMode === "accounts" ? "Account #" : "Transaction ID",
        "Product",
        "Status",
        "Location",
        "Staff",
        "Payment Method",
        "Quantity",
        "Unit Price",
        "Discount",
        "Total (BGN)",
      ];

      const escapeCSV = (val: string | number): string => {
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = [
        headers.map(escapeCSV).join(","),
        ...rows.map((row) =>
          [
            row.date,
            row.time,
            row.transactionId,
            row.product,
            row.status,
            row.location,
            row.staff,
            row.paymentMethod,
            row.quantity,
            row.unitPrice,
            row.discount,
            row.total,
          ]
            .map(escapeCSV)
            .join(",")
        ),
      ];

      const csvContent = csvRows.join("\n");
      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions_${format(
        dateRange.from,
        "yyyy-MM-dd"
      )}_${format(dateRange.to, "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const isExportAvailable = !loading && totalCount > 0 && dateRange?.from && dateRange?.to;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/admin">Admin</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Transactions</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">Transactions</h1>
        <p className="text-muted-foreground mt-1">
          View Barsy orders and record manual transactions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter orders by date range, location, staff, discount, payment
            method, and void status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-9 gap-4">
            <div className="md:col-span-2">
              <Popover>
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
                          {format(dateRange.from, "MMM dd, yyyy")} -{" "}
                          {format(dateRange.to, "MMM dd, yyyy")}
                        </>
                      ) : (
                        format(dateRange.from, "MMM dd, yyyy")
                      )
                    ) : (
                      <span>Select date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                  {dateRange && (
                    <div className="p-3 border-t">
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => setDateRange(undefined)}
                      >
                        Clear dates
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Select
                value={selectedLocation}
                onValueChange={setSelectedLocation}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {barsyLocations.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {barsyStaff.map((staff: any) => (
                    <SelectItem
                      key={staff.user_name}
                      value={JSON.stringify({
                        name: staff.user_name,
                        id: staff.barsy_user_id,
                      })}
                    >
                      {staff.user_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select
                value={viewMode}
                onValueChange={(v: "orders" | "grouped" | "accounts") =>
                  setViewMode(v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orders">Individual Orders</SelectItem>
                  <SelectItem value="grouped">
                    Grouped by Transaction
                  </SelectItem>
                  <SelectItem value="accounts">Accounts (Bills)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select
                value={discountFilter}
                onValueChange={(v: "all" | "with_discount" | "no_discount") =>
                  setDiscountFilter(v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="with_discount">With Discount</SelectItem>
                  <SelectItem value="no_discount">No Discount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select
                value={paymentMethodFilter}
                onValueChange={setPaymentMethodFilter}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="cash">Cash (В брой)</SelectItem>
                  <SelectItem value="card">Card (Карта)</SelectItem>
                  <SelectItem value="wallet">Wallet/House (Изход)</SelectItem>
                  <SelectItem value="no_payment">No Payment Method</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select
                value={voidFilter}
                onValueChange={(
                  v:
                    | "all"
                    | "positive_only"
                    | "voided_only"
                    | "transfers_only"
                    | "pure_voids_only"
                ) => setVoidFilter(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Void Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="positive_only">Positive Only</SelectItem>
                  <SelectItem value="voided_only">All Voided</SelectItem>
                  <SelectItem value="transfers_only">Transfers Only</SelectItem>
                  <SelectItem value="pure_voids_only">
                    Pure Voids Only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-center">
              <Label htmlFor="fiscal-date" className="text-xs mb-1.5">
                Fiscal Period
              </Label>
              <div className="flex items-center gap-2 h-10">
                <Switch
                  id="fiscal-date"
                  checked={useFiscalDate}
                  onCheckedChange={setUseFiscalDate}
                />
                <span className="text-xs text-muted-foreground">
                  {useFiscalDate ? "6:45 AM" : "Off"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {stats &&
        (stats.totalOrders !== undefined ||
          stats.totalAccounts !== undefined ||
          stats.totalTransactions !== undefined) && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* Total Revenue Card */}
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <CardDescription className="text-emerald-700 dark:text-emerald-300">
                      Revenue
                    </CardDescription>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-200 transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-sm" side="top">
                        <p className="font-medium mb-1">Total Revenue</p>
                        <p className="text-muted-foreground">
                          Sum of all order amounts (after discounts). This excludes tips and waste amounts. Calculated as the total &quot;amount&quot; field from Barsy orders.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl sm:text-3xl text-emerald-900 dark:text-emerald-100">
                  {formatAmount(stats.totalRevenue || 0)}{" "}
                  <span className="text-base font-normal text-emerald-600 dark:text-emerald-400">
                    BGN
                  </span>
                </CardTitle>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Excl. tips & waste
                </p>
              </CardHeader>
            </Card>

            {/* Transactions/Orders Count Card */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <CardDescription className="text-blue-700 dark:text-blue-300">
                      {viewMode === "accounts"
                        ? "Accounts"
                        : viewMode === "grouped"
                        ? "Transactions"
                        : "Orders"}
                    </CardDescription>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-sm" side="top">
                        <p className="font-medium mb-1">
                          {viewMode === "accounts"
                            ? "Total Accounts"
                            : viewMode === "grouped"
                            ? "Total Transactions"
                            : "Total Orders"}
                        </p>
                        <p className="text-muted-foreground">
                          {viewMode === "accounts"
                            ? "Number of unique customer accounts (bills) in the selected period."
                            : viewMode === "grouped"
                            ? "Number of transactions grouped by account. Each transaction represents a unique payment event."
                            : "Total number of individual orders. 'Unique' count shows distinct transaction IDs (multiple orders can share one transaction)."}
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl sm:text-3xl text-blue-900 dark:text-blue-100">
                  {(viewMode === "accounts"
                    ? stats.totalAccounts
                    : viewMode === "grouped"
                    ? stats.totalTransactions
                    : stats.totalOrders
                  )?.toLocaleString() || "0"}
                </CardTitle>
                {viewMode === "orders" &&
                  stats.uniqueTransactions !== undefined && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {stats.uniqueTransactions?.toLocaleString() || "0"} unique
                    </p>
                  )}
              </CardHeader>
            </Card>

            {/* Average Transaction Value Card */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <CardDescription className="text-purple-700 dark:text-purple-300">
                      Avg{" "}
                      {viewMode === "accounts"
                        ? "Bill"
                        : viewMode === "grouped"
                        ? "Txn"
                        : "Order"}
                    </CardDescription>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-sm" side="top">
                        <p className="font-medium mb-1">
                          Average {viewMode === "accounts" ? "Bill" : viewMode === "grouped" ? "Transaction" : "Order"} Value
                        </p>
                        <p className="text-muted-foreground">
                          Total Revenue divided by the number of {viewMode === "accounts" ? "accounts" : viewMode === "grouped" ? "transactions" : "unique transactions"}. Shows the average spending per {viewMode === "accounts" ? "customer bill" : "transaction"}.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl sm:text-3xl text-purple-900 dark:text-purple-100">
                  {formatAmount(
                    (() => {
                      const count =
                        viewMode === "accounts"
                          ? stats.totalAccounts
                          : viewMode === "grouped"
                          ? stats.totalTransactions
                          : stats.uniqueTransactions || stats.totalOrders;
                      return count && count > 0
                        ? (stats.totalRevenue || 0) / count
                        : 0;
                    })()
                  )}{" "}
                  <span className="text-base font-normal text-purple-600 dark:text-purple-400">
                    BGN
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>

            {/* Tips Card */}
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <CardDescription className="text-amber-700 dark:text-amber-300">
                      Tips
                    </CardDescription>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200 transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-sm" side="top">
                        <p className="font-medium mb-1">Total Tips</p>
                        <p className="text-muted-foreground">
                          Sum of all tips recorded in Barsy orders. Tips are tracked separately from revenue and are not included in the total revenue calculation.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <HandCoins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl sm:text-3xl text-amber-900 dark:text-amber-100">
                  {formatAmount(stats.totalTips || 0)}{" "}
                  <span className="text-base font-normal text-amber-600 dark:text-amber-400">
                    BGN
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>

            {/* Waste Card */}
            <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/50 dark:to-red-900/30 border-red-200 dark:border-red-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <CardDescription className="text-red-700 dark:text-red-300">
                      Waste
                    </CardDescription>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-sm" side="top">
                        <p className="font-medium mb-1">Total Waste</p>
                        <p className="text-muted-foreground">
                          Sum of all waste amounts from Barsy. This includes items marked as waste, spillage, or breakage. Waste is tracked separately and not included in revenue.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl sm:text-3xl text-red-900 dark:text-red-100">
                  {formatAmount(stats.totalWaste || 0)}{" "}
                  <span className="text-base font-normal text-red-600 dark:text-red-400">
                    BGN
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>

            {/* Discounts Card */}
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/50 dark:to-orange-900/30 border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <CardDescription className="text-orange-700 dark:text-orange-300">
                      Discounts
                    </CardDescription>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-200 transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-sm" side="top">
                        <p className="font-medium mb-1">Total Discounts</p>
                        <p className="text-muted-foreground">
                          Sum of all discounts applied to orders. This is the amount deducted from the original price. The revenue shown already has these discounts subtracted.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Percent className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl sm:text-3xl text-orange-900 dark:text-orange-100">
                  {formatAmount(stats.totalDiscount || 0)}{" "}
                  <span className="text-base font-normal text-orange-600 dark:text-orange-400">
                    BGN
                  </span>
                </CardTitle>
                {stats.ordersWithDiscount !== undefined &&
                  stats.ordersWithDiscount > 0 && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      {stats.ordersWithDiscount?.toLocaleString()} orders
                    </p>
                  )}
              </CardHeader>
            </Card>
          </div>
        )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="barsy">Barsy Orders</TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5">
            <Users className="h-4 w-4" />
            Staff Performance
          </TabsTrigger>
          <TabsTrigger value="create">Manual Entry</TabsTrigger>
        </TabsList>

        <TabsContent value="barsy">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Barsy{" "}
                    {viewMode === "accounts"
                      ? "Accounts (Bills)"
                      : viewMode === "grouped"
                      ? "Transactions"
                      : "Orders"}
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    {loading
                      ? "Loading..."
                      : `${totalCount.toLocaleString()} ${
                          viewMode === "accounts"
                            ? "account"
                            : viewMode === "grouped"
                            ? "transaction"
                            : "order"
                        }(s) • Page ${currentPage} of ${totalPages}`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToExcel}
                    disabled={!isExportAvailable || exporting}
                  >
                    {exporting ? (
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCSV}
                    disabled={!isExportAvailable || exporting}
                  >
                    {exporting ? (
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : viewMode === "accounts" ? (
                accountTransactions.length > 0 ? (
                  <>
                    <div className="space-y-6">
                      {accountTransactions.map((account: any) => (
                        <div
                          key={account.account_id || account.account_number}
                          className="border rounded-lg overflow-hidden"
                        >
                          <div className="bg-muted px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className="font-semibold">
                                Account #{account.account_number}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {formatSofiaTime(
                                  account.open_date,
                                  "MMM d, yyyy HH:mm"
                                )}
                              </span>
                              {account.close_date && (
                                <span className="text-sm text-muted-foreground">
                                  →{" "}
                                  {formatSofiaTime(account.close_date, "HH:mm")}
                                </span>
                              )}
                              <span className="text-sm text-muted-foreground">
                                {account.location_name}
                              </span>
                              {account.client_name && (
                                <span className="text-sm text-purple-600 font-medium">
                                  👤 {account.client_name}
                                </span>
                              )}
                              <span className="text-sm">
                                <span
                                  className={cn(
                                    "px-2 py-1 text-xs rounded",
                                    account.status === "closed"
                                      ? "bg-gray-100 text-gray-700"
                                      : "bg-green-100 text-green-700"
                                  )}
                                >
                                  {account.status || "closed"}
                                </span>
                              </span>
                              {account.payment_methods &&
                                account.payment_methods.length > 0 && (
                                  <span className="text-sm font-medium text-blue-600">
                                    {account.payment_methods.join(", ")}
                                  </span>
                                )}
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold">
                                {formatAmount(account.total_amount)} BGN
                              </div>
                              {account.total_discount > 0 && (
                                <div className="text-sm text-orange-600">
                                  Discount: -
                                  {formatAmount(account.total_discount)} BGN
                                </div>
                              )}
                            </div>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[35%]">
                                  Product
                                </TableHead>
                                <TableHead className="w-[10%]">
                                  Status
                                </TableHead>
                                <TableHead className="text-right w-[12%]">
                                  Qty
                                </TableHead>
                                <TableHead className="text-right w-[14%]">
                                  Unit Price
                                </TableHead>
                                <TableHead className="text-right w-[10%]">
                                  Discount
                                </TableHead>
                                <TableHead className="text-right w-[19%]">
                                  Total
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {account.line_items.map(
                                (item: any, itemIdx: number) => {
                                  const isVoided = item.quantity < 0;
                                  const voidType = item.void_type as
                                    | "transfer"
                                    | "pure_void"
                                    | null;
                                  return (
                                    <TableRow
                                      key={itemIdx}
                                      className={cn(
                                        isVoided &&
                                          voidType === "transfer" &&
                                          "bg-blue-50 dark:bg-blue-950/20",
                                        isVoided &&
                                          voidType === "pure_void" &&
                                          "bg-red-50 dark:bg-red-950/20"
                                      )}
                                    >
                                      <TableCell className="font-medium w-[35%]">
                                        {item.article_name}
                                      </TableCell>
                                      <TableCell className="w-[10%]">
                                        {voidType === "transfer" ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                            <ArrowRightLeft className="h-2.5 w-2.5" />
                                            Transfer
                                          </span>
                                        ) : voidType === "pure_void" ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                            <XCircle className="h-2.5 w-2.5" />
                                            Void
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">
                                            —
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell
                                        className={cn(
                                          "text-right w-[12%]",
                                          isVoided &&
                                            "text-red-600 dark:text-red-400"
                                        )}
                                      >
                                        {formatAmount(item.quantity)}
                                      </TableCell>
                                      <TableCell className="text-right w-[14%]">
                                        {formatAmount(item.unit_price)}
                                      </TableCell>
                                      <TableCell className="text-right w-[10%]">
                                        {item.discount > 0 ? (
                                          <span className="text-orange-600 font-medium">
                                            {item.discount}%
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            -
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell
                                        className={cn(
                                          "text-right w-[19%]",
                                          isVoided &&
                                            "text-red-600 dark:text-red-400"
                                        )}
                                      >
                                        {formatAmount(item.total)} BGN
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-6 border-t">
                      <DataTablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={totalCount}
                        onPageChange={updatePageParam}
                        onPageSizeChange={handlePageSizeChange}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No accounts found for this date range and location
                  </p>
                )
              ) : viewMode === "grouped" ? (
                transactions.length > 0 ? (
                  <>
                    <div className="space-y-6">
                      {transactions.map((transaction: any) => (
                        <div
                          key={transaction.account_id}
                          className="border rounded-lg overflow-hidden"
                        >
                          <div className="bg-muted px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className="font-semibold">
                                Transaction #{transaction.account_id}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {formatSofiaTime(
                                  transaction.order_date,
                                  "MMM d, yyyy HH:mm"
                                )}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {transaction.location_name}
                              </span>
                              {transaction.client_name && (
                                <span className="text-sm text-purple-600 font-medium">
                                  👤 {transaction.client_name}
                                </span>
                              )}
                              {transaction.user_name && (
                                <span className="text-sm text-muted-foreground">
                                  Staff: {transaction.user_name}
                                </span>
                              )}
                              {transaction.payment_methods &&
                                transaction.payment_methods.length > 0 && (
                                  <span className="text-sm font-medium text-blue-600">
                                    {transaction.payment_methods.join(", ")}
                                  </span>
                                )}
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold">
                                {formatAmount(transaction.total_amount)} BGN
                              </div>
                              {transaction.total_discount > 0 && (
                                <div className="text-sm text-orange-600">
                                  Discount: -
                                  {formatAmount(transaction.total_discount)} BGN
                                </div>
                              )}
                            </div>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[35%]">
                                  Product
                                </TableHead>
                                <TableHead className="w-[10%]">
                                  Status
                                </TableHead>
                                <TableHead className="text-right w-[12%]">
                                  Qty
                                </TableHead>
                                <TableHead className="text-right w-[14%]">
                                  Unit Price
                                </TableHead>
                                <TableHead className="text-right w-[10%]">
                                  Discount
                                </TableHead>
                                <TableHead className="text-right w-[19%]">
                                  Total
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {transaction.line_items.map(
                                (item: any, itemIdx: number) => {
                                  const isVoided = item.quantity < 0;
                                  const voidType = item.void_type as
                                    | "transfer"
                                    | "pure_void"
                                    | null;
                                  return (
                                    <TableRow
                                      key={itemIdx}
                                      className={cn(
                                        isVoided &&
                                          voidType === "transfer" &&
                                          "bg-blue-50 dark:bg-blue-950/20",
                                        isVoided &&
                                          voidType === "pure_void" &&
                                          "bg-red-50 dark:bg-red-950/20"
                                      )}
                                    >
                                      <TableCell className="font-medium w-[35%]">
                                        {item.article_name}
                                      </TableCell>
                                      <TableCell className="w-[10%]">
                                        {voidType === "transfer" ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                            <ArrowRightLeft className="h-2.5 w-2.5" />
                                            Transfer
                                          </span>
                                        ) : voidType === "pure_void" ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                            <XCircle className="h-2.5 w-2.5" />
                                            Void
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">
                                            —
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell
                                        className={cn(
                                          "text-right w-[12%]",
                                          isVoided &&
                                            "text-red-600 dark:text-red-400"
                                        )}
                                      >
                                        {formatAmount(item.quantity)}
                                      </TableCell>
                                      <TableCell className="text-right w-[14%]">
                                        {formatAmount(item.unit_price)}
                                      </TableCell>
                                      <TableCell className="text-right w-[10%]">
                                        {item.discount > 0 ? (
                                          <span className="text-orange-600 font-medium">
                                            {item.discount}%
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            -
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell
                                        className={cn(
                                          "text-right w-[19%]",
                                          isVoided &&
                                            "text-red-600 dark:text-red-400"
                                        )}
                                      >
                                        {formatAmount(item.total)} BGN
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-6 border-t">
                      <DataTablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={totalCount}
                        onPageChange={updatePageParam}
                        onPageSizeChange={handlePageSizeChange}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No transactions found for this date range and location
                  </p>
                )
              ) : orders.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => {
                        const discount = order.raw_data?.discount
                          ? Math.abs(Number(order.raw_data.discount))
                          : 0;
                        const isVoided = Number(order.amount) < 0;
                        const voidType = order.void_type as
                          | "transfer"
                          | "pure_void"
                          | null;
                        return (
                          <TableRow
                            key={order.id}
                            className={cn(
                              isVoided &&
                                voidType === "transfer" &&
                                "bg-blue-50 dark:bg-blue-950/20",
                              isVoided &&
                                voidType === "pure_void" &&
                                "bg-red-50 dark:bg-red-950/20"
                            )}
                          >
                            <TableCell className="whitespace-nowrap">
                              {formatSofiaTime(
                                order.order_date,
                                "MMM d, yyyy HH:mm"
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {order.article_name}
                            </TableCell>
                            <TableCell>
                              {voidType === "transfer" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                  <ArrowRightLeft className="h-3 w-3" />
                                  Transfer
                                </span>
                              ) : voidType === "pure_void" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                  <XCircle className="h-3 w-3" />
                                  Voided
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  Sale
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {order.barsy_locations?.name || "-"}
                            </TableCell>
                            <TableCell>{order.user_name || "-"}</TableCell>
                            <TableCell>
                              {order.payment_methods &&
                              order.payment_methods.length > 0 ? (
                                <span className="text-sm text-blue-600 font-medium">
                                  {order.payment_methods.join(", ")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  -
                                </span>
                              )}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right",
                                isVoided && "text-red-600 dark:text-red-400"
                              )}
                            >
                              {formatAmount(Number(order.amount))}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatAmount(Number(order.actual_price))}
                            </TableCell>
                            <TableCell className="text-right">
                              {discount > 0 ? (
                                <span className="text-orange-600 font-medium">
                                  {discount}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-semibold",
                                isVoided && "text-red-600 dark:text-red-400"
                              )}
                            >
                              {formatAmount(
                                Number(order.amount) *
                                  Number(order.actual_price)
                              )}{" "}
                              BGN
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <div className="mt-6 pt-6 border-t">
                    <DataTablePagination
                      currentPage={currentPage}
                      pageSize={pageSize}
                      totalItems={totalCount}
                      onPageChange={updatePageParam}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No orders found for this date range and location
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Staff Performance
              </CardTitle>
              <CardDescription>
                {staffLoading
                  ? "Loading staff performance data..."
                  : `Performance metrics for ${staffPerformance.length} staff members in the selected period`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaffPerformanceTable
                data={staffPerformance}
                loading={staffLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Manual Transaction Entry</CardTitle>
              <CardDescription>
                Record a manual sale (optional - Barsy orders sync
                automatically)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateTransactionForm
                locations={locations}
                products={products}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
