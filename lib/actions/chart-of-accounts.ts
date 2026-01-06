"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AccountType =
  | "revenue"
  | "cogs"
  | "labor"
  | "operating_expense"
  | "non_operating";

export interface ChartOfAccount {
  id: number;
  code: string;
  name: string;
  name_bg: string | null;
  account_type: AccountType;
  parent_id: number | null;
  level: number;
  sort_order: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  children?: ChartOfAccount[];
  parent?: {
    code: string;
    name: string;
  } | null;
}

export interface CreateAccountData {
  code: string;
  name: string;
  nameBg?: string;
  accountType: AccountType;
  parentId?: number | null;
  sortOrder?: number;
  description?: string;
}

export interface UpdateAccountData {
  code?: string;
  name?: string;
  nameBg?: string;
  accountType?: AccountType;
  parentId?: number | null;
  sortOrder?: number;
  isActive?: boolean;
  description?: string;
}

/**
 * Get all chart of accounts with hierarchical structure
 */
export const getAllAccounts = async (options?: {
  includeInactive?: boolean;
  accountType?: AccountType;
  flat?: boolean;
}) => {
  const supabase = await createClient();
  const includeInactive = options?.includeInactive ?? false;
  const accountType = options?.accountType;
  const flat = options?.flat ?? false;

  let query = supabase.from("chart_of_accounts").select("*").order("code");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  if (accountType) {
    query = query.eq("account_type", accountType);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  if (flat) {
    return { data: data as ChartOfAccount[] };
  }

  // Build hierarchical structure
  const accountsMap = new Map<number, ChartOfAccount>();
  const rootAccounts: ChartOfAccount[] = [];

  // First pass: create map of all accounts
  data.forEach((account: ChartOfAccount) => {
    accountsMap.set(account.id, { ...account, children: [] });
  });

  // Second pass: build tree structure
  data.forEach((account: ChartOfAccount) => {
    const accountWithChildren = accountsMap.get(account.id)!;
    if (account.parent_id && accountsMap.has(account.parent_id)) {
      const parent = accountsMap.get(account.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(accountWithChildren);
    } else {
      rootAccounts.push(accountWithChildren);
    }
  });

  // Sort children by sort_order and code
  const sortChildren = (accounts: ChartOfAccount[]) => {
    accounts.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.code.localeCompare(b.code);
    });
    accounts.forEach((account) => {
      if (account.children && account.children.length > 0) {
        sortChildren(account.children);
      }
    });
  };

  sortChildren(rootAccounts);

  return { data: rootAccounts };
};

/**
 * Get a single account by ID
 */
export const getAccountById = async (id: number) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select(
      `
      *,
      parent:chart_of_accounts!parent_id(code, name)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data: data as ChartOfAccount };
};

/**
 * Get accounts by level (for dropdowns)
 */
export const getAccountsByLevel = async (
  level: number,
  accountType?: AccountType
) => {
  const supabase = await createClient();

  let query = supabase
    .from("chart_of_accounts")
    .select("id, code, name, name_bg, account_type")
    .eq("level", level)
    .eq("is_active", true)
    .order("code");

  if (accountType) {
    query = query.eq("account_type", accountType);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  return { data };
};

/**
 * Get accounts by codes
 */
export const getAccountsByCodes = async (codes: string[]) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name, name_bg")
    .in("code", codes)
    .eq("is_active", true);

  if (error) {
    return { error: error.message };
  }

  return { data: data || [] };
};

/**
 * Get leaf accounts (level 3) for mapping
 */
export const getLeafAccounts = async (accountType?: AccountType) => {
  const supabase = await createClient();

  let query = supabase
    .from("chart_of_accounts")
    .select("id, code, name, name_bg, account_type, parent_id")
    .eq("level", 3)
    .eq("is_active", true)
    .order("code");

  if (accountType) {
    query = query.eq("account_type", accountType);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  return { data };
};

/**
 * Create a new account
 */
export const createAccount = async (data: CreateAccountData) => {
  const supabase = await createClient();

  // Determine level based on parent
  let level = 1;
  if (data.parentId) {
    const { data: parent, error: parentError } = await supabase
      .from("chart_of_accounts")
      .select("level")
      .eq("id", data.parentId)
      .single();

    if (parentError) {
      return { error: "Parent account not found" };
    }

    level = parent.level + 1;
    if (level > 3) {
      return { error: "Maximum hierarchy depth is 3 levels" };
    }
  }

  const { data: account, error } = await supabase
    .from("chart_of_accounts")
    .insert({
      code: data.code,
      name: data.name,
      name_bg: data.nameBg || null,
      account_type: data.accountType,
      parent_id: data.parentId || null,
      level,
      sort_order: data.sortOrder || 0,
      description: data.description || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Account code already exists" };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/chart-of-accounts");
  return { success: true, data: account };
};

/**
 * Update an existing account
 */
export const updateAccount = async (id: number, data: UpdateAccountData) => {
  const supabase = await createClient();

  // If parent is being changed, recalculate level
  let level: number | undefined;
  if (data.parentId !== undefined) {
    if (data.parentId === null) {
      level = 1;
    } else {
      const { data: parent, error: parentError } = await supabase
        .from("chart_of_accounts")
        .select("level")
        .eq("id", data.parentId)
        .single();

      if (parentError || !parent) {
        return { error: "Parent account not found" };
      }

      if (parent.level === undefined || parent.level === null) {
        return { error: "Parent account level is missing" };
      }

      const calculatedLevel = parent.level + 1;
      if (calculatedLevel > 3) {
        return { error: "Maximum hierarchy depth is 3 levels" };
      }
      level = calculatedLevel;
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.code !== undefined) updateData.code = data.code;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.nameBg !== undefined) updateData.name_bg = data.nameBg;
  if (data.accountType !== undefined)
    updateData.account_type = data.accountType;
  if (data.parentId !== undefined) updateData.parent_id = data.parentId;
  if (level !== undefined) updateData.level = level;
  if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;
  if (data.isActive !== undefined) updateData.is_active = data.isActive;
  if (data.description !== undefined) updateData.description = data.description;

  const { error } = await supabase
    .from("chart_of_accounts")
    .update(updateData)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Account code already exists" };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/chart-of-accounts");
  return { success: true };
};

/**
 * Toggle account active status
 */
export const toggleAccountStatus = async (id: number, isActive: boolean) => {
  const supabase = await createClient();

  const { error } = await supabase
    .from("chart_of_accounts")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/chart-of-accounts");
  return { success: true };
};

/**
 * Delete an account (only if no children and not used in mappings)
 */
export const deleteAccount = async (id: number) => {
  const supabase = await createClient();

  // Check for children
  const { count: childCount } = await supabase
    .from("chart_of_accounts")
    .select("*", { count: "exact", head: true })
    .eq("parent_id", id);

  if (childCount && childCount > 0) {
    return { error: "Cannot delete account with child accounts" };
  }

  // Check for category mappings
  const { count: categoryMappingCount } = await supabase
    .from("barsy_category_account_mapping")
    .select("*", { count: "exact", head: true })
    .or(`revenue_account_id.eq.${id},cogs_account_id.eq.${id}`);

  if (categoryMappingCount && categoryMappingCount > 0) {
    return { error: "Cannot delete account that is linked to categories" };
  }

  // Check for article mappings
  const { count: articleMappingCount } = await supabase
    .from("barsy_article_account_mapping")
    .select("*", { count: "exact", head: true })
    .or(`revenue_account_id.eq.${id},cogs_account_id.eq.${id}`);

  if (articleMappingCount && articleMappingCount > 0) {
    return { error: "Cannot delete account that is linked to articles" };
  }

  // Check for vendor default account
  const { count: vendorCount } = await supabase
    .from("vendors")
    .select("*", { count: "exact", head: true })
    .eq("default_account_id", id);

  if (vendorCount && vendorCount > 0) {
    return {
      error: "Cannot delete account that is set as default for vendors",
    };
  }

  // Check for bill item mappings
  const { count: billItemCount } = await supabase
    .from("bill_items")
    .select("*", { count: "exact", head: true })
    .eq("account_id", id);

  if (billItemCount && billItemCount > 0) {
    return { error: "Cannot delete account that is used in bill items" };
  }

  const { error } = await supabase
    .from("chart_of_accounts")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/chart-of-accounts");
  return { success: true };
};

/**
 * Search accounts by name or code
 */
export const searchAccounts = async (
  search: string,
  options?: {
    accountType?: AccountType;
    level?: number;
    limit?: number;
  }
) => {
  const supabase = await createClient();
  const limit = options?.limit || 20;

  let query = supabase
    .from("chart_of_accounts")
    .select("id, code, name, name_bg, account_type, level, parent_id")
    .eq("is_active", true)
    .or(
      `name.ilike.%${search}%,name_bg.ilike.%${search}%,code.ilike.%${search}%`
    )
    .order("code")
    .limit(limit);

  if (options?.accountType) {
    query = query.eq("account_type", options.accountType);
  }

  if (options?.level) {
    query = query.eq("level", options.level);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  return { data };
};

/**
 * Get account type label
 */
export const getAccountTypeLabel = async (
  type: AccountType,
  locale: "en" | "bg" = "en"
) => {
  const labels = {
    revenue: { en: "Revenue", bg: "Приходи" },
    cogs: { en: "Cost of Goods Sold", bg: "Себестойност" },
    labor: { en: "Labor Costs", bg: "Разходи за труд" },
    operating_expense: { en: "Operating Expense", bg: "Оперативни разходи" },
    non_operating: { en: "Non-Operating", bg: "Неоперативни" },
  };
  return labels[type][locale];
};
