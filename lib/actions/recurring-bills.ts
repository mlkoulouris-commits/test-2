"use server";

import { createClient } from "@/lib/supabase/server";
import {
  CreateRecurringTemplateInput,
  PendingRecurringBill,
  RecurringBillTemplate,
  RecurringFrequency,
  UpdateRecurringTemplateInput,
} from "@/lib/types/bill";
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

// Get all recurring bill templates
export const getRecurringTemplates = async (
  locationId?: string
): Promise<{ data?: RecurringBillTemplate[]; error?: string }> => {
  const supabase = await createClient();

  let query = supabase
    .from("recurring_bill_templates")
    .select(
      `
      *,
      locations!inner(name),
      vendors!inner(name),
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

  const templates: RecurringBillTemplate[] = data.map((row) => ({
    id: row.id,
    location_id: row.location_id,
    vendor_id: row.vendor_id,
    frequency: row.frequency as RecurringFrequency,
    day_of_week: row.day_of_week,
    day_of_month: row.day_of_month,
    default_amount: Number(row.default_amount),
    description: row.description,
    due_date_offset: row.due_date_offset,
    account_id: row.account_id,
    is_active: row.is_active,
    last_generated_at: row.last_generated_at,
    next_generation_date: row.next_generation_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    location_name: row.locations?.name,
    vendor_name: row.vendors?.name,
    account_code: row.chart_of_accounts?.code,
    account_name: row.chart_of_accounts?.name,
  }));

  return { data: templates };
};

// Get a single template by ID
export const getRecurringTemplate = async (
  id: number
): Promise<{ data?: RecurringBillTemplate; error?: string }> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recurring_bill_templates")
    .select(
      `
      *,
      locations!inner(name),
      vendors!inner(name),
      chart_of_accounts(code, name)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    return { error: error.message };
  }

  const template: RecurringBillTemplate = {
    id: data.id,
    location_id: data.location_id,
    vendor_id: data.vendor_id,
    frequency: data.frequency as RecurringFrequency,
    day_of_week: data.day_of_week,
    day_of_month: data.day_of_month,
    default_amount: Number(data.default_amount),
    description: data.description,
    due_date_offset: data.due_date_offset,
    account_id: data.account_id,
    is_active: data.is_active,
    last_generated_at: data.last_generated_at,
    next_generation_date: data.next_generation_date,
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by,
    location_name: data.barsy_locations?.name,
    vendor_name: data.vendors?.name,
    account_code: data.chart_of_accounts?.code,
    account_name: data.chart_of_accounts?.name,
  };

  return { data: template };
};

// Create a new recurring bill template
export const createRecurringTemplate = async (
  input: CreateRecurringTemplateInput
): Promise<{ data?: RecurringBillTemplate; error?: string }> => {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user?.id)
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
    .from("recurring_bill_templates")
    .insert({
      location_id: input.location_id,
      vendor_id: input.vendor_id,
      frequency: input.frequency,
      day_of_week: input.day_of_week ?? null,
      day_of_month: input.day_of_month ?? null,
      default_amount: input.default_amount ?? 0,
      description: input.description ?? null,
      due_date_offset: input.due_date_offset ?? 0,
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
          "A recurring bill template already exists for this location, vendor, and frequency combination.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/bills");
  return { data: data as RecurringBillTemplate };
};

// Update a recurring bill template
export const updateRecurringTemplate = async (
  id: number,
  input: UpdateRecurringTemplateInput
): Promise<{ success?: boolean; error?: string }> => {
  const supabase = await createClient();

  // Get current template to check frequency change
  const { data: current } = await supabase
    .from("recurring_bill_templates")
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
    .from("recurring_bill_templates")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/bills");
  return { success: true };
};

// Delete a recurring bill template
export const deleteRecurringTemplate = async (
  id: number
): Promise<{ success?: boolean; error?: string }> => {
  const supabase = await createClient();

  const { error } = await supabase
    .from("recurring_bill_templates")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/bills");
  return { success: true };
};

// Get pending recurring bills (templates that are due for generation)
export const getPendingRecurringBills = async (): Promise<{
  data?: PendingRecurringBill[];
  error?: string;
}> => {
  const supabase = await createClient();
  const today = new Date();

  // Get all active templates
  const { data: templates, error } = await supabase
    .from("recurring_bill_templates")
    .select(
      `
      *,
      locations!inner(name),
      vendors!inner(name),
      chart_of_accounts(code, name)
    `
    )
    .eq("is_active", true)
    .order("next_generation_date", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  const pendingBills: PendingRecurringBill[] = [];

  for (const row of templates) {
    const template: RecurringBillTemplate = {
      id: row.id,
      location_id: row.location_id,
      vendor_id: row.vendor_id,
      frequency: row.frequency as RecurringFrequency,
      day_of_week: row.day_of_week,
      day_of_month: row.day_of_month,
      default_amount: Number(row.default_amount),
      description: row.description,
      due_date_offset: row.due_date_offset,
      account_id: row.account_id,
      is_active: row.is_active,
      last_generated_at: row.last_generated_at,
      next_generation_date: row.next_generation_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      location_name: row.locations?.name,
      vendor_name: row.vendors?.name,
      account_code: row.chart_of_accounts?.code,
      account_name: row.chart_of_accounts?.name,
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

      const dueDate = addDays(periodEnd, template.due_date_offset);

      // Check if bill already exists
      const { data: existingBill } = await supabase
        .from("bills")
        .select("id")
        .eq("location_id", template.location_id)
        .eq("vendor_id", template.vendor_id)
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .eq("period_end", format(periodEnd, "yyyy-MM-dd"))
        .eq("source", "manual")
        .limit(1)
        .single();

      pendingBills.push({
        template,
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        due_date: format(dueDate, "yyyy-MM-dd"),
        already_exists: !!existingBill,
      });
    }
  }

  return { data: pendingBills };
};

// Generate bills from pending recurring templates
export const generateRecurringBills = async (
  templateIds: number[]
): Promise<{
  generated: number;
  skipped: number;
  errors: string[];
}> => {
  const supabase = await createClient();
  const results = { generated: 0, skipped: 0, errors: [] as string[] };

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user?.id)
    .single();

  const createdBy = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : user?.email;

  for (const templateId of templateIds) {
    // Get template
    const { data: template, error: templateError } = await supabase
      .from("recurring_bill_templates")
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

    // Check if bill already exists (duplicate detection)
    const { data: existingBill } = await supabase
      .from("bills")
      .select("id")
      .eq("location_id", template.location_id)
      .eq("vendor_id", template.vendor_id)
      .eq("period_start", periodStartStr)
      .eq("period_end", periodEndStr)
      .eq("source", "manual")
      .limit(1)
      .single();

    if (existingBill) {
      results.skipped++;
      // Still update next generation date even if skipped
      await updateNextGenerationDate(supabase, template);
      continue;
    }

    // Calculate due date
    const dueDate = addDays(periodEnd, template.due_date_offset);

    // Generate document number
    const docNum = `REC-${template.id}-${format(periodStart, "yyyyMM")}`;

    // Create the bill
    const { error: billError } = await supabase.from("bills").insert({
      source: "manual",
      location_id: template.location_id,
      vendor_id: template.vendor_id,
      doc_num: docNum,
      doc_date: periodEndStr,
      due_date: format(dueDate, "yyyy-MM-dd"),
      total_amount: template.default_amount,
      total_paid: 0,
      status: "approved",
      description: template.description,
      period_start: periodStartStr,
      period_end: periodEndStr,
      account_id: template.account_id,
      created_by: createdBy,
      approved_by: createdBy,
      approved_at: new Date().toISOString(),
    });

    if (billError) {
      results.errors.push(`Template ${templateId}: ${billError.message}`);
      continue;
    }

    // Update template with last generated date and next generation date
    await updateNextGenerationDate(supabase, template);

    results.generated++;
  }

  revalidatePath("/admin/bills");
  return results;
};

// Helper: Update next generation date after generating a bill
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
    template.frequency as RecurringFrequency,
    template.day_of_week,
    template.day_of_month,
    true // Skip to next period
  );

  await supabase
    .from("recurring_bill_templates")
    .update({
      last_generated_at: new Date().toISOString(),
      next_generation_date: nextDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", template.id);
};

// Helper: Calculate the next generation date based on frequency
const calculateNextGenerationDate = (
  frequency: RecurringFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  skipCurrent: boolean = false
): string => {
  const today = new Date();
  let nextDate: Date;

  switch (frequency) {
    case "weekly": {
      // Next occurrence of the specified day of week
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
      // Next occurrence of the specified day of month
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
      // Every 2 months on the specified day
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
      // Ensure we're on an even-month cycle (Jan, Mar, May...) or odd based on current
      const monthDiff = nextDate.getMonth() - today.getMonth();
      if (monthDiff === 1) {
        nextDate = addMonths(nextDate, 1);
      }
      break;
    }
  }

  return format(nextDate, "yyyy-MM-dd");
};

// Helper: Calculate the billing period based on frequency
const calculateBillingPeriod = (
  frequency: RecurringFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null
): { periodStart: Date; periodEnd: Date } => {
  const today = new Date();

  switch (frequency) {
    case "weekly": {
      // Current week (Monday to Sunday)
      const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday
      const end = endOfWeek(today, { weekStartsOn: 1 }); // Sunday
      return { periodStart: start, periodEnd: end };
    }
    case "monthly": {
      // Current month
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      return { periodStart: start, periodEnd: end };
    }
    case "bimonthly": {
      // Current two-month period
      // Determine which bimonthly period we're in (Jan-Feb, Mar-Apr, etc.)
      const currentMonth = today.getMonth();
      const periodStartMonth = currentMonth - (currentMonth % 2);
      const start = new Date(today.getFullYear(), periodStartMonth, 1);
      const end = endOfMonth(addMonths(start, 1));
      return { periodStart: start, periodEnd: end };
    }
  }
};

// Get count of pending bills for badge display
export const getPendingBillsCount = async (): Promise<{
  count: number;
  error?: string;
}> => {
  const result = await getPendingRecurringBills();
  if (result.error) {
    return { count: 0, error: result.error };
  }
  // Only count bills that don't already exist
  const pendingCount =
    result.data?.filter((b) => !b.already_exists).length ?? 0;
  return { count: pendingCount };
};
