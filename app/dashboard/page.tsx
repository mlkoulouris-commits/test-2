import { StaffMemberDashboard } from "@/components/dashboard/staff-member-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import {
  getCurrentBusinessDate,
  getFormattedBusinessDate,
} from "@/lib/utils/business-date";
import { Calendar, DollarSign, Receipt } from "lucide-react";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Redirect shareholders to sales report
  if (profile?.role === "shareholder") {
    redirect("/admin/reports/sales");
  }

  const isStaffMember = profile?.role === "staff_member";
  const isAdmin = profile?.role === "admin";

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    manager: "Manager",
    location_manager: "Location Manager",
    staff_member: "Staff Member",
    shareholder: "Shareholder",
  };

  // Staff members see a simplified dashboard
  if (isStaffMember) {
    return (
      <StaffMemberDashboard
        firstName={profile?.first_name || ""}
        lastName={profile?.last_name || ""}
      />
    );
  }

  // Admins get all locations, others get assigned locations
  let userLocations = [];
  if (isAdmin) {
    const { data: allLocations } = await supabase
      .from("locations")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    userLocations =
      allLocations?.map((loc) => ({ location_id: loc.id, locations: loc })) ||
      [];
  } else {
    const { data: assignedLocations } = await supabase
      .from("user_locations")
      .select("location_id, locations(id, name)")
      .eq("user_id", user.id);
    userLocations = assignedLocations || [];
  }

  const businessDate = getCurrentBusinessDate();
  const formattedBusinessDate = getFormattedBusinessDate();

  // Get today's income reports (sales entries)
  const { data: todayReports } = await supabase
    .from("employee_income_reports")
    .select("*")
    .eq("business_date", businessDate);

  // Calculate sales statistics
  const pendingReports =
    todayReports?.filter((r) => r.status === "pending") || [];
  const approvedReports =
    todayReports?.filter((r) => r.status === "approved") || [];
  const rejectedReports =
    todayReports?.filter((r) => r.status === "rejected") || [];

  const totalCashSales =
    todayReports?.reduce((sum, r) => sum + (r.cash_sales || 0), 0) || 0;
  const totalCardSales =
    todayReports?.reduce((sum, r) => sum + (r.card_sales || 0), 0) || 0;
  const totalCashTips =
    todayReports?.reduce((sum, r) => sum + (r.cash_tips || 0), 0) || 0;
  const totalCardTips =
    todayReports?.reduce((sum, r) => sum + (r.card_tips || 0), 0) || 0;
  const totalRevenue =
    totalCashSales + totalCardSales + totalCashTips + totalCardTips;

  // Calculate revenue per location
  const locationRevenue = userLocations
    .map((ul: any) => {
      const locationId = ul.location_id;
      const locationName = ul.locations?.name || "Unknown Location";

      if (!locationId) {
        return null;
      }

      const locationReports =
        todayReports?.filter((r: any) => r.location_id === locationId) || [];

      const cashSales = locationReports.reduce(
        (sum: number, r: any) => sum + (Number(r.cash_sales) || 0),
        0
      );
      const cardSales = locationReports.reduce(
        (sum: number, r: any) => sum + (Number(r.card_sales) || 0),
        0
      );
      const cashTips = locationReports.reduce(
        (sum: number, r: any) => sum + (Number(r.cash_tips) || 0),
        0
      );
      const cardTips = locationReports.reduce(
        (sum: number, r: any) => sum + (Number(r.card_tips) || 0),
        0
      );
      const revenue = cashSales + cardSales + cashTips + cardTips;

      return {
        locationId,
        locationName,
        revenue,
        cashSales,
        cardSales,
        cashTips,
        cardTips,
      };
    })
    .filter((loc): loc is NonNullable<typeof loc> => loc !== null);

  // Get today's transactions count
  const { count: todayTransactionsCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {profile?.first_name} {profile?.last_name} (
          {roleLabels[profile?.role || ""] || profile?.role})
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Business Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formattedBusinessDate}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Sales before 8 AM count for previous day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Reports</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayReports?.length || 0}
            </div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-yellow-600">
                ⏳ {pendingReports.length} pending
              </span>
              <span className="text-green-600">
                ✓ {approvedReports.length} approved
              </span>
              {rejectedReports.length > 0 && (
                <span className="text-red-600">
                  ✗ {rejectedReports.length} rejected
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalRevenue)} BGN
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Cash Sales:</span>
                <span>{formatCurrency(totalCashSales)} BGN</span>
              </div>
              <div className="flex justify-between">
                <span>Card Sales:</span>
                <span>{formatCurrency(totalCardSales)} BGN</span>
              </div>
              <div className="flex justify-between">
                <span>Tips:</span>
                <span>{formatCurrency(totalCashTips + totalCardTips)} BGN</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {locationRevenue.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Revenue by Location</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locationRevenue.map((loc) => (
              <Card key={loc.locationId}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {loc.locationName}
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(loc.revenue)} BGN
                  </div>
                  <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Cash Sales:</span>
                      <span>{formatCurrency(loc.cashSales)} BGN</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Card Sales:</span>
                      <span>{formatCurrency(loc.cardSales)} BGN</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tips:</span>
                      <span>
                        {formatCurrency(loc.cashTips + loc.cardTips)} BGN
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
