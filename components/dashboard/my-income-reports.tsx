"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMyIncomeReports } from "@/lib/actions/employee-income";
import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import { useDateFormatter } from "@/lib/i18n/date-formatter";
import {
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  FileText,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Report {
  id: number;
  business_date: string;
  cash_sales: number;
  cash_tips: number;
  card_sales: number;
  card_tips: number;
  bill_breakdown: {
    under_5_total: number;
    count_5: number;
    count_10: number;
    count_20: number;
    count_50: number;
    count_100: number;
    count_200: number;
  };
  note: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  approved_by_profile?: {
    user_id: string;
    first_name: string;
    last_name: string;
  } | null;
  locations: {
    id: number;
    name: string;
  };
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

interface MyIncomeReportsProps {
  refreshTrigger?: number;
  onEditReport?: (report: EditReport) => void;
}

export const MyIncomeReports = ({
  refreshTrigger,
  onEditReport,
}: MyIncomeReportsProps = {}) => {
  const { t } = useLanguage();
  const { formatAmount, getCurrencySymbol } = useCurrency();
  const { formatDate } = useDateFormatter();

  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    loadReports();
  }, [refreshTrigger]);

  const loadReports = async () => {
    setIsLoading(true);
    const result = await getMyIncomeReports();
    if (result.success && result.data) {
      setReports(result.data as Report[]);
    }
    setIsLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {t("billStatus.approved")}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            {t("billStatus.rejected")}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            {t("billStatus.pending")}
          </Badge>
        );
    }
  };

  const getTotalAmount = (report: Report) => {
    return (
      report.cash_sales +
      report.cash_tips +
      report.card_sales +
      report.card_tips
    );
  };

  const viewDetails = (report: Report) => {
    setSelectedReport(report);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {reports.length === 0 ? (
            <p className="text-muted-foreground">
              {t("incomeReports.noReports")}
            </p>
          ) : (
            <div className="space-y-4 sm:space-y-0">
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
                {reports.map((report) => (
                  <Card key={report.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">
                            {formatDate(
                              new Date(report.business_date),
                              "MMM dd, yyyy"
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {report.locations.name}
                          </p>
                        </div>
                        {getStatusBadge(report.status)}
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex-1">
                          <p className="text-2xl font-bold">
                            {formatAmount(getTotalAmount(report), "BGN")}{" "}
                            {getCurrencySymbol("BGN")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("incomeReports.submitted")}{" "}
                            {formatDate(
                              new Date(report.submitted_at),
                              "MMM dd, HH:mm"
                            )}
                          </p>
                          {report.status === "approved" &&
                            report.approved_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("incomeReports.approvedBy")}{" "}
                                {report.approved_by_profile
                                  ? `${report.approved_by_profile.first_name} ${report.approved_by_profile.last_name}`
                                  : t("incomeApproval.unknownEmployee")}{" "}
                                {t("incomeReports.on")}{" "}
                                {formatDate(
                                  new Date(report.approved_at),
                                  "MMM dd, HH:mm"
                                )}
                              </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                          {report.note && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <FileText className="h-5 w-5 text-yellow-500 hover:text-yellow-600 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="left"
                                  className="max-w-xs"
                                >
                                  <p className="text-sm whitespace-pre-wrap">
                                    {report.note}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {report.status === "pending" && onEditReport && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onEditReport({
                                  id: report.id,
                                  location_id: report.locations.id,
                                  business_date: report.business_date,
                                  bill_breakdown: report.bill_breakdown,
                                  cash_tips: report.cash_tips,
                                  card_sales: report.card_sales,
                                  card_tips: report.card_tips,
                                  note: report.note,
                                })
                              }
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              {t("common.edit")}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDetails(report)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {t("incomeReports.view")}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("incomeReports.date")}</TableHead>
                      <TableHead>{t("incomeReports.location")}</TableHead>
                      <TableHead className="text-right">
                        {t("incomeReports.totalAmount")}
                      </TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("incomeReports.submitted")}</TableHead>
                      <TableHead>{t("incomeReports.approved")}</TableHead>
                      <TableHead>{t("incomeReports.approvedBy")}</TableHead>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="text-right">
                        {t("common.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {formatDate(
                            new Date(report.business_date),
                            "MMM dd, yyyy"
                          )}
                        </TableCell>
                        <TableCell>{report.locations.name}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(getTotalAmount(report), "BGN")}{" "}
                          {getCurrencySymbol("BGN")}
                        </TableCell>
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(
                            new Date(report.submitted_at),
                            "MMM dd, HH:mm"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {report.status === "approved" && report.approved_at
                            ? formatDate(
                                new Date(report.approved_at),
                                "MMM dd, HH:mm"
                              )
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {report.status === "approved" &&
                          report.approved_by_profile
                            ? `${report.approved_by_profile.first_name} ${report.approved_by_profile.last_name}`
                            : report.status === "approved"
                            ? t("incomeApproval.unknownEmployee")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {report.note && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <FileText className="h-5 w-5 text-yellow-500 hover:text-yellow-600 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="left"
                                  className="max-w-xs"
                                >
                                  <p className="text-sm whitespace-pre-wrap">
                                    {report.note}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {report.status === "pending" && onEditReport && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  onEditReport({
                                    id: report.id,
                                    location_id: report.locations.id,
                                    business_date: report.business_date,
                                    bill_breakdown: report.bill_breakdown,
                                    cash_tips: report.cash_tips,
                                    card_sales: report.card_sales,
                                    card_tips: report.card_tips,
                                    note: report.note,
                                  })
                                }
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                {t("common.edit")}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewDetails(report)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {t("incomeReports.view")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("incomeReports.reportDetails")}</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("incomeReports.date")}
                  </p>
                  <p className="font-semibold">
                    {formatDate(
                      new Date(selectedReport.business_date),
                      "MMMM dd, yyyy"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("incomeReports.location")}
                  </p>
                  <p className="font-semibold">
                    {selectedReport.locations.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("common.status")}
                  </p>
                  <div className="mt-1">
                    {getStatusBadge(selectedReport.status)}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("incomeReports.submitted")}
                  </p>
                  <p className="font-semibold">
                    {formatDate(
                      new Date(selectedReport.submitted_at),
                      "MMM dd, yyyy HH:mm"
                    )}
                  </p>
                </div>
                {selectedReport.status === "approved" &&
                  selectedReport.approved_at && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("incomeReports.approvedBy")}
                        </p>
                        <p className="font-semibold">
                          {selectedReport.approved_by_profile
                            ? `${selectedReport.approved_by_profile.first_name} ${selectedReport.approved_by_profile.last_name}`
                            : t("incomeApproval.unknownEmployee")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("incomeReports.approvedAt")}
                        </p>
                        <p className="font-semibold">
                          {formatDate(
                            new Date(selectedReport.approved_at),
                            "MMM dd, yyyy HH:mm"
                          )}
                        </p>
                      </div>
                    </>
                  )}
              </div>

              {/* Bill Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t("incomeReports.cashBreakdown")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t("incomeApproval.coinsSmallBills")}</span>
                    <span className="font-semibold">
                      {formatAmount(
                        selectedReport.bill_breakdown.under_5_total,
                        "BGN"
                      )}{" "}
                      {getCurrencySymbol("BGN")}
                    </span>
                  </div>
                  {[
                    {
                      label: t("incomeApproval.bills5"),
                      count: selectedReport.bill_breakdown.count_5,
                      value: 5,
                    },
                    {
                      label: t("incomeApproval.bills10"),
                      count: selectedReport.bill_breakdown.count_10,
                      value: 10,
                    },
                    {
                      label: t("incomeApproval.bills20"),
                      count: selectedReport.bill_breakdown.count_20,
                      value: 20,
                    },
                    {
                      label: t("incomeApproval.bills50"),
                      count: selectedReport.bill_breakdown.count_50,
                      value: 50,
                    },
                    {
                      label: t("incomeApproval.bills100"),
                      count: selectedReport.bill_breakdown.count_100,
                      value: 100,
                    },
                    {
                      label: t("incomeApproval.bills200"),
                      count: selectedReport.bill_breakdown.count_200,
                      value: 200,
                    },
                  ].map(
                    ({ label, count, value }) =>
                      count > 0 && (
                        <div
                          key={label}
                          className="flex justify-between text-sm"
                        >
                          <span>
                            {label} × {count}
                          </span>
                          <span className="font-semibold">
                            {formatAmount(count * value, "BGN")}{" "}
                            {getCurrencySymbol("BGN")}
                          </span>
                        </div>
                      )
                  )}
                  <div className="flex justify-between text-base font-bold pt-2 border-t">
                    <span>{t("incomeApproval.cashSalesTotal")}</span>
                    <span>
                      {formatAmount(selectedReport.cash_sales, "BGN")}{" "}
                      {getCurrencySymbol("BGN")}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Other Income */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t("incomeApproval.tipsCardSales")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t("incomeApproval.cashTips")}</span>
                    <span className="font-semibold">
                      {formatAmount(selectedReport.cash_tips, "BGN")}{" "}
                      {getCurrencySymbol("BGN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t("incomeApproval.cardPosSales")}</span>
                    <span className="font-semibold">
                      {formatAmount(selectedReport.card_sales, "BGN")}{" "}
                      {getCurrencySymbol("BGN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t("incomeApproval.cardPosTips")}</span>
                    <span className="font-semibold">
                      {formatAmount(selectedReport.card_tips, "BGN")}{" "}
                      {getCurrencySymbol("BGN")}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Grand Total */}
              <Card className="bg-primary text-primary-foreground">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">
                      {t("incomeApproval.totalIncome")}
                    </span>
                    <span className="text-2xl font-bold">
                      {formatAmount(getTotalAmount(selectedReport), "BGN")}{" "}
                      {getCurrencySymbol("BGN")}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Note */}
              {selectedReport.note && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("incomeForm.note")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedReport.note}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Approval Info */}
              {selectedReport.status === "approved" &&
                selectedReport.approved_at && (
                  <div className="text-sm text-muted-foreground">
                    {t("incomeReports.approvedOn")}{" "}
                    {formatDate(
                      new Date(selectedReport.approved_at),
                      "MMM dd, yyyy HH:mm"
                    )}
                  </div>
                )}

              {/* Rejection Info */}
              {selectedReport.status === "rejected" && (
                <Card className="border-destructive">
                  <CardHeader>
                    <CardTitle className="text-base text-destructive">
                      {t("incomeApproval.rejectionReason")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedReport.rejected_reason}</p>
                    {selectedReport.approved_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {t("incomeReports.rejectedOn")}{" "}
                        {formatDate(
                          new Date(selectedReport.approved_at),
                          "MMM dd, yyyy HH:mm"
                        )}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
