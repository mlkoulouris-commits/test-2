"use server";

import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { revalidatePath } from "next/cache";

// ============================================================================
// TYPES
// ============================================================================

export type RecurringSalaryFrequency = "weekly" | "monthly" | "bimonthly";
export type CostType = "salary" | "bonus" | "overtime" | "benefits" | "taxes" | "other";

export interface RecurringSalaryTemplate {
  id: number;
  location_id: number;
  profile_id: number;
  cost_type: CostType;
  default_amount: number;
  frequency: RecurringSalaryFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  description: string | null;
  account_id: number | null;
  is_active: boolean;
  next_generation_date: string | null;
  last_generated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  location_name?: string;
  profile_name?: string | null;
  account_code?: string | null;
  account_name?: string | null;
}

export interface CreateRecurringSalaryTemplateInput {
  location_id: number;
  profile_id: number;
  cost_type: CostType;
  default_amount?: number;
  frequency: RecurringSalaryFrequency;
  day_of_week?: number;
  day_of_month?: number;
  description?: string;
  account_id?: number | null;
}

export interface UpdateRecurringSalaryTemplateInput {
  profile_id?: number;
  cost_type?: CostType;
  default_amount?: number;
  frequency?: RecurringSalaryFrequency;
  day_of_week?: number | null;
  day_of_month?: number | null;
  description?: string;
  account_id?: number | null;
  is_active?: boolean;
}

export interface PendingRecurringSalary {
  template: RecurringSalaryTemplate;
  period_start: string;
  period_end: string;
  already_exists: boolean;
}

// ============================================================================
// GET ALL RECURRING SALARY TEMPLATES
// ============================================================================

export const getRecurringSalaryTemplates = async (
  locationId?: number
): Promise<{ data?: RecurringSalaryTemplate[]; error?: string }> => {
  const supabase = await createClient();

  let query = supabase
    .from("recurring_salary_templates")
    .select(
      `
      *,
      locations!inner(name),
      profiles!inner(first_name, last_name),
      chart_of_accounts(code, name)
    `
    )
    .order("created_at", { ascending: false });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  const templates: RecurringSalaryTemplate[] = data.map((row: any) => ({
    id: row.id,
    location_id: row.location_id,
    profile_id: row.profile_id,
    cost_type: row.cost_type as CostType,
    default_amount: Number(row.default_amount),
    frequency: row.frequency as RecurringSalaryFrequency,
    day_of_week: row.day_of_week,
    day_of_month: row.day_of_month,
    description: row.description,
    account_id: row.account_id,
    is_active: row.is_active,
    next_generation_date: row.next_generation_date,
    last_generated_at: row.last_generated_at,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    location_name: row.locations?.name,
    profile_name: row.profiles
      ? `${row.profiles.first_name} ${row.profiles.last_name}`.trim()
      : null,
    account_code: row.chart_of_accounts?.code,
    account_name: row.chart_of_accounts?.name,
  }));

  return { data: templates };
};

// ============================================================================
// GET SINGLE TEMPLATE
// ============================================================================

export const getRecurringSalaryTemplate = async (
  id: number
): Promise<{ data?: RecurringSalaryTemplate; error?: string }> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recurring_salary_templates")
    .select(
      `
      *,
      locations!inner(name),
      profiles!inner(first_name, last_name),
      chart_of_accounts(code, name)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    return { error: error.message };
  }

  const template: RecurringSalaryTemplate = {
    id: data.id,
    location_id: data.location_id,
    profile_id: data.profile_id,
    cost_type: data.cost_type as CostType,
    default_amount: Number(data.default_amount),
    frequency: data.frequency as RecurringSalaryFrequency,
    day_of_week: data.day_of_week,
    day_of_month: data.day_of_month,
    description: data.description,
    account_id: data.account_id,
    is_active: data.is_active,
    next_generation_date: data.next_generation_date,
    last_generated_at: data.last_generated_at,
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    location_name: (data as any).locations?.name,
    profile_name: (data as any).profiles
      ? `${(data as any).profiles.first_name} ${(data as any).profiles.last_name}`.trim()
      : null,
    account_code: (data as any).chart_of_accounts?.code,
    account_name: (data as any).chart_of_accounts?.name,
  };

  return { data: template };
};

// ============================================================================
// CREATE TEMPLATE
// ============================================================================

export const createRecurringSalaryTemplate = async (
  input: CreateRecurringSalaryTemplateInput
): Promise<{ data?: RecurringSalaryTemplate; error?: string }> => {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", user?.id)
    .single();

  const createdBy = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : user?.email;

  // Calculate next generation date
  const nextDate = calculateNextGenerationDate(
    input.frequency,
    input.day_of_week ?? null,
    input.day_of_month ?? null
  );

  const { data, error } = await supabase
    .from("recurring_salary_templates")
    .insert({
      location_id: input.location_id,
      profile_id: input.profile_id,
      cost_type: input.cost_type,
      default_amount: input.default_amount ?? 0,
      frequency: input.frequency,
      day_of_week: input.day_of_week ?? null,
      day_of_month: input.day_of_month ?? null,
      description: input.description ?? null,
      account_id: input.account_id ?? null,
      is_active: true,
      next_generation_date: nextDate,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "A recurring salary template already exists for this employee, cost type, and frequency combination.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/labor-costs");
  return { data: data as RecurringSalaryTemplate };
};

// ============================================================================
// UPDATE TEMPLATE
// ============================================================================

export const updateRecurringSalaryTemplate = async (
  id: number,
  input: UpdateRecurringSalaryTemplateInput
): Promise<{ success?: boolean; error?: string }> => {
  const supabase = await createClient();

  // Get current template to check frequency change
  const { data: current } = await supabase
    .from("recurring_salary_templates")
    .select("frequency, day_of_week, day_of_month")
    .eq("id", id)
    .single();

  // Recalculate next generation date if frequency or day changed
  let nextDate: string | undefined;
  if (
    input.frequency !== undefined ||
    input.day_of_week !== undefined ||
    input.day_of_month !== undefined
  ) {
    const frequency = input.frequency ?? current?.frequency;
    const dayOfWeek =
      input.day_of_week !== undefined
        ? input.day_of_week
        : current?.day_of_week;
    const dayOfMonth =
      input.day_of_month !== undefined
        ? input.day_of_month
        : current?.day_of_month;
    nextDate = calculateNextGenerationDate(frequency, dayOfWeek, dayOfMonth);
  }

  const updateData: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  if (nextDate) {
    updateData.next_generation_date = nextDate;
  }

  const { error } = await supabase
    .from("recurring_salary_templates")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/labor-costs");
  return { success: true };
};

// ============================================================================
// DELETE TEMPLATE
// ============================================================================

export const deleteRecurringSalaryTemplate = async (
  id: number
): Promise<{ success?: boolean; error?: string }> => {
  const supabase = await createClient();

  const { error } = await supabase
    .from("recurring_salary_templates")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/labor-costs");
  return { success: true };
};

// ============================================================================
// GET PENDING RECURRING SALARIES
// ============================================================================

export const getPendingRecurringSalaries = async (): Promise<{
  data?: PendingRecurringSalary[];
  error?: string;
}> => {
  const supabase = await createClient();
  const today = new Date();

  // Get all active templates
  const { data: templates, error } = await supabase
    .from("recurring_salary_templates")
    .select(
      `
      *,
      locations!inner(name),
      profiles!inner(first_name, last_name),
      chart_of_accounts(code, name)
    `
    )
    .eq("is_active", true)
    .order("next_generation_date", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  const pendingSalaries: PendingRecurringSalary[] = [];

  for (const row of templates) {
    const template: RecurringSalaryTemplate = {
      id: row.id,
      location_id: row.location_id,
      profile_id: row.profile_id,
      cost_type: row.cost_type as CostType,
      default_amount: Number(row.default_amount),
      frequency: row.frequency as RecurringSalaryFrequency,
      day_of_week: row.day_of_week,
      day_of_month: row.day_of_month,
      description: row.description,
      account_id: row.account_id,
      is_active: row.is_active,
      next_generation_date: row.next_generation_date,
      last_generated_at: row.last_generated_at,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      location_name: (row as any).locations?.name,
      profile_name: (row as any).profiles
        ? `${(row as any).profiles.first_name} ${(row as any).profiles.last_name}`.trim()
        : null,
      account_code: (row as any).chart_of_accounts?.code,
      account_name: (row as any).chart_of_accounts?.name,
    };

    // Check if next_generation_date is today or in the past
    if (
      row.next_generation_date &&
      !isAfter(parseISO(row.next_generation_date), today)
    ) {
      const { periodStart, periodEnd } = calculateBillingPeriod(
        template.frequency,
        template.day_of_week,
        template.day_of_month
      );

      // Check if labor cost already exists for this period
      const { data: existingCost } = await supabase
        .from("labor_costs")
        .select("id")
        .eq("location_id", template.location_id)
        .eq("profile_id", template.profile_id)
        .eq("cost_type", template.cost_type)
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .eq("period_end", format(periodEnd, "yyyy-MM-dd"))
        .limit(1)
        .single();

      pendingSalaries.push({
        template,
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        already_exists: !!existingCost,
      });
    }
  }

  return { data: pendingSalaries };
};

// ============================================================================
// GENERATE RECURRING SALARIES
// ============================================================================

export const generateRecurringSalaries = async (
  templateIds: number[]
): Promise<{
  generated: number;
  skipped: number;
  errors: string[];
}> => {
  const supabase = await createClient();
  const results = { generated: 0, skipped: 0, errors: [] as string[] };

  // Get current user profile ID
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let createdById: number | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    createdById = profile?.id || null;
  }

  for (const templateId of templateIds) {
    // Get template
    const { data: template, error: templateError } = await supabase
      .from("recurring_salary_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      results.errors.push(`Template ${templateId}: Not found`);
      continue;
    }

    // Calculate billing period
    const { periodStart, periodEnd } = calculateBillingPeriod(
      template.frequency,
      template.day_of_week,
      template.day_of_month
    );

    const periodStartStr = format(periodStart, "yyyy-MM-dd");
    const periodEndStr = format(periodEnd, "yyyy-MM-dd");

    // Check if labor cost already exists (duplicate detection)
    const { data: existingCost } = await supabase
      .from("labor_costs")
      .select("id")
      .eq("location_id", template.location_id)
      .eq("profile_id", template.profile_id)
      .eq("cost_type", template.cost_type)
      .eq("period_start", periodStartStr)
      .eq("period_end", periodEndStr)
      .limit(1)
      .single();

    if (existingCost) {
      results.skipped++;
      // Still update next generation date even if skipped
      await updateNextGenerationDate(supabase, template);
      continue;
    }

    // Create the labor cost entry
    const { error: laborCostError } = await supabase.from("labor_costs").insert({
      location_id: template.location_id,
      profile_id: template.profile_id,
      cost_type: template.cost_type,
      description: template.description,
      amount: template.default_amount,
      period_start: periodStartStr,
      period_end: periodEndStr,
      account_id: template.account_id,
      created_by: createdById,
      total_paid: 0,
      status: "pending",
    });

    if (laborCostError) {
      results.errors.push(`Template ${templateId}: ${laborCostError.message}`);
      continue;
    }

    // Update template with last generated date and next generation date
    await updateNextGenerationDate(supabase, template);

    results.generated++;
  }

  revalidatePath("/admin/labor-costs");
  return results;
};

// ============================================================================
// GET PENDING COUNT
// ============================================================================

export const getPendingSalariesCount = async (): Promise<{
  count: number;
  error?: string;
}> => {
  const result = await getPendingRecurringSalaries();
  if (result.error) {
    return { count: 0, error: result.error };
  }
  // Only count salaries that don't already exist
  const pendingCount =
    result.data?.filter((s) => !s.already_exists).length ?? 0;
  return { count: pendingCount };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const updateNextGenerationDate = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  template: {
    id: number;
    frequency: string;
    day_of_week: number | null;
    day_of_month: number | null;
  }
) => {
  const nextDate = calculateNextGenerationDate(
    template.frequency as RecurringSalaryFrequency,
    template.day_of_week,
    template.day_of_month,
    true // Skip to next period
  );

  await supabase
    .from("recurring_salary_templates")
    .update({
      last_generated_at: new Date().toISOString(),
      next_generation_date: nextDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", template.id);
};

const calculateNextGenerationDate = (
  frequency: RecurringSalaryFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  skipCurrent: boolean = false
): string => {
  const today = new Date();
  let nextDate: Date;

  switch (frequency) {
    case "weekly": {
      const targetDay = dayOfWeek ?? 1; // Default to Monday
      const currentDay = today.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && skipCurrent)) {
        daysUntil += 7;
      }
      nextDate = addDays(today, daysUntil);
      break;
    }
    case "monthly": {
      const targetDayOfMonth = dayOfMonth ?? 1;
      nextDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        targetDayOfMonth
      );
      if (
        isBefore(nextDate, today) ||
        (nextDate.getTime() === today.getTime() && skipCurrent)
      ) {
        nextDate = addMonths(nextDate, 1);
      }
      break;
    }
    case "bimonthly": {
      const targetDayOfMonth = dayOfMonth ?? 1;
      nextDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        targetDayOfMonth
      );
      if (
        isBefore(nextDate, today) ||
        (nextDate.getTime() === today.getTime() && skipCurrent)
      ) {
        nextDate = addMonths(nextDate, 2);
      }
      const monthDiff = nextDate.getMonth() - today.getMonth();
      if (monthDiff === 1) {
        nextDate = addMonths(nextDate, 1);
      }
      break;
    }
  }

  return format(nextDate, "yyyy-MM-dd");
};

const calculateBillingPeriod = (
  frequency: RecurringSalaryFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null
): { periodStart: Date; periodEnd: Date } => {
  const today = new Date();

  switch (frequency) {
    case "weekly": {
      const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday
      const end = endOfWeek(today, { weekStartsOn: 1 }); // Sunday
      return { periodStart: start, periodEnd: end };
    }
    case "monthly": {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      return { periodStart: start, periodEnd: end };
    }
    case "bimonthly": {
      const currentMonth = today.getMonth();
      const periodStartMonth = currentMonth - (currentMonth % 2);
      const start = new Date(today.getFullYear(), periodStartMonth, 1);
      const end = endOfMonth(addMonths(start, 1));
      return { periodStart: start, periodEnd: end };
    }
  }
};
