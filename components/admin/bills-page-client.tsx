"use client";

import { BillsFilters } from "@/components/admin/bills-filters";
import { BillsTable } from "@/components/admin/bills-table";
import { CreateManualBillDialog } from "@/components/admin/create-manual-bill-dialog";
import { RecordMultiBillPaymentDialog } from "@/components/admin/record-multi-bill-payment-dialog";
import { RecurringBillsTab } from "@/components/admin/recurring-bills-tab";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CreditCard,
  DollarSign,
  Receipt,
} from "lucide-react";
import Link from "next/link";

interface BillsPageClientProps {
  bills: any[];
  stats: {
    totalUnpaid: number;
    partiallyPaid: number;
    outstanding: number;
    overdue: number;
    dueThisMonth: number;
  };
  vendors: any[];
  locations: any[];
  currentPage: number;
  error?: string;
  pendingRecurringCount?: number;
}

export const BillsPageClient = ({
  bills,
  stats,
  vendors,
  locations,
  currentPage,
  error,
  pendingRecurringCount = 0,
}: BillsPageClientProps) => {
  const { t, locale } = useLanguage();
  const { formatAmount } = useCurrency();

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">{t("common.admin")}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t("nav.bills")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("bills.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("bills.description")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/bill-payments">
            <Button variant="outline">
              <Receipt className="h-4 w-4 mr-2" />
              {t("bills.viewPayments")}
            </Button>
          </Link>
          <RecordMultiBillPaymentDialog />
          <CreateManualBillDialog />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Link href="/admin/bills?status=approved">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("bills.totalUnpaid")}
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUnpaid}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/bills?status=partially_paid">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("bills.partiallyPaid")}
              </CardTitle>
              <CreditCard className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.partiallyPaid}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/bills?status=outstanding">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("bills.outstanding")}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatAmount(stats.outstanding, "BGN")}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/bills?status=overdue">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("bills.overdue")}
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatAmount(stats.overdue, "BGN")}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/bills?status=due_this_month">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("bills.dueThisMonth")}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatAmount(stats.dueThisMonth, "BGN")}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Tabs defaultValue="bills" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bills" className="gap-2">
            <CreditCard className="h-4 w-4" />
            {locale === "bg" ? "Фактури" : "Bills"}
          </TabsTrigger>
          <TabsTrigger value="recurring" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            {locale === "bg" ? "Периодични" : "Recurring"}
            {pendingRecurringCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {pendingRecurringCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bills">
          <Card>
            <CardHeader>
              <BillsFilters vendors={vendors} locations={locations} />
            </CardHeader>
            <CardContent>
              {error ? (
                <p className="text-destructive">{error}</p>
              ) : (
                <BillsTable bills={bills} currentPage={currentPage} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring">
          <Card>
            <CardContent className="pt-6">
              <RecurringBillsTab
                locations={locations}
                vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
