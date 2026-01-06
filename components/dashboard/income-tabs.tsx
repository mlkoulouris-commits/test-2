"use client";

import { IncomeReportForm } from "@/components/dashboard/income-report-form";
import { MyIncomeReports } from "@/components/dashboard/my-income-reports";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/i18n/context";
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

export const IncomeTabs = ({ locations }: { locations: Location[] }) => {
  const { t } = useLanguage();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState("submit");
  const [editingReport, setEditingReport] = useState<EditReport | null>(null);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "history") {
      // Trigger a refresh when switching to history tab
      setRefreshTrigger((prev) => prev + 1);
    }
    if (value === "submit") {
      // Clear editing report when switching to submit tab
      setEditingReport(null);
    }
  };

  const handleReportSubmitted = () => {
    // Increment refresh trigger to reload reports
    setRefreshTrigger((prev) => prev + 1);
    // Clear editing state
    setEditingReport(null);
    // Switch to history tab to show the submitted report
    setActiveTab("history");
  };

  const handleEditReport = (report: EditReport) => {
    setEditingReport(report);
    setActiveTab("submit");
  };

  return (
    <div>
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submit">
            {editingReport ? t("income.editReport") : t("income.submitReport")}
          </TabsTrigger>
          <TabsTrigger value="history">{t("income.myReports")}</TabsTrigger>
        </TabsList>
        <TabsContent value="submit" className="mt-4">
          <IncomeReportForm
            locations={locations}
            onSuccess={handleReportSubmitted}
            editingReport={editingReport}
            onCancelEdit={() => setEditingReport(null)}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <MyIncomeReports
            refreshTrigger={refreshTrigger}
            onEditReport={handleEditReport}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
