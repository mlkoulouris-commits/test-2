"use server";

import { createClient } from "@/lib/supabase/server";

type CoaAccountType = "revenue" | "cogs" | "operating_expense";

export type EffectiveMappingSource =
  | "explicit"
  | "override"
  | "inherited"
  | "heuristic"
  | "default"
  | "excluded_tips";

export interface EffectiveAccountRef {
  id: number;
  code: string;
  name: string;
}

export interface EffectiveBarsyCategoryRow {
  locationId: string;
  locationName: string;
  categoryId: number;
  categoryName: string;
  explicitRevenueAccount: EffectiveAccountRef | null;
  explicitCogsAccount: EffectiveAccountRef | null;
  effectiveRevenueAccount: EffectiveAccountRef | null;
  effectiveRevenueSource: EffectiveMappingSource;
  effectiveCogsAccount: EffectiveAccountRef | null;
  effectiveCogsSource: EffectiveMappingSource;
}

export interface EffectiveBarsyArticleRow {
  id: string;
  locationId: string;
  locationName: string;
  articleId: number;
  articleName: string;
  categoryId: number | null;
  categoryName: string | null;
  explicitRevenueAccount: EffectiveAccountRef | null;
  inheritedRevenueAccount: EffectiveAccountRef | null;
  effectiveRevenueAccount: EffectiveAccountRef | null;
  effectiveRevenueSource: EffectiveMappingSource;
  explicitCogsAccount: EffectiveAccountRef | null;
  inheritedCogsAccount: EffectiveAccountRef | null;
  effectiveCogsAccount: EffectiveAccountRef | null;
  effectiveCogsSource: EffectiveMappingSource;
  isTips: boolean;
}

export interface EffectiveBillItemRow {
  id: number;
  billId: number;
  billDocNum: string | null;
  billDocDate: string | null;
  vendorId: number | null;
  vendorName: string | null;
  locationId: number | null;
  locationName: string | null;
  itemName: string | null;
  totalPrice: number;
  itemAccount: EffectiveAccountRef | null;
  billAccount: EffectiveAccountRef | null;
  vendorDefaultAccount: EffectiveAccountRef | null;
  effectiveExpenseAccount: EffectiveAccountRef | null;
  effectiveExpenseSource: Exclude<EffectiveMappingSource, "excluded_tips">;
}

interface PaginationArgs {
  page?: number;
  pageSize?: number;
}

export interface EffectiveBarsyCategoryQuery extends PaginationArgs {
  locationId?: string;
  search?: string;
  showOnlyUnmapped?: boolean;
}

export interface EffectiveBarsyArticleQuery extends PaginationArgs {
  locationId?: string;
  categoryId?: number;
  search?: string;
  showOnlyFallbacks?: boolean;
}

export interface EffectiveBillItemQuery extends PaginationArgs {
  locationId?: number;
  vendorId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  showOnlyFallbacks?: boolean;
}

type CategoryClassification =
  | "alcoholic"
  | "non_alcoholic"
  | "food"
  | "tips"
  | "other";

const normalizeText = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const toLower = (value: unknown): string => normalizeText(value).toLowerCase();

const isTipsArticleName = (articleName: string): boolean => {
  const name = articleName.toLowerCase();
  return (
    name.includes("типс") || name.includes("бакшиш") || name.includes("tip")
  );
};

const classifyCategory = (categoryName: string, categoryPath: string): CategoryClassification => {
  const catName = categoryName.toLowerCase();
  const catPath = categoryPath.toLowerCase();

  if (
    catName.includes("бакшиш") ||
    catName.includes("типс") ||
    catName.includes("tip")
  ) {
    return "tips";
  }

  if (
    catName.includes("безалкохолн") ||
    catName.includes("non-alcoholic") ||
    catName.includes("топли напитки") ||
    catName.includes("чай") ||
    catName.includes("tea") ||
    catName.includes("кафе") ||
    catName.includes("фреш") ||
    catName.includes("лимонад") ||
    catName.includes("шейк") ||
    catName.includes("dairy") ||
    catName.includes("соево") ||
    catName.includes("без кофеин") ||
    catName.includes("rooibos") ||
    catName.includes("ройбос")
  ) {
    return "non_alcoholic";
  }

  if (catName.includes("храна") || catName.includes("ядки") || catName.includes("добро утро")) {
    return "food";
  }

  if (
    catName.includes("бира") ||
    catName.includes("вино") ||
    catName.includes("вермут") ||
    catName.includes("водка") ||
    catName.includes("джин") ||
    catName.includes("коняк") ||
    catName.includes("ликьор") ||
    catName.includes("ром") ||
    catName.includes("текила") ||
    catName.includes("уиски") ||
    catName.includes("whisky") ||
    catName.includes("bourbon") ||
    catName.includes("scotch") ||
    catName.includes("irish") ||
    catName.includes("malt") ||
    catName.includes("бърбън") ||
    catName.includes("шотландски") ||
    catName.includes("ирландски") ||
    catName.includes("шотове") ||
    catName.includes("зелцер") ||
    catName.includes("коктейл") ||
    catName.includes("cocktail") ||
    catName.includes("aperitiv") ||
    catName.includes("аперитив") ||
    catName.includes("червени") ||
    catName.includes("бяло") ||
    catName.includes("розе") ||
    (catPath.includes("cocktails") && !catName.includes("non-alcoholic"))
  ) {
    return "alcoholic";
  }

  return "other";
};

const getDefaultLeafAccount = async (accountType: CoaAccountType): Promise<EffectiveAccountRef | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name")
    .eq("is_active", true)
    .eq("level", 3)
    .eq("account_type", accountType)
    .order("code")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { id: data.id, code: data.code, name: data.name };
};

const getAccountsByCodes = async (codes: string[]): Promise<Map<string, EffectiveAccountRef>> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name")
    .eq("is_active", true)
    .in("code", codes);

  if (error || !data) return new Map();

  const map = new Map<string, EffectiveAccountRef>();
  data.forEach((row) => {
    map.set(row.code, { id: row.id, code: row.code, name: row.name });
  });
  return map;
};

const pickHeuristicAccount = (
  classification: CategoryClassification,
  accountByCode: ReadonlyMap<string, EffectiveAccountRef>,
  kind: "revenue" | "cogs"
): EffectiveAccountRef | null => {
  if (classification === "tips") return null;

  if (kind === "revenue") {
    if (classification === "food") return accountByCode.get("1101") ?? null;
    if (classification === "alcoholic") return accountByCode.get("1103") ?? null;
    if (classification === "non_alcoholic") return accountByCode.get("1104") ?? null;
    return null;
  }

  if (classification === "food") return accountByCode.get("2101") ?? null;
  if (classification === "alcoholic") return accountByCode.get("2102") ?? null;
  if (classification === "non_alcoholic") return accountByCode.get("2106") ?? null;
  return null;
};

const isAccountShape = (value: unknown): value is { id: number; code: string; name: string } => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    typeof v.code === "string" &&
    typeof v.name === "string"
  );
};

/**
 * Supabase nested selects sometimes return a single object *or* an array of objects
 * depending on relationship metadata. We normalize both shapes here.
 */
const toAccountRef = (value: unknown): EffectiveAccountRef | null => {
  if (!value) return null;

  if (Array.isArray(value)) {
    const first = value[0];
    return isAccountShape(first) ? { id: first.id, code: first.code, name: first.name } : null;
  }

  return isAccountShape(value)
    ? { id: value.id, code: value.code, name: value.name }
    : null;
};

/**
 * Extract location name from Supabase join which may be object or array.
 */
const toLocationName = (value: unknown): string => {
  if (!value) return "";
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first?.name === "string" ? first.name : "";
  }
  return typeof (value as Record<string, unknown>).name === "string"
    ? (value as Record<string, unknown>).name as string
    : "";
};

/**
 * Normalize Supabase join that may be an object or array.
 */
const normalizeJoin = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

export const getEffectiveBarsyCategoryMappings = async (query: EffectiveBarsyCategoryQuery) => {
  const supabase = await createClient();

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const search = normalizeText(query.search);

  let countQuery = supabase
    .from("barsy_categories")
    .select("*", { count: "exact", head: true });

  let dataQuery = supabase
    .from("barsy_categories")
    .select(
      `
      location_id,
      barsy_category_id,
      category_name,
      barsy_cat_id,
      cat_name,
      cat_path,
      raw_data,
      barsy_locations!inner(name)
    `
    )
    .order("category_name", { ascending: true });

  if (query.locationId) {
    countQuery = countQuery.eq("location_id", query.locationId);
    dataQuery = dataQuery.eq("location_id", query.locationId);
  }

  if (search) {
    // Search both possible name columns for robustness.
    countQuery = countQuery.or(`category_name.ilike.%${search}%,cat_name.ilike.%${search}%`);
    dataQuery = dataQuery.or(`category_name.ilike.%${search}%,cat_name.ilike.%${search}%`);
  }

  const { count } = await countQuery;
  const { data: categories, error } = await dataQuery.range(from, to);

  if (error) return { error: error.message };
  if (!categories || categories.length === 0) return { data: [], total: count || 0 };

  const categoryIds = categories
    .map((c) => (typeof c.barsy_category_id === "number" ? c.barsy_category_id : c.barsy_cat_id))
    .filter((id): id is number => typeof id === "number");

  const locationIds = [...new Set(categories.map((c) => c.location_id))];

  const { data: mappings } = await supabase
    .from("barsy_category_account_mapping")
    .select(
      `
      barsy_location_id,
      barsy_category_id,
      revenue_account_id,
      cogs_account_id,
      revenue_account:chart_of_accounts!barsy_category_account_mapping_revenue_account_id_fkey(id, code, name),
      cogs_account:chart_of_accounts!barsy_category_account_mapping_cogs_account_id_fkey(id, code, name)
    `
    )
    .in("barsy_location_id", locationIds)
    .in("barsy_category_id", categoryIds);

  const mappingMap = new Map<string, { revenue: EffectiveAccountRef | null; cogs: EffectiveAccountRef | null }>();
  (mappings ?? []).forEach((m) => {
    mappingMap.set(`${m.barsy_location_id}-${m.barsy_category_id}`, {
      revenue: toAccountRef(m.revenue_account),
      cogs: toAccountRef(m.cogs_account),
    });
  });

  const accountByCode = await getAccountsByCodes(["1101", "1103", "1104", "2101", "2102", "2106"]);
  const defaultRevenue = await getDefaultLeafAccount("revenue");
  const defaultCogs = await getDefaultLeafAccount("cogs");

  const rows: EffectiveBarsyCategoryRow[] = categories.map((cat) => {
    const categoryId = typeof cat.barsy_category_id === "number" ? cat.barsy_category_id : cat.barsy_cat_id;
    const categoryName = normalizeText(cat.category_name) || normalizeText(cat.cat_name) || "—";
    const catPath =
      normalizeText(cat.cat_path) ||
      normalizeText((cat.raw_data as Record<string, unknown> | null)?.["cat_path"]) ||
      "";

    const explicit = categoryId ? mappingMap.get(`${cat.location_id}-${categoryId}`) : undefined;
    const explicitRevenue = explicit?.revenue ?? null;
    const explicitCogs = explicit?.cogs ?? null;

    const classification = classifyCategory(categoryName, catPath);

    let effectiveRevenueAccount: EffectiveAccountRef | null = explicitRevenue;
    let effectiveRevenueSource: EffectiveMappingSource = explicitRevenue ? "explicit" : "default";

    if (!effectiveRevenueAccount) {
      const heuristic = pickHeuristicAccount(classification, accountByCode, "revenue");
      if (heuristic) {
        effectiveRevenueAccount = heuristic;
        effectiveRevenueSource = "heuristic";
      } else if (classification === "tips") {
        effectiveRevenueAccount = null;
        effectiveRevenueSource = "excluded_tips";
      } else if (defaultRevenue) {
        effectiveRevenueAccount = defaultRevenue;
        effectiveRevenueSource = "default";
      } else {
        effectiveRevenueAccount = null;
        effectiveRevenueSource = "default";
      }
    }

    let effectiveCogsAccount: EffectiveAccountRef | null = explicitCogs;
    let effectiveCogsSource: EffectiveMappingSource = explicitCogs ? "explicit" : "default";

    if (!effectiveCogsAccount) {
      const heuristic = pickHeuristicAccount(classification, accountByCode, "cogs");
      if (heuristic) {
        effectiveCogsAccount = heuristic;
        effectiveCogsSource = "heuristic";
      } else if (classification === "tips") {
        effectiveCogsAccount = null;
        effectiveCogsSource = "excluded_tips";
      } else if (defaultCogs) {
        effectiveCogsAccount = defaultCogs;
        effectiveCogsSource = "default";
      } else {
        effectiveCogsAccount = null;
        effectiveCogsSource = "default";
      }
    }

    return {
      locationId: cat.location_id,
      locationName: toLocationName(cat.barsy_locations) || "Unknown",
      categoryId: categoryId ?? 0,
      categoryName,
      explicitRevenueAccount: explicitRevenue,
      explicitCogsAccount: explicitCogs,
      effectiveRevenueAccount,
      effectiveRevenueSource,
      effectiveCogsAccount,
      effectiveCogsSource,
    };
  });

  const filteredRows = query.showOnlyUnmapped
    ? rows.filter((r) => !r.explicitRevenueAccount && !r.explicitCogsAccount)
    : rows;

  return { data: filteredRows, total: count || 0 };
};

export const getEffectiveBarsyArticleMappings = async (query: EffectiveBarsyArticleQuery) => {
  const supabase = await createClient();

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = normalizeText(query.search);

  let countQuery = supabase
    .from("barsy_articles")
    .select("*", { count: "exact", head: true });

  let dataQuery = supabase
    .from("barsy_articles")
    .select(
      `
      id,
      location_id,
      barsy_article_id,
      article_name,
      category_id,
      barsy_locations!inner(name)
    `
    )
    .order("article_name", { ascending: true });

  if (query.locationId) {
    countQuery = countQuery.eq("location_id", query.locationId);
    dataQuery = dataQuery.eq("location_id", query.locationId);
  }

  if (query.categoryId) {
    countQuery = countQuery.eq("category_id", query.categoryId);
    dataQuery = dataQuery.eq("category_id", query.categoryId);
  }

  if (search) {
    countQuery = countQuery.ilike("article_name", `%${search}%`);
    dataQuery = dataQuery.ilike("article_name", `%${search}%`);
  }

  const { count } = await countQuery;
  const { data: articles, error } = await dataQuery.range(from, to);

  if (error) return { error: error.message };
  if (!articles || articles.length === 0) return { data: [], total: count || 0 };

  const locationIds = [...new Set(articles.map((a) => a.location_id))];
  const articleIds = articles.map((a) => a.barsy_article_id);
  const categoryIds = [...new Set(articles.map((a) => a.category_id).filter((v): v is number => typeof v === "number"))];

  const { data: articleMappings } = await supabase
    .from("barsy_article_account_mapping")
    .select(
      `
      barsy_location_id,
      barsy_article_id,
      revenue_account:chart_of_accounts!barsy_article_account_mapping_revenue_account_id_fkey(id, code, name),
      cogs_account:chart_of_accounts!barsy_article_account_mapping_cogs_account_id_fkey(id, code, name)
    `
    )
    .in("barsy_location_id", locationIds)
    .in("barsy_article_id", articleIds);

  const articleMappingMap = new Map<string, { revenue: EffectiveAccountRef | null; cogs: EffectiveAccountRef | null }>();
  (articleMappings ?? []).forEach((m) => {
    articleMappingMap.set(`${m.barsy_location_id}-${m.barsy_article_id}`, {
      revenue: toAccountRef(m.revenue_account),
      cogs: toAccountRef(m.cogs_account),
    });
  });

  const { data: categoryMappings } = await supabase
    .from("barsy_category_account_mapping")
    .select(
      `
      barsy_location_id,
      barsy_category_id,
      revenue_account:chart_of_accounts!barsy_category_account_mapping_revenue_account_id_fkey(id, code, name),
      cogs_account:chart_of_accounts!barsy_category_account_mapping_cogs_account_id_fkey(id, code, name)
    `
    )
    .in("barsy_location_id", locationIds)
    .in("barsy_category_id", categoryIds);

  const categoryMappingMap = new Map<string, { revenue: EffectiveAccountRef | null; cogs: EffectiveAccountRef | null }>();
  (categoryMappings ?? []).forEach((m) => {
    categoryMappingMap.set(`${m.barsy_location_id}-${m.barsy_category_id}`, {
      revenue: toAccountRef(m.revenue_account),
      cogs: toAccountRef(m.cogs_account),
    });
  });

  const { data: categories } = await supabase
    .from("barsy_categories")
    .select("location_id, barsy_category_id, category_name, cat_name, cat_path, raw_data")
    .in("location_id", locationIds)
    .in("barsy_category_id", categoryIds);

  const categoryInfoMap = new Map<string, { name: string; path: string }>();
  (categories ?? []).forEach((c) => {
    const name = normalizeText(c.category_name) || normalizeText(c.cat_name) || "—";
    const path =
      normalizeText(c.cat_path) ||
      normalizeText((c.raw_data as Record<string, unknown> | null)?.["cat_path"]) ||
      "";
    categoryInfoMap.set(`${c.location_id}-${c.barsy_category_id}`, { name, path });
  });

  const accountByCode = await getAccountsByCodes(["1101", "1103", "1104", "2101", "2102", "2106"]);
  const defaultRevenue = await getDefaultLeafAccount("revenue");
  const defaultCogs = await getDefaultLeafAccount("cogs");

  const rows: EffectiveBarsyArticleRow[] = articles.map((art) => {
    const articleKey = `${art.location_id}-${art.barsy_article_id}`;
    const categoryKey = typeof art.category_id === "number" ? `${art.location_id}-${art.category_id}` : null;

    const explicit = articleMappingMap.get(articleKey);
    const explicitRevenue = explicit?.revenue ?? null;
    const explicitCogs = explicit?.cogs ?? null;

    const inherited = categoryKey ? categoryMappingMap.get(categoryKey) : undefined;
    const inheritedRevenue = inherited?.revenue ?? null;
    const inheritedCogs = inherited?.cogs ?? null;

    const categoryInfo = categoryKey ? categoryInfoMap.get(categoryKey) : undefined;
    const classification = categoryInfo ? classifyCategory(categoryInfo.name, categoryInfo.path) : "other";

    const articleName = normalizeText(art.article_name) || "—";
    const isTips = isTipsArticleName(articleName) || classification === "tips";

    let effectiveRevenueAccount: EffectiveAccountRef | null = null;
    let effectiveRevenueSource: EffectiveMappingSource = "default";

    if (isTips) {
      effectiveRevenueAccount = null;
      effectiveRevenueSource = "excluded_tips";
    } else if (explicitRevenue) {
      effectiveRevenueAccount = explicitRevenue;
      effectiveRevenueSource = "override";
    } else if (inheritedRevenue) {
      effectiveRevenueAccount = inheritedRevenue;
      effectiveRevenueSource = "inherited";
    } else {
      const heuristic = pickHeuristicAccount(classification, accountByCode, "revenue");
      if (heuristic) {
        effectiveRevenueAccount = heuristic;
        effectiveRevenueSource = "heuristic";
      } else {
        effectiveRevenueAccount = defaultRevenue;
        effectiveRevenueSource = "default";
      }
    }

    let effectiveCogsAccount: EffectiveAccountRef | null = null;
    let effectiveCogsSource: EffectiveMappingSource = "default";

    if (isTips) {
      effectiveCogsAccount = null;
      effectiveCogsSource = "excluded_tips";
    } else if (explicitCogs) {
      effectiveCogsAccount = explicitCogs;
      effectiveCogsSource = "override";
    } else if (inheritedCogs) {
      effectiveCogsAccount = inheritedCogs;
      effectiveCogsSource = "inherited";
    } else {
      const heuristic = pickHeuristicAccount(classification, accountByCode, "cogs");
      if (heuristic) {
        effectiveCogsAccount = heuristic;
        effectiveCogsSource = "heuristic";
      } else {
        effectiveCogsAccount = defaultCogs;
        effectiveCogsSource = "default";
      }
    }

    return {
      id: art.id,
      locationId: art.location_id,
      locationName: toLocationName(art.barsy_locations) || "Unknown",
      articleId: art.barsy_article_id,
      articleName,
      categoryId: typeof art.category_id === "number" ? art.category_id : null,
      categoryName: categoryInfo?.name ?? null,
      explicitRevenueAccount: explicitRevenue,
      inheritedRevenueAccount: inheritedRevenue,
      effectiveRevenueAccount,
      effectiveRevenueSource,
      explicitCogsAccount: explicitCogs,
      inheritedCogsAccount: inheritedCogs,
      effectiveCogsAccount,
      effectiveCogsSource,
      isTips,
    };
  });

  const filteredRows = query.showOnlyFallbacks
    ? rows.filter((r) => !r.explicitRevenueAccount && !r.inheritedRevenueAccount)
    : rows;

  return { data: filteredRows, total: count || 0 };
};

export const getEffectiveBillItemMappings = async (query: EffectiveBillItemQuery) => {
  const supabase = await createClient();

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const search = normalizeText(query.search);

  // Note: Filters reference `bills.*` and `bills.vendors.*`, so the count query must include the same inner join.
  let countQuery = supabase
    .from("bill_items")
    .select(
      `
      id,
      bills!inner(
        id,
        doc_date,
        vendor_id,
        location_id,
        vendors(name)
      )
    `,
      { count: "exact", head: true }
    );

  let dataQuery = supabase
    .from("bill_items")
    .select(
      `
      id,
      bill_id,
      article_name,
      total_price,
      account_id,
      bills!inner(
        id,
        doc_num,
        doc_date,
        account_id,
        vendor_id,
        location_id,
        vendors(name, default_account_id),
        locations(name),
        chart_of_accounts!bills_account_id_fkey(id, code, name)
      ),
      chart_of_accounts!bill_items_account_id_fkey(id, code, name)
    `
    )
    .order("id", { ascending: false });

  if (query.locationId) {
    countQuery = countQuery.eq("bills.location_id", query.locationId);
    dataQuery = dataQuery.eq("bills.location_id", query.locationId);
  }

  if (query.vendorId) {
    countQuery = countQuery.eq("bills.vendor_id", query.vendorId);
    dataQuery = dataQuery.eq("bills.vendor_id", query.vendorId);
  }

  if (query.dateFrom) {
    countQuery = countQuery.gte("bills.doc_date", query.dateFrom);
    dataQuery = dataQuery.gte("bills.doc_date", query.dateFrom);
  }

  if (query.dateTo) {
    countQuery = countQuery.lte("bills.doc_date", query.dateTo);
    dataQuery = dataQuery.lte("bills.doc_date", query.dateTo);
  }

  if (search) {
    // Search within item name and vendor name.
    countQuery = countQuery.or(`article_name.ilike.%${search}%,bills.vendors.name.ilike.%${search}%`);
    dataQuery = dataQuery.or(`article_name.ilike.%${search}%,bills.vendors.name.ilike.%${search}%`);
  }

  // “Only fallbacks” = item has no explicit account, so it will use bill/vendor/default.
  if (query.showOnlyFallbacks) {
    countQuery = countQuery.is("account_id", null);
    dataQuery = dataQuery.is("account_id", null);
  }

  const { count } = await countQuery;
  const { data, error } = await dataQuery.range(from, to);

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { data: [], total: count || 0 };

  const defaultExpense = await getDefaultLeafAccount("operating_expense");

  // Vendor default accounts (look up account code/name)
  const vendorDefaultIds = Array.from(
    new Set(
      data
        .map((row) => {
          const bill = normalizeJoin(row.bills);
          const vendor = normalizeJoin(bill?.vendors);
          return vendor?.default_account_id;
        })
        .filter((v): v is number => typeof v === "number")
    )
  );

  const vendorDefaultAccountById = new Map<number, EffectiveAccountRef>();
  if (vendorDefaultIds.length > 0) {
    const { data: vendorAccounts } = await supabase
      .from("chart_of_accounts")
      .select("id, code, name")
      .in("id", vendorDefaultIds);
    (vendorAccounts ?? []).forEach((a) => {
      vendorDefaultAccountById.set(a.id, { id: a.id, code: a.code, name: a.name });
    });
  }

  const rows: EffectiveBillItemRow[] = data.map((row) => {
    const bill = normalizeJoin(row.bills);
    const vendor = normalizeJoin(bill?.vendors);
    const location = normalizeJoin(bill?.locations);

    const itemAccount = toAccountRef(row.chart_of_accounts);
    const billAccount = toAccountRef(bill?.chart_of_accounts);

    const vendorDefaultAccountId = vendor?.default_account_id ?? null;
    const vendorDefaultAccount =
      typeof vendorDefaultAccountId === "number"
        ? vendorDefaultAccountById.get(vendorDefaultAccountId) ?? null
        : null;

    let effectiveExpenseAccount: EffectiveAccountRef | null = null;
    let effectiveExpenseSource: EffectiveBillItemRow["effectiveExpenseSource"] = "default";

    if (itemAccount) {
      effectiveExpenseAccount = itemAccount;
      effectiveExpenseSource = "explicit";
    } else if (billAccount) {
      effectiveExpenseAccount = billAccount;
      effectiveExpenseSource = "inherited";
    } else if (vendorDefaultAccount) {
      effectiveExpenseAccount = vendorDefaultAccount;
      effectiveExpenseSource = "inherited";
    } else {
      effectiveExpenseAccount = defaultExpense;
      effectiveExpenseSource = "default";
    }

    const totalPrice = typeof row.total_price === "number" ? row.total_price : Number(row.total_price ?? 0);

    return {
      id: row.id,
      billId: row.bill_id,
      billDocNum: bill?.doc_num ?? null,
      billDocDate: bill?.doc_date ?? null,
      vendorId: bill?.vendor_id ?? null,
      vendorName: vendor?.name ?? null,
      locationId: bill?.location_id ?? null,
      locationName: location?.name ?? null,
      itemName: row.article_name ?? null,
      totalPrice,
      itemAccount,
      billAccount,
      vendorDefaultAccount,
      effectiveExpenseAccount,
      effectiveExpenseSource,
    };
  });

  return { data: rows, total: count || 0 };
};
