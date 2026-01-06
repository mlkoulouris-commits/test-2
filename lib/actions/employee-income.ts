"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface BillBreakdown {
  under_5_total: number;
  count_5: number;
  count_10: number;
  count_20: number;
  count_50: number;
  count_100: number;
  count_200: number;
}

export interface SubmissionMetadata {
  browser?: string;
  device?: string;
  user_agent?: string;
  screen_resolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  geolocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: string;
}

export interface SubmitIncomeReportData {
  locationId: number;
  businessDate: string;
  billBreakdown: BillBreakdown;
  cashTips: number;
  cardSales: number;
  cardTips: number;
  note?: string;
  submissionMetadata?: SubmissionMetadata;
}

export interface IncomeReport {
  id: number;
  user_id: string;
  location_id: number;
  business_date: string;
  cash_sales: number;
  cash_tips: number;
  card_sales: number;
  card_tips: number;
  bill_breakdown: BillBreakdown;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  bank_account_id: number | null;
  created_at: string;
  updated_at: string;
}

// Calculate cash sales from bill breakdown
const calculateCashSales = (breakdown: BillBreakdown): number => {
  return (
    breakdown.under_5_total +
    breakdown.count_5 * 5 +
    breakdown.count_10 * 10 +
    breakdown.count_20 * 20 +
    breakdown.count_50 * 50 +
    breakdown.count_100 * 100 +
    breakdown.count_200 * 200
  );
};

// Report sales (staff)
export const submitIncomeReport = async (data: SubmitIncomeReportData) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Calculate cash_sales from bill breakdown
  const cashSales = calculateCashSales(data.billBreakdown);

  try {
    // Always create new report (multiple reports per day are now allowed)
    const { data: report, error } = await supabase
      .from("employee_income_reports")
      .insert({
        user_id: user.id,
        location_id: data.locationId,
        business_date: data.businessDate,
        cash_sales: cashSales,
        cash_tips: data.cashTips,
        card_sales: data.cardSales,
        card_tips: data.cardTips,
        bill_breakdown: data.billBreakdown,
        note: data.note || null,
        status: "pending",
        submission_metadata: data.submissionMetadata || null,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/income");
    return { success: true, data: report };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to submit report",
    };
  }
};

// Update income report (staff can only edit pending reports)
export const updateIncomeReport = async (
  reportId: number,
  data: SubmitIncomeReportData
) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    // Check if report exists and belongs to user
    const { data: existingReport, error: fetchError } = await supabase
      .from("employee_income_reports")
      .select("*")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingReport) {
      return { error: "Report not found" };
    }

    if (existingReport.status !== "pending") {
      return { error: `Cannot edit ${existingReport.status} report` };
    }

    // Calculate cash_sales from bill breakdown
    const cashSales = calculateCashSales(data.billBreakdown);

    const { data: report, error } = await supabase
      .from("employee_income_reports")
      .update({
        location_id: data.locationId,
        business_date: data.businessDate,
        cash_sales: cashSales,
        cash_tips: data.cashTips,
        card_sales: data.cardSales,
        card_tips: data.cardTips,
        bill_breakdown: data.billBreakdown,
        note: data.note || null,
        submission_metadata: data.submissionMetadata || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/income");
    return { success: true, data: report };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update report",
    };
  }
};

// Get current user's income reports
export const getMyIncomeReports = async (filters?: {
  startDate?: string;
  endDate?: string;
  status?: "pending" | "approved" | "rejected";
}) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    let query = supabase
      .from("employee_income_reports")
      .select(
        `
        *,
        locations:location_id (
          id,
          name
        )
      `
      )
      .eq("user_id", user.id)
      .order("business_date", { ascending: false });

    if (filters?.startDate) {
      query = query.gte("business_date", filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte("business_date", filters.endDate);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    // Fetch approved_by profiles for approved/rejected reports
    if (data && data.length > 0) {
      const approvedByIds = [
        ...new Set(data.map((r: any) => r.approved_by).filter(Boolean)),
      ];
      if (approvedByIds.length > 0) {
        const { data: approverProfiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", approvedByIds);

        // Attach approver profile to each report
        const reportsWithApprovers = data.map((report: any) => ({
          ...report,
          approved_by_profile: report.approved_by
            ? approverProfiles?.find(
                (p: any) => p.user_id === report.approved_by
              ) || null
            : null,
        }));

        return { success: true, data: reportsWithApprovers };
      }
    }

    return { success: true, data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to fetch reports",
    };
  }
};

// Get reports for approval (managers/admins)
export const getReportsForApproval = async (
  locationId?: number,
  status?: "pending" | "approved" | "rejected",
  employeeId?: string,
  startDate?: string,
  endDate?: string
) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const isManager =
    profile?.role === "location_manager" ||
    profile?.role === "manager" ||
    isAdmin;

  if (!isManager) {
    return { error: "Unauthorized: Manager access required" };
  }

  try {
    let query = supabase
      .from("employee_income_reports")
      .select(
        `
        *,
        locations:location_id (
          id,
          name
        )
      `
      )
      .order("business_date", { ascending: false })
      .order("submitted_at", { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    }

    // If not admin, filter by assigned locations
    if (!isAdmin) {
      const { data: userLocations } = await supabase
        .from("user_locations")
        .select("location_id")
        .eq("user_id", user.id);

      const locationIds = userLocations?.map((ul) => ul.location_id) || [];

      if (locationIds.length === 0) {
        return { success: true, data: [] };
      }

      query = query.in("location_id", locationIds);
    }

    // Additional location filter if provided
    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    // Employee filter if provided
    if (employeeId) {
      query = query.eq("user_id", employeeId);
    }

    // Date range filter if provided
    if (startDate) {
      query = query.gte("business_date", startDate);
    }
    if (endDate) {
      query = query.lte("business_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    // Fetch employee profiles for each report
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      // Fetch approved_by profiles for approved/rejected reports
      const approvedByIds = [
        ...new Set(data.map((r: any) => r.approved_by).filter(Boolean)),
      ];
      let approverProfiles: any[] = [];
      if (approvedByIds.length > 0) {
        const { data: approvers } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", approvedByIds);
        approverProfiles = approvers || [];
      }

      // Attach profiles to each report
      const reportsWithProfiles = data.map((report: any) => ({
        ...report,
        employee_profile:
          profiles?.find((p: any) => p.user_id === report.user_id) || null,
        approved_by_profile: report.approved_by
          ? approverProfiles?.find(
              (p: any) => p.user_id === report.approved_by
            ) || null
          : null,
      }));

      return { success: true, data: reportsWithProfiles };
    }

    return { success: true, data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to fetch reports",
    };
  }
};

// Get pending reports for approval (managers/admins) - kept for backwards compatibility
export const getPendingReports = async (locationId?: number) => {
  return getReportsForApproval(locationId, "pending");
};

// Review and approve sales report (managers/admins)
export const approveIncomeReport = async (
  reportId: number,
  cashAccountId: number,
  cardAccountId: number
) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check user role and permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const isManager =
    profile?.role === "location_manager" ||
    profile?.role === "manager" ||
    isAdmin;

  if (!isManager) {
    return { error: "Unauthorized: Manager access required" };
  }

  try {
    // Get the report
    const { data: report, error: fetchError } = await supabase
      .from("employee_income_reports")
      .select("*, locations(id)")
      .eq("id", reportId)
      .single();

    if (fetchError || !report) {
      return { error: "Report not found" };
    }

    if (report.status !== "pending") {
      return { error: `Report is already ${report.status}` };
    }

    // Check location access for non-admins
    if (!isAdmin) {
      const { data: userLocations } = await supabase
        .from("user_locations")
        .select("location_id")
        .eq("user_id", user.id);

      const locationIds = userLocations?.map((ul) => ul.location_id) || [];

      if (!locationIds.includes(report.location_id)) {
        return {
          error: "Unauthorized: You cannot approve reports for this location",
        };
      }
    }

    // Validate both accounts belong to the same location
    const { data: accounts } = await supabase
      .from("bank_accounts")
      .select("id, location_id, current_balance, account_type")
      .in("id", [cashAccountId, cardAccountId]);

    if (!accounts || accounts.length !== 2) {
      return { error: "Invalid accounts selected" };
    }

    const cashAccount = accounts.find((a) => a.id === cashAccountId);
    const cardAccount = accounts.find((a) => a.id === cardAccountId);

    if (!cashAccount || !cardAccount) {
      return { error: "Invalid accounts selected" };
    }

    if (
      cashAccount.location_id !== report.location_id ||
      cardAccount.location_id !== report.location_id
    ) {
      return {
        error: "Accounts must belong to the same location as the report",
      };
    }

    // Calculate amounts for each account
    // Note: cash_tips are excluded from cashAmount as they are just recorded, not deposited
    const cashAmount = Number(report.cash_sales);
    const cardAmount = Number(report.card_sales) + Number(report.card_tips);

    // Update report status
    const { error: updateError } = await supabase
      .from("employee_income_reports")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        bank_account_id: cashAccountId, // Store primary account (cash)
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (updateError) {
      return { error: updateError.message };
    }

    // Update cash account balance
    const newCashBalance = Number(cashAccount.current_balance) + cashAmount;
    const { error: cashBalanceError } = await supabase
      .from("bank_accounts")
      .update({
        current_balance: newCashBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cashAccountId);

    if (cashBalanceError) {
      return { error: cashBalanceError.message };
    }

    // Update card account balance
    const newCardBalance = Number(cardAccount.current_balance) + cardAmount;
    const { error: cardBalanceError } = await supabase
      .from("bank_accounts")
      .update({
        current_balance: newCardBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardAccountId);

    if (cardBalanceError) {
      return { error: cardBalanceError.message };
    }

    revalidatePath("/dashboard/income/approve");
    revalidatePath("/dashboard/income");

    return {
      success: true,
      message: "Report approved and accounts updated",
      cashAmount,
      cardAmount,
      newCashBalance,
      newCardBalance,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to approve report",
    };
  }
};

// Reject income report (managers/admins)
export const rejectIncomeReport = async (reportId: number, reason: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check user role and permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const isManager =
    profile?.role === "location_manager" ||
    profile?.role === "manager" ||
    isAdmin;

  if (!isManager) {
    return { error: "Unauthorized: Manager access required" };
  }

  if (!reason || reason.trim().length === 0) {
    return { error: "Rejection reason is required" };
  }

  try {
    // Get the report
    const { data: report, error: fetchError } = await supabase
      .from("employee_income_reports")
      .select("*, locations(id)")
      .eq("id", reportId)
      .single();

    if (fetchError || !report) {
      return { error: "Report not found" };
    }

    if (report.status !== "pending") {
      return { error: `Report is already ${report.status}` };
    }

    // Check location access for non-admins
    if (!isAdmin) {
      const { data: userLocations } = await supabase
        .from("user_locations")
        .select("location_id")
        .eq("user_id", user.id);

      const locationIds = userLocations?.map((ul) => ul.location_id) || [];

      if (!locationIds.includes(report.location_id)) {
        return {
          error: "Unauthorized: You cannot reject reports for this location",
        };
      }
    }

    // Update report status
    const { error: updateError } = await supabase
      .from("employee_income_reports")
      .update({
        status: "rejected",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejected_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (updateError) {
      return { error: updateError.message };
    }

    revalidatePath("/dashboard/income/approve");
    revalidatePath("/dashboard/income");

    return { success: true, message: "Report rejected" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to reject report",
    };
  }
};

// Get bank accounts for a location (for approval dropdown)
export const getBankAccountsForLocation = async (locationId: number) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_accounts")
    .select(
      `
      *,
      location:locations!bank_accounts_location_id_fkey (id, name)
    `
    )
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("account_name");

  if (error) {
    return { error: error.message };
  }

  return { success: true, data };
};
