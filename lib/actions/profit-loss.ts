"use server";

import { createClient } from "@/lib/supabase/server";

// Fiscal cutoff time is 6:45 AM
const FISCAL_CUTOFF_HOUR = 6;
const FISCAL_CUTOFF_MINUTE = 45;

export interface PLSourceDetail {
  id: string;
  name: string;
  amount: number;
  netAmount: number;
  type: "article" | "category" | "vendor" | "labor";
}

export interface PLLineItem {
  accountId: number;
  code: string;
  name: string;
  nameBg: string | null;
  level: number;
  amount: number;
  netAmount: number;
  children?: PLLineItem[];
  sourceDetails?: PLSourceDetail[];
}

export interface PLSection {
  id: string;
  name: string;
  nameBg: string;
  items: PLLineItem[];
  total: number;
  netTotal: number;
}

export interface ExcludedSales {
  voids: { amount: number; netAmount: number; count: number };
  noPaymentMethod: { amount: number; netAmount: number; count: number };
  tips: { amount: number; netAmount: number; count: number };
  total: { amount: number; netAmount: number; count: number };
}

export interface ProfitLossData {
  revenue: PLSection;
  totalDiscounts: number;
  excludedSales: ExcludedSales;
  cogs: PLSection;
  grossProfit: number;
  netGrossProfit: number;
  labor: PLSection;
  operatingExpenses: PLSection;
  operatingIncome: number;
  netOperatingIncome: number;
  nonOperating: PLSection;
  netIncome: number;
  netNetIncome: number;
  dateFrom: string;
  dateTo: string;
  locationId: string | null;
  locationName: string | null;
}

export interface PLFilters {
  dateFrom: string;
  dateTo: string;
  locationId?: string;
  useFiscalDate?: boolean;
}

/**
 * Get Profit & Loss Statement data
 */
export const getProfitLossData = async (
  filters: PLFilters
): Promise<{ data?: ProfitLossData; error?: string }> => {
  const supabase = await createClient();
  const { dateFrom, dateTo, locationId, useFiscalDate = false } = filters;

  // Get location name if filtered
  let locationName: string | null = null;
  if (locationId) {
    const { data: location } = await supabase
      .from("locations")
      .select("name")
      .eq("id", locationId)
      .single();
    locationName = location?.name || null;
  }

  // Get all chart of accounts in hierarchical structure
  const { data: accounts, error: accountsError } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .eq("is_active", true)
    .order("code");

  if (accountsError) {
    return { error: accountsError.message };
  }

  // Build account lookup maps
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const accountsByCode = new Map(accounts.map((a) => [a.code, a]));

  // Initialize amounts for each account (both gross and net)
  const accountAmounts = new Map<number, number>();
  const accountNetAmounts = new Map<number, number>();
  accounts.forEach((a) => {
    accountAmounts.set(a.id, 0);
    accountNetAmounts.set(a.id, 0);
  });

  // Track source details for each account (article/category/vendor breakdown)
  const accountSourceDetails = new Map<number, Map<string, PLSourceDetail>>();
  accounts.forEach((a) => accountSourceDetails.set(a.id, new Map()));

  // Helper to add source detail to an account
  const addSourceDetail = (
    accountId: number,
    detailId: string,
    name: string,
    amount: number,
    netAmount: number,
    type: PLSourceDetail["type"]
  ) => {
    const details = accountSourceDetails.get(accountId);
    if (details) {
      const existing = details.get(detailId);
      if (existing) {
        existing.amount += amount;
        existing.netAmount += netAmount;
      } else {
        details.set(detailId, { id: detailId, name, amount, netAmount, type });
      }
    }
  };

  // ========== REVENUE: Get sales from barsy_orders ==========
  // First, get category mappings
  const { data: categoryMappings } = await supabase
    .from("barsy_category_account_mapping")
    .select("barsy_location_id, barsy_category_id, revenue_account_id")
    .not("revenue_account_id", "is", null);

  const categoryAccountMap = new Map<string, number>();
  categoryMappings?.forEach((m) => {
    categoryAccountMap.set(
      `${m.barsy_location_id}-${m.barsy_category_id}`,
      m.revenue_account_id
    );
  });

  // Get article mappings (overrides)
  const { data: articleMappings } = await supabase
    .from("barsy_article_account_mapping")
    .select("barsy_location_id, barsy_article_id, revenue_account_id")
    .not("revenue_account_id", "is", null);

  const articleAccountMap = new Map<string, number>();
  articleMappings?.forEach((m) => {
    articleAccountMap.set(
      `${m.barsy_location_id}-${m.barsy_article_id}`,
      m.revenue_account_id
    );
  });

  // Get articles with their categories, names, and tax rates
  const { data: articles } = await supabase
    .from("barsy_articles")
    .select("location_id, barsy_article_id, category_id, article_name, tax");

  const articleCategoryMap = new Map<string, number | null>();
  const articleNameMap = new Map<string, string>();
  const articleTaxMap = new Map<string, number | null>();
  articles?.forEach((a) => {
    const key = `${a.location_id}-${a.barsy_article_id}`;
    articleCategoryMap.set(key, a.category_id);
    articleNameMap.set(key, a.article_name || "");
    articleTaxMap.set(key, a.tax);
  });

  // Helper to check if an article is tips/gratuity by name
  const isTipsArticle = (articleName: string): boolean => {
    const name = articleName.toLowerCase();
    return (
      name.includes("типс") || name.includes("бакшиш") || name.includes("tip")
    );
  };

  // Get barsy categories for classification
  const { data: barsyCategories } = await supabase
    .from("barsy_categories")
    .select("location_id, barsy_cat_id, cat_name, cat_path");

  // Build category classification map based on name patterns (granular)
  type CategoryClassification =
    | "coffee" | "tea" | "soft_drinks" | "fresh" | "non_alc_cocktails"
    | "white_wine" | "red_wine" | "rose_wine" | "sparkling_wine"
    | "beer" | "hard_seltzer"
    | "vodka" | "gin" | "whisky" | "rum" | "tequila" | "cognac" | "liqueurs" | "vermouth" | "shots"
    | "vodka_cocktails" | "gin_cocktails" | "rum_cocktails" | "tequila_cocktails" | "whisky_cocktails"
    | "liqueur_cocktails" | "classic_cocktails" | "signature_cocktails" | "hot_cocktails"
    | "food" | "packaged_food"
    | "tea_retail" | "coffee_retail" | "wine_retail" | "accessories" | "tobacco"
    | "tips" | "other";

  const categoryClassificationMap = new Map<string, CategoryClassification>();

  barsyCategories?.forEach((cat) => {
    const catName = (cat.cat_name || "").toLowerCase();
    const catPath = (cat.cat_path || "").toLowerCase();
    const key = `${cat.location_id}-${cat.barsy_cat_id}`;

    // Tips/gratuity - exclude from revenue
    if (
      catName.includes("бакшиш") ||
      catName.includes("типс") ||
      catName.includes("tip")
    ) {
      categoryClassificationMap.set(key, "tips");
    }
    // Retail categories (check path for Магазин)
    else if (catPath.includes("магазин") || catPath.includes("продукти")) {
      if (catName.includes("теа") || catName.includes("tea") || catName.includes("чай")) {
        categoryClassificationMap.set(key, "tea_retail");
      } else if (catName.includes("кафе") || catName.includes("coffee")) {
        categoryClassificationMap.set(key, "coffee_retail");
      } else if (catName.includes("вино") || catName.includes("ракия")) {
        categoryClassificationMap.set(key, "wine_retail");
      } else {
        categoryClassificationMap.set(key, "accessories");
      }
    }
    // Tobacco
    else if (catName.includes("цигари")) {
      categoryClassificationMap.set(key, "tobacco");
    }
    // Non-alcoholic cocktails (must check before soft drinks and cocktails)
    else if (
      (catName.includes("безалкохолн") && catName.includes("коктейл")) ||
      catName.includes("non-alcoholic cocktail")
    ) {
      categoryClassificationMap.set(key, "non_alc_cocktails");
    }
    // Hot cocktails
    else if (
      (catName.includes("топли") && catName.includes("коктейл")) ||
      catName.includes("hot cocktail")
    ) {
      categoryClassificationMap.set(key, "hot_cocktails");
    }
    // Classic cocktails
    else if (catName.includes("classics") || catName.includes("twists")) {
      categoryClassificationMap.set(key, "classic_cocktails");
    }
    // Signature cocktails
    else if (
      catName.includes("signature") ||
      catName.includes("bistra") ||
      catName.includes("aperamento") ||
      catName.includes("italicus") ||
      catName.includes("aperitivos")
    ) {
      categoryClassificationMap.set(key, "signature_cocktails");
    }
    // Vodka Cocktails
    else if (catName.includes("водка коктейл") || catName.includes("водка cocktail")) {
      categoryClassificationMap.set(key, "vodka_cocktails");
    }
    // Gin Cocktails
    else if (catName.includes("джин коктейл") || catName.includes("gin &tonic") || catName.includes("gin cocktail")) {
      categoryClassificationMap.set(key, "gin_cocktails");
    }
    // Rum Cocktails
    else if (catName.includes("ром коктейл") || catName.includes("rum cocktail")) {
      categoryClassificationMap.set(key, "rum_cocktails");
    }
    // Tequila Cocktails
    else if (catName.includes("текила коктейл") || catName.includes("tequila cocktail")) {
      categoryClassificationMap.set(key, "tequila_cocktails");
    }
    // Whisky Cocktails
    else if (catName.includes("уиски коктейл") || catName.includes("whisky cocktail")) {
      categoryClassificationMap.set(key, "whisky_cocktails");
    }
    // Liqueur & Aperitif Cocktails
    else if (
      catName.includes("ликьори коктейл") ||
      catName.includes("аперативни коктейл") ||
      catName.includes("aperitivos") ||
      catName.includes("aperamento") ||
      catName.includes("italicus")
    ) {
      categoryClassificationMap.set(key, "liqueur_cocktails");
    }
    // Other cocktails -> Classic Cocktails as default
    else if (
      catName.includes("коктейл") ||
      (catPath.includes("cocktails") && !catName.includes("non-alcoholic"))
    ) {
      categoryClassificationMap.set(key, "classic_cocktails");
    }
    // Tea (service, not retail)
    else if (
      catName.includes("чай") ||
      catName.includes("tea") ||
      catName.includes("билков") ||
      catName.includes("плодов") ||
      catName.includes("зелен") ||
      catName.includes("черен") ||
      catName.includes("ройбос") ||
      catName.includes("rooibos") ||
      catName.includes("herbal") ||
      catName.includes("green") ||
      catName.includes("black") ||
      catName.includes("white") ||
      catName.includes("fruit")
    ) {
      categoryClassificationMap.set(key, "tea");
    }
    // Coffee & Espresso
    else if (
      catName.includes("топли напитки") ||
      catName.includes("студени с кафе") ||
      catName.includes("кафе") ||
      catName.includes("с био") ||
      catName.includes("соево") ||
      catName.includes("без кофеин") ||
      catName.includes("dairy")
    ) {
      categoryClassificationMap.set(key, "coffee");
    }
    // Fresh & Lemonade
    else if (
      catName.includes("фреш") ||
      catName.includes("лимонад") ||
      catName.includes("шейк")
    ) {
      categoryClassificationMap.set(key, "fresh");
    }
    // Soft Drinks (Безалкохолни but not cocktails)
    else if (catName.includes("безалкохолн")) {
      categoryClassificationMap.set(key, "soft_drinks");
    }
    // White Wine
    else if (catName === "бяло" || catName.includes("бяло вино")) {
      categoryClassificationMap.set(key, "white_wine");
    }
    // Red Wine
    else if (catName.includes("червен")) {
      categoryClassificationMap.set(key, "red_wine");
    }
    // Rosé Wine
    else if (catName.includes("розе")) {
      categoryClassificationMap.set(key, "rose_wine");
    }
    // Sparkling Wine
    else if (catName.includes("пенливо")) {
      categoryClassificationMap.set(key, "sparkling_wine");
    }
    // Generic Wine -> White Wine as default
    else if (catName === "вино") {
      categoryClassificationMap.set(key, "white_wine");
    }
    // Hard Seltzer
    else if (catName.includes("зелцер")) {
      categoryClassificationMap.set(key, "hard_seltzer");
    }
    // Beer
    else if (catName.includes("бира")) {
      categoryClassificationMap.set(key, "beer");
    }
    // Shots
    else if (catName.includes("шотове") || catName.includes("ракия")) {
      categoryClassificationMap.set(key, "shots");
    }
    // Vodka
    else if (catName.includes("водка") && !catName.includes("коктейл")) {
      categoryClassificationMap.set(key, "vodka");
    }
    // Gin
    else if (catName.includes("джин") && !catName.includes("коктейл")) {
      categoryClassificationMap.set(key, "gin");
    }
    // Whisky
    else if (
      (catName.includes("уиски") ||
      catName.includes("whisky") ||
      catName.includes("bourbon") ||
      catName.includes("scotch") ||
      catName.includes("irish") ||
      catName.includes("malt") ||
      catName.includes("бърбън") ||
      catName.includes("шотландски") ||
      catName.includes("ирландски") ||
      catName.includes("отлежало") ||
      catName.includes("tennessee")) && !catName.includes("коктейл")
    ) {
      categoryClassificationMap.set(key, "whisky");
    }
    // Rum
    else if ((catName.includes("ром") || catName.includes("ром и текила")) && !catName.includes("коктейл")) {
      categoryClassificationMap.set(key, "rum");
    }
    // Tequila
    else if (catName.includes("текила") && !catName.includes("коктейл") && !catName.includes("шотове")) {
      categoryClassificationMap.set(key, "tequila");
    }
    // Cognac
    else if (catName.includes("коняк")) {
      categoryClassificationMap.set(key, "cognac");
    }
    // Liqueurs
    else if (catName.includes("ликьор") && !catName.includes("коктейл")) {
      categoryClassificationMap.set(key, "liqueurs");
    }
    // Vermouth & Aperitifs
    else if (
      (catName.includes("вермут") ||
      catName.includes("аперитив") ||
      catName.includes("диджистив")) && !catName.includes("коктейл")
    ) {
      categoryClassificationMap.set(key, "vermouth");
    }
    // Food
    else if (
      catName.includes("храна") ||
      catName.includes("ядки") ||
      catName.includes("добро утро")
    ) {
      categoryClassificationMap.set(key, "food");
    }
    // Packaged food
    else if (catName.includes("пакет")) {
      categoryClassificationMap.set(key, "packaged_food");
    }
    // Default
    else {
      categoryClassificationMap.set(key, "other");
    }
  });

  // Find specific revenue account IDs by code (new granular structure)
  // Non-Alcoholic Beverages
  const coffeeRevenueAccount = accounts.find((a) => a.code === "1101");
  const teaRevenueAccount = accounts.find((a) => a.code === "1102");
  const softDrinksRevenueAccount = accounts.find((a) => a.code === "1103");
  const freshRevenueAccount = accounts.find((a) => a.code === "1104");
  const nonAlcCocktailsRevenueAccount = accounts.find((a) => a.code === "1105");
  // Wine
  const whiteWineAccount = accounts.find((a) => a.code === "1201");
  const redWineAccount = accounts.find((a) => a.code === "1202");
  const roseWineAccount = accounts.find((a) => a.code === "1203");
  const sparklingWineAccount = accounts.find((a) => a.code === "1204");
  // Beer
  const beerRevenueAccount = accounts.find((a) => a.code === "1301");
  const hardSeltzerAccount = accounts.find((a) => a.code === "1302");
  // Spirits
  const vodkaAccount = accounts.find((a) => a.code === "1401");
  const ginAccount = accounts.find((a) => a.code === "1402");
  const whiskyAccount = accounts.find((a) => a.code === "1403");
  const rumAccount = accounts.find((a) => a.code === "1404");
  const tequilaAccount = accounts.find((a) => a.code === "1405");
  const cognacAccount = accounts.find((a) => a.code === "1406");
  const liqueursAccount = accounts.find((a) => a.code === "1407");
  const vermouthAccount = accounts.find((a) => a.code === "1408");
  const shotsRevenueAccount = accounts.find((a) => a.code === "1409");
  // Cocktails
  const vodkaCocktailsAccount = accounts.find((a) => a.code === "1501");
  const ginCocktailsAccount = accounts.find((a) => a.code === "1502");
  const rumCocktailsAccount = accounts.find((a) => a.code === "1503");
  const tequilaCocktailsAccount = accounts.find((a) => a.code === "1504");
  const whiskyCocktailsAccount = accounts.find((a) => a.code === "1505");
  const liqueurCocktailsAccount = accounts.find((a) => a.code === "1506");
  const classicCocktailsAccount = accounts.find((a) => a.code === "1507");
  const signatureCocktailsAccount = accounts.find((a) => a.code === "1508");
  const hotCocktailsAccount = accounts.find((a) => a.code === "1509");
  // Food
  const foodRevenueAccount = accounts.find((a) => a.code === "1601");
  const packagedFoodAccount = accounts.find((a) => a.code === "1602");
  // Retail
  const teaRetailAccount = accounts.find((a) => a.code === "1701");
  const coffeeRetailAccount = accounts.find((a) => a.code === "1702");
  const wineRetailAccount = accounts.find((a) => a.code === "1703");
  const accessoriesRetailAccount = accounts.find((a) => a.code === "1704");
  const tobaccoAccount = accounts.find((a) => a.code === "1705");
  // Uncategorized
  const uncategorizedRevenueAccount = accounts.find((a) => a.code === "1801");

  // Get barsy location ID if filtering by location
  let barsyLocationId: string | null = null;
  // Flag to track if location was requested but has no barsy integration
  let locationHasNoBarsyIntegration = false;

  if (locationId) {
    const { data: barsyLoc } = await supabase
      .from("barsy_locations")
      .select("id")
      .eq("memento_location_id", parseInt(locationId))
      .single();

    barsyLocationId = barsyLoc?.id || null;

    // If a location was selected but has no barsy integration, mark it
    // This means we should show 0 revenue instead of all locations' revenue
    if (!barsyLocationId) {
      locationHasNoBarsyIntegration = true;
    }
  }

  // Get accounts with payment methods to filter out "no payment" transactions
  let accountsQuery = supabase
    .from("barsy_accounts")
    .select("location_id, barsy_account_id, raw_data")
    .gte("close_date", dateFrom)
    .lte("close_date", dateTo + " 23:59:59");

  if (barsyLocationId) {
    accountsQuery = accountsQuery.eq("location_id", barsyLocationId);
  }

  // If location was requested but has no barsy integration, skip accounts query
  const { data: accountsWithPayments } = locationHasNoBarsyIntegration
    ? { data: [] }
    : await accountsQuery;

  // Build a set of valid account IDs (those with payment methods)
  const validAccountIds = new Set<string>();
  accountsWithPayments?.forEach((acc) => {
    const paymentName = acc.raw_data?.payment_name;
    const paymethodName = acc.raw_data?.paymethod_name;
    // Only include accounts that have a payment method
    if (paymentName || paymethodName) {
      validAccountIds.add(`${acc.location_id}-${acc.barsy_account_id}`);
    }
  });

  // Get ALL sales data (including voids for tracking)
  let allSalesQuery = supabase
    .from("barsy_orders")
    .select("location_id, barsy_article_id, actual_price, amount, raw_data");

  // Apply date filters with fiscal date support
  if (useFiscalDate) {
    // Fiscal date: start from 6:45 AM on the start date
    allSalesQuery = allSalesQuery.gte(
      "order_date",
      `${dateFrom} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
    );
    // Fiscal date: extend to 6:44:59 AM on the day after end date
    const endDateObj = new Date(dateTo);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const extendedEndDate = endDateObj.toISOString().split("T")[0];
    allSalesQuery = allSalesQuery.lt(
      "order_date",
      `${extendedEndDate} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`
    );
  } else {
    allSalesQuery = allSalesQuery.gte("order_date", dateFrom).lte("order_date", dateTo);
  }

  if (barsyLocationId) {
    allSalesQuery = allSalesQuery.eq("location_id", barsyLocationId);
  }

  // If location was requested but has no barsy integration, skip sales query
  // This prevents showing all locations' sales for a non-barsy location (e.g., HQ)
  const { data: allSalesData } = locationHasNoBarsyIntegration
    ? { data: [] }
    : await allSalesQuery;

  // Track excluded sales
  const excludedSales: ExcludedSales = {
    voids: { amount: 0, netAmount: 0, count: 0 },
    noPaymentMethod: { amount: 0, netAmount: 0, count: 0 },
    tips: { amount: 0, netAmount: 0, count: 0 },
    total: { amount: 0, netAmount: 0, count: 0 },
  };

  // Separate voids from valid sales
  const validSalesData = allSalesData?.filter((sale) => {
    const quantity = parseFloat(String(sale.amount)) || 0;
    const unitPrice = parseFloat(String(sale.actual_price)) || 0;
    const lineTotal = quantity * unitPrice;

    if (quantity <= 0 || lineTotal <= 0) {
      // Track voided sales
      const articleKey = `${sale.location_id}-${sale.barsy_article_id}`;
      const taxRate = articleTaxMap.get(articleKey);
      const lineNetTotal = taxRate !== null && taxRate !== undefined
        ? lineTotal / (1 + taxRate / 100)
        : lineTotal;

      excludedSales.voids.amount += Math.abs(lineTotal);
      excludedSales.voids.netAmount += Math.abs(lineNetTotal);
      excludedSales.voids.count += 1;
      excludedSales.total.amount += Math.abs(lineTotal);
      excludedSales.total.netAmount += Math.abs(lineNetTotal);
      excludedSales.total.count += 1;
      return false;
    }
    return true;
  }) || [];

  // Filter sales to only include those with valid payment methods
  const sales = validSalesData.filter((sale) => {
    const accountId = sale.raw_data?.account_id;
    if (!accountId) {
      // Track sales without account ID
      const articleKey = `${sale.location_id}-${sale.barsy_article_id}`;
      const quantity = parseFloat(String(sale.amount)) || 0;
      const unitPrice = parseFloat(String(sale.actual_price)) || 0;
      const lineTotal = quantity * unitPrice;
      const taxRate = articleTaxMap.get(articleKey);
      const lineNetTotal = taxRate !== null && taxRate !== undefined
        ? lineTotal / (1 + taxRate / 100)
        : lineTotal;

      excludedSales.noPaymentMethod.amount += lineTotal;
      excludedSales.noPaymentMethod.netAmount += lineNetTotal;
      excludedSales.noPaymentMethod.count += 1;
      excludedSales.total.amount += lineTotal;
      excludedSales.total.netAmount += lineNetTotal;
      excludedSales.total.count += 1;
      return false;
    }
    const key = `${sale.location_id}-${accountId}`;
    if (!validAccountIds.has(key)) {
      // Track sales without valid payment method
      const articleKey = `${sale.location_id}-${sale.barsy_article_id}`;
      const quantity = parseFloat(String(sale.amount)) || 0;
      const unitPrice = parseFloat(String(sale.actual_price)) || 0;
      const lineTotal = quantity * unitPrice;
      const taxRate = articleTaxMap.get(articleKey);
      const lineNetTotal = taxRate !== null && taxRate !== undefined
        ? lineTotal / (1 + taxRate / 100)
        : lineTotal;

      excludedSales.noPaymentMethod.amount += lineTotal;
      excludedSales.noPaymentMethod.netAmount += lineNetTotal;
      excludedSales.noPaymentMethod.count += 1;
      excludedSales.total.amount += lineTotal;
      excludedSales.total.netAmount += lineNetTotal;
      excludedSales.total.count += 1;
      return false;
    }
    return true;
  });

  // Default revenue account (use first level-3 revenue account)
  const defaultRevenueAccount = accounts.find(
    (a) => a.account_type === "revenue" && a.level === 3
  );
  const defaultRevenueAccountId = defaultRevenueAccount?.id;

  // Track total discounts given
  let totalDiscounts = 0;

  // Aggregate sales by account with classification
  sales?.forEach((sale) => {
    const articleKey = `${sale.location_id}-${sale.barsy_article_id}`;

    // Get the category classification for this article
    const categoryId = articleCategoryMap.get(articleKey);
    const classification = categoryId
      ? categoryClassificationMap.get(`${sale.location_id}-${categoryId}`)
      : undefined;

    // Skip tips/gratuities - they are not operating revenue
    // Check both category classification and article name
    const articleName = articleNameMap.get(articleKey) || "";
    if (classification === "tips" || isTipsArticle(articleName)) {
      // Track excluded tips
      const quantity = parseFloat(String(sale.amount)) || 0;
      const unitPrice = parseFloat(String(sale.actual_price)) || 0;
      const lineTotal = quantity * unitPrice;
      const taxRate = articleTaxMap.get(articleKey);
      const lineNetTotal = taxRate !== null && taxRate !== undefined
        ? lineTotal / (1 + taxRate / 100)
        : lineTotal;

      excludedSales.tips.amount += lineTotal;
      excludedSales.tips.netAmount += lineNetTotal;
      excludedSales.tips.count += 1;
      excludedSales.total.amount += lineTotal;
      excludedSales.total.netAmount += lineNetTotal;
      excludedSales.total.count += 1;
      return;
    }

    // First check for explicit article/category mappings
    let accountId = articleAccountMap.get(articleKey);

    if (!accountId) {
      if (categoryId) {
        // Check for explicit category-to-account mapping
        accountId = categoryAccountMap.get(`${sale.location_id}-${categoryId}`);

        // If no explicit mapping, use classification-based mapping (granular)
        if (!accountId && classification) {
          const classificationToAccount: Record<string, { id: number } | undefined> = {
            // Non-Alcoholic Beverages
            coffee: coffeeRevenueAccount,
            tea: teaRevenueAccount,
            soft_drinks: softDrinksRevenueAccount,
            fresh: freshRevenueAccount,
            non_alc_cocktails: nonAlcCocktailsRevenueAccount,
            // Wine
            white_wine: whiteWineAccount,
            red_wine: redWineAccount,
            rose_wine: roseWineAccount,
            sparkling_wine: sparklingWineAccount,
            // Beer
            beer: beerRevenueAccount,
            hard_seltzer: hardSeltzerAccount,
            // Spirits
            vodka: vodkaAccount,
            gin: ginAccount,
            whisky: whiskyAccount,
            rum: rumAccount,
            tequila: tequilaAccount,
            cognac: cognacAccount,
            liqueurs: liqueursAccount,
            vermouth: vermouthAccount,
            shots: shotsRevenueAccount,
            // Cocktails
            vodka_cocktails: vodkaCocktailsAccount,
            gin_cocktails: ginCocktailsAccount,
            rum_cocktails: rumCocktailsAccount,
            tequila_cocktails: tequilaCocktailsAccount,
            whisky_cocktails: whiskyCocktailsAccount,
            liqueur_cocktails: liqueurCocktailsAccount,
            classic_cocktails: classicCocktailsAccount,
            signature_cocktails: signatureCocktailsAccount,
            hot_cocktails: hotCocktailsAccount,
            // Food
            food: foodRevenueAccount,
            packaged_food: packagedFoodAccount,
            // Retail
            tea_retail: teaRetailAccount,
            coffee_retail: coffeeRetailAccount,
            wine_retail: wineRetailAccount,
            accessories: accessoriesRetailAccount,
            tobacco: tobaccoAccount,
          };
          const mappedAccount = classificationToAccount[classification];
          if (mappedAccount) {
            accountId = mappedAccount.id;
          }
        }
      }
    }

    if (!accountId) {
      // Use uncategorized account if article has no category, otherwise use default
      accountId = uncategorizedRevenueAccount?.id || defaultRevenueAccountId;
    }

    if (accountId) {
      const current = accountAmounts.get(accountId) || 0;
      const currentNet = accountNetAmounts.get(accountId) || 0;
      // Revenue = quantity × unit price
      const quantity = parseFloat(String(sale.amount)) || 0;
      const unitPrice = parseFloat(String(sale.actual_price)) || 0;
      const lineTotal = quantity * unitPrice;

      // Calculate net amount based on article tax rate
      // If tax is null/missing, show gross (don't try to exclude VAT)
      const taxRate = articleTaxMap.get(articleKey);
      const lineNetTotal = taxRate !== null && taxRate !== undefined
        ? lineTotal / (1 + taxRate / 100)
        : lineTotal;

      accountAmounts.set(accountId, current + lineTotal);
      accountNetAmounts.set(accountId, currentNet + lineNetTotal);

      // Track source detail by article
      addSourceDetail(
        accountId,
        `article-${sale.barsy_article_id}`,
        articleName || `Article ${sale.barsy_article_id}`,
        lineTotal,
        lineNetTotal,
        "article"
      );

      // Calculate discount for this line item
      // Discount is stored as a percentage in raw_data.discount (can be negative)
      const discountPercent =
        parseFloat(String(sale.raw_data?.discount || 0)) || 0;
      if (discountPercent !== 0) {
        // Discount amount = (line total × |discount percent|) / 100
        // Use absolute value since discounts can be stored as negative percentages
        const discountAmount = (lineTotal * Math.abs(discountPercent)) / 100;
        totalDiscounts += discountAmount;
      }
    }
  });

  // ========== COGS: Calculate from store-out details (preferred) or fallback to recipes ==========
  // Priority for COGS cost data:
  // 1. barsy_store_out_details.avg_delivery_price (actual consumption cost at time of depletion)
  // 2. barsy_recipes.avg_delivery_price_total (recipe-based cost)
  // 3. Last purchase price × portion size (fallback)

  // Find COGS accounts by code for categorization (new granular structure)
  // Non-Alcoholic COGS
  const coffeeCogsAccount = accounts.find((a) => a.code === "2101");
  const teaCogsAccount = accounts.find((a) => a.code === "2102");
  const softDrinksCogsAccount = accounts.find((a) => a.code === "2103");
  const freshCogsAccount = accounts.find((a) => a.code === "2104");
  const nonAlcCocktailsCogsAccount = accounts.find((a) => a.code === "2105");
  // Wine COGS
  const whiteWineCogsAccount = accounts.find((a) => a.code === "2201");
  const redWineCogsAccount = accounts.find((a) => a.code === "2202");
  const roseWineCogsAccount = accounts.find((a) => a.code === "2203");
  const sparklingWineCogsAccount = accounts.find((a) => a.code === "2204");
  // Beer COGS
  const beerCogsAccount = accounts.find((a) => a.code === "2301");
  const hardSeltzerCogsAccount = accounts.find((a) => a.code === "2302");
  // Spirits COGS
  const vodkaCogsAccount = accounts.find((a) => a.code === "2401");
  const ginCogsAccount = accounts.find((a) => a.code === "2402");
  const whiskyCogsAccount = accounts.find((a) => a.code === "2403");
  const rumCogsAccount = accounts.find((a) => a.code === "2404");
  const tequilaCogsAccount = accounts.find((a) => a.code === "2405");
  const cognacCogsAccount = accounts.find((a) => a.code === "2406");
  const liqueursCogsAccount = accounts.find((a) => a.code === "2407");
  const vermouthCogsAccount = accounts.find((a) => a.code === "2408");
  const shotsCogsAccount = accounts.find((a) => a.code === "2409");
  // Cocktails COGS
  const vodkaCocktailsCogsAccount = accounts.find((a) => a.code === "2501");
  const ginCocktailsCogsAccount = accounts.find((a) => a.code === "2502");
  const rumCocktailsCogsAccount = accounts.find((a) => a.code === "2503");
  const tequilaCocktailsCogsAccount = accounts.find((a) => a.code === "2504");
  const whiskyCocktailsCogsAccount = accounts.find((a) => a.code === "2505");
  const liqueurCocktailsCogsAccount = accounts.find((a) => a.code === "2506");
  const classicCocktailsCogsAccount = accounts.find((a) => a.code === "2507");
  const signatureCocktailsCogsAccount = accounts.find((a) => a.code === "2508");
  const hotCocktailsCogsAccount = accounts.find((a) => a.code === "2509");
  // Food COGS
  const foodCogsAccount = accounts.find((a) => a.code === "2601");
  const packagedFoodCogsAccount = accounts.find((a) => a.code === "2602");
  // Retail COGS
  const teaRetailCogsAccount = accounts.find((a) => a.code === "2701");
  const coffeeRetailCogsAccount = accounts.find((a) => a.code === "2702");
  const wineRetailCogsAccount = accounts.find((a) => a.code === "2703");
  const accessoriesCogsAccount = accounts.find((a) => a.code === "2704");
  const tobaccoCogsAccount = accounts.find((a) => a.code === "2705");
  // Other COGS
  const packagingCogsAccount = accounts.find((a) => a.code === "2801");
  const uncategorizedCogsAccount = accounts.find((a) => a.code === "2802");
  const defaultCogsAccount = accounts.find(
    (a) => a.account_type === "cogs" && a.level === 3
  );
  const defaultCogsAccountId = defaultCogsAccount?.id;

  // Try to get COGS from barsy_store_out_details first (actual consumption with avg_delivery_price)
  // If location was requested but has no barsy integration, skip this query
  let storeOutDetails: Array<{
    location_id: string;
    barsy_article_id: number;
    quantity: number | null;
    avg_delivery_price: number | null;
    total_cost: number | null;
    store_out_date: string | null;
  }> | null = [];

  if (!locationHasNoBarsyIntegration) {
    let storeOutDetailsQuery = supabase
      .from("barsy_store_out_details")
      .select(
        "location_id, barsy_article_id, quantity, avg_delivery_price, total_cost, store_out_date"
      )
      .gte("store_out_date", dateFrom)
      .lte("store_out_date", dateTo)
      .gt("avg_delivery_price", 0); // Only include items with valid cost data

    if (barsyLocationId) {
      storeOutDetailsQuery = storeOutDetailsQuery.eq(
        "location_id",
        barsyLocationId
      );
    }

    const result = await storeOutDetailsQuery;
    storeOutDetails = result.data;
  }

  // Build a map of store-out costs: location_id-article_id -> total cost from store-outs
  const storeOutCostMap = new Map<string, number>();
  storeOutDetails?.forEach((detail) => {
    const key = `${detail.location_id}-${detail.barsy_article_id}`;
    const cost = parseFloat(String(detail.total_cost)) || 0;
    const current = storeOutCostMap.get(key) || 0;
    storeOutCostMap.set(key, current + cost);
  });

  const hasStoreOutData = storeOutDetails && storeOutDetails.length > 0;
  console.log(
    `COGS source: ${
      hasStoreOutData
        ? `Store-out details (${storeOutDetails?.length || 0} records)`
        : "Recipe/purchase fallback"
    }`
  );

  if (hasStoreOutData) {
    // Use store-out details for COGS - this is the most accurate consumption-based COGS
    storeOutDetails?.forEach((detail) => {
      const articleKey = `${detail.location_id}-${detail.barsy_article_id}`;
      const totalCost = parseFloat(String(detail.total_cost)) || 0;

      if (totalCost <= 0) return;

      // Get the category classification for this article
      const categoryId = articleCategoryMap.get(articleKey);
      const classification = categoryId
        ? categoryClassificationMap.get(`${detail.location_id}-${categoryId}`)
        : undefined;

      // Skip tips/gratuities - they have no COGS
      const articleName = articleNameMap.get(articleKey) || "";
      if (classification === "tips" || isTipsArticle(articleName)) {
        return;
      }

      // Use uncategorized COGS account if article has no category, otherwise use default
      let cogsAccountId = (!categoryId && uncategorizedCogsAccount?.id)
        ? uncategorizedCogsAccount.id
        : defaultCogsAccountId;

      // Map classification to COGS account (granular)
      if (classification) {
        const classificationToCogsAccount: Record<string, { id: number } | undefined> = {
          // Non-Alcoholic COGS
          coffee: coffeeCogsAccount,
          tea: teaCogsAccount,
          soft_drinks: softDrinksCogsAccount,
          fresh: freshCogsAccount,
          non_alc_cocktails: nonAlcCocktailsCogsAccount,
          // Wine COGS
          white_wine: whiteWineCogsAccount,
          red_wine: redWineCogsAccount,
          rose_wine: roseWineCogsAccount,
          sparkling_wine: sparklingWineCogsAccount,
          // Beer COGS
          beer: beerCogsAccount,
          hard_seltzer: hardSeltzerCogsAccount,
          // Spirits COGS
          vodka: vodkaCogsAccount,
          gin: ginCogsAccount,
          whisky: whiskyCogsAccount,
          rum: rumCogsAccount,
          tequila: tequilaCogsAccount,
          cognac: cognacCogsAccount,
          liqueurs: liqueursCogsAccount,
          vermouth: vermouthCogsAccount,
          shots: shotsCogsAccount,
          // Cocktails COGS
          vodka_cocktails: vodkaCocktailsCogsAccount,
          gin_cocktails: ginCocktailsCogsAccount,
          rum_cocktails: rumCocktailsCogsAccount,
          tequila_cocktails: tequilaCocktailsCogsAccount,
          whisky_cocktails: whiskyCocktailsCogsAccount,
          liqueur_cocktails: liqueurCocktailsCogsAccount,
          classic_cocktails: classicCocktailsCogsAccount,
          signature_cocktails: signatureCocktailsCogsAccount,
          hot_cocktails: hotCocktailsCogsAccount,
          // Food COGS
          food: foodCogsAccount,
          packaged_food: packagedFoodCogsAccount,
          // Retail COGS
          tea_retail: teaRetailCogsAccount,
          coffee_retail: coffeeRetailCogsAccount,
          wine_retail: wineRetailCogsAccount,
          accessories: accessoriesCogsAccount,
          tobacco: tobaccoCogsAccount,
        };
        const mappedCogsAccount = classificationToCogsAccount[classification];
        if (mappedCogsAccount) {
          cogsAccountId = mappedCogsAccount.id;
        }
      }

      if (cogsAccountId) {
        const current = accountAmounts.get(cogsAccountId) || 0;
        const currentNet = accountNetAmounts.get(cogsAccountId) || 0;

        // Calculate net COGS based on article tax rate
        // If tax is null/missing, show gross (don't try to exclude VAT)
        const taxRate = articleTaxMap.get(articleKey);
        const netCost = taxRate !== null && taxRate !== undefined
          ? totalCost / (1 + taxRate / 100)
          : totalCost;

        accountAmounts.set(cogsAccountId, current + totalCost);
        accountNetAmounts.set(cogsAccountId, currentNet + netCost);

        // Track source detail by article
        addSourceDetail(
          cogsAccountId,
          `article-${detail.barsy_article_id}`,
          articleName || `Article ${detail.barsy_article_id}`,
          totalCost,
          netCost,
          "article"
        );
      }
    });
  } else {
    // Fallback: Use recipe costs or last purchase price
    // Get product costs from barsy_recipes (using avg_delivery_price_total from raw_data)
    const { data: recipes } = await supabase
      .from("barsy_recipes")
      .select("location_id, barsy_article_id, raw_data");

    // Build product cost map from recipes: location_id-article_id -> total cost per unit sold
    const recipeCostMap = new Map<string, number>();
    recipes?.forEach((recipe) => {
      const key = `${recipe.location_id}-${recipe.barsy_article_id}`;
      const costPerPortion = parseFloat(
        recipe.raw_data?.avg_delivery_price_total || 0
      );
      const currentCost = recipeCostMap.get(key) || 0;
      recipeCostMap.set(key, currentCost + costPerPortion);
    });

    // Get last purchase prices as fallback for items without recipe costs
    const { data: storeLoadItems } = await supabase
      .from("barsy_store_load_items")
      .select(
        `
        barsy_article_id,
        unit_price,
        store_load_id,
        barsy_store_loads!inner(location_id, doc_date)
      `
      )
      .gt("unit_price", 0)
      .order("store_load_id", { ascending: false });

    // Build last purchase price map: barsy_article_id -> unit_price (most recent)
    const lastPurchasePriceMap = new Map<number, number>();
    storeLoadItems?.forEach((item) => {
      if (!lastPurchasePriceMap.has(item.barsy_article_id)) {
        lastPurchasePriceMap.set(
          item.barsy_article_id,
          parseFloat(String(item.unit_price)) || 0
        );
      }
    });

    // Get article portion sizes (amount_unit) for calculating cost per portion
    const { data: articlePortions } = await supabase
      .from("barsy_articles")
      .select("location_id, barsy_article_id, amount_unit");

    const articlePortionMap = new Map<string, number>();
    articlePortions?.forEach((a) => {
      const key = `${a.location_id}-${a.barsy_article_id}`;
      const portionSize = parseFloat(String(a.amount_unit)) || 1;
      articlePortionMap.set(key, portionSize);
    });

    // Combined cost map: prefer recipe costs, fall back to last purchase price × portion size
    const productCostMap = new Map<string, number>();

    // First, add all recipe costs (already calculated per portion)
    recipeCostMap.forEach((cost, key) => {
      if (cost > 0) {
        productCostMap.set(key, cost);
      }
    });

    // Then, for items without recipe costs, use last purchase price × portion size
    sales?.forEach((sale) => {
      const key = `${sale.location_id}-${sale.barsy_article_id}`;
      if (!productCostMap.has(key) || productCostMap.get(key) === 0) {
        const purchasePrice = lastPurchasePriceMap.get(sale.barsy_article_id);
        const portionSize = articlePortionMap.get(key);

        if (
          purchasePrice &&
          purchasePrice > 0 &&
          portionSize !== undefined &&
          portionSize > 0
        ) {
          const costPerPortion = purchasePrice * portionSize;
          productCostMap.set(key, costPerPortion);
        }
      }
    });

    // Calculate COGS based on sales quantity * product costs from recipes, categorized by product type
    sales?.forEach((sale) => {
      const articleKey = `${sale.location_id}-${sale.barsy_article_id}`;

      const categoryId = articleCategoryMap.get(articleKey);
      const classification = categoryId
        ? categoryClassificationMap.get(`${sale.location_id}-${categoryId}`)
        : undefined;

      // Skip tips/gratuities - they have no COGS
      const articleName = articleNameMap.get(articleKey) || "";
      if (classification === "tips" || isTipsArticle(articleName)) {
        return;
      }

      const costPerUnit = productCostMap.get(articleKey) || 0;
      const quantity = parseFloat(String(sale.amount)) || 0;
      const cogsCost = quantity * costPerUnit;

      if (cogsCost > 0) {
        // Use uncategorized COGS account if article has no category, otherwise use default
        let cogsAccountId = (!categoryId && uncategorizedCogsAccount?.id)
          ? uncategorizedCogsAccount.id
          : defaultCogsAccountId;

        // Map classification to COGS account (granular)
        if (classification) {
          const classificationToCogsAccount: Record<string, { id: number } | undefined> = {
            // Non-Alcoholic COGS
            coffee: coffeeCogsAccount,
            tea: teaCogsAccount,
            soft_drinks: softDrinksCogsAccount,
            fresh: freshCogsAccount,
            non_alc_cocktails: nonAlcCocktailsCogsAccount,
            // Wine COGS
            white_wine: whiteWineCogsAccount,
            red_wine: redWineCogsAccount,
            rose_wine: roseWineCogsAccount,
            sparkling_wine: sparklingWineCogsAccount,
            // Beer COGS
            beer: beerCogsAccount,
            hard_seltzer: hardSeltzerCogsAccount,
            // Spirits COGS
            vodka: vodkaCogsAccount,
            gin: ginCogsAccount,
            whisky: whiskyCogsAccount,
            rum: rumCogsAccount,
            tequila: tequilaCogsAccount,
            cognac: cognacCogsAccount,
            liqueurs: liqueursCogsAccount,
            vermouth: vermouthCogsAccount,
            shots: shotsCogsAccount,
            // Cocktails COGS
            vodka_cocktails: vodkaCocktailsCogsAccount,
            gin_cocktails: ginCocktailsCogsAccount,
            rum_cocktails: rumCocktailsCogsAccount,
            tequila_cocktails: tequilaCocktailsCogsAccount,
            whisky_cocktails: whiskyCocktailsCogsAccount,
            liqueur_cocktails: liqueurCocktailsCogsAccount,
            classic_cocktails: classicCocktailsCogsAccount,
            signature_cocktails: signatureCocktailsCogsAccount,
            hot_cocktails: hotCocktailsCogsAccount,
            // Food COGS
            food: foodCogsAccount,
            packaged_food: packagedFoodCogsAccount,
            // Retail COGS
            tea_retail: teaRetailCogsAccount,
            coffee_retail: coffeeRetailCogsAccount,
            wine_retail: wineRetailCogsAccount,
            accessories: accessoriesCogsAccount,
            tobacco: tobaccoCogsAccount,
          };
          const mappedCogsAccount = classificationToCogsAccount[classification];
          if (mappedCogsAccount) {
            cogsAccountId = mappedCogsAccount.id;
          }
        }

        if (cogsAccountId) {
          const current = accountAmounts.get(cogsAccountId) || 0;
          const currentNet = accountNetAmounts.get(cogsAccountId) || 0;

          // Calculate net COGS based on article tax rate
          // If tax is null/missing, show gross (don't try to exclude VAT)
          const taxRate = articleTaxMap.get(articleKey);
          const netCogsCost = taxRate !== null && taxRate !== undefined
            ? cogsCost / (1 + taxRate / 100)
            : cogsCost;

          accountAmounts.set(cogsAccountId, current + cogsCost);
          accountNetAmounts.set(cogsAccountId, currentNet + netCogsCost);

          // Track source detail by article
          addSourceDetail(
            cogsAccountId,
            `article-${sale.barsy_article_id}`,
            articleName || `Article ${sale.barsy_article_id}`,
            cogsCost,
            netCogsCost,
            "article"
          );
        }
      }
    });
  }

  // ========== EXPENSES: Get from bills ==========
  // Parse P&L period dates for proration calculations
  const plStart = new Date(dateFrom);
  const plEnd = new Date(dateTo);
  const msPerDay = 24 * 60 * 60 * 1000;

  // Get bills that either:
  // 1. Have a period that overlaps with P&L period (period_start <= dateTo AND period_end >= dateFrom)
  // 2. Have doc_date within P&L period (for bills without period)
  // We fetch all non-voided bills and filter in code for complex overlap logic
  let billsQuery = supabase
    .from("bills")
    .select(
      `
      id,
      doc_date,
      period_start,
      period_end,
      total_amount,
      account_id,
      vendor_id,
      has_vat,
      vat_rate,
      vat_amount,
      vendors(default_account_id, name)
    `
    )
    .neq("status", "voided");

  if (locationId) {
    billsQuery = billsQuery.eq("location_id", locationId);
  }

  const { data: allBills } = await billsQuery;

  // Filter bills that overlap with P&L period
  const bills = allBills?.filter((bill) => {
    if (bill.period_start && bill.period_end) {
      // Bill has a period - check for overlap
      return bill.period_start <= dateTo && bill.period_end >= dateFrom;
    } else {
      // No period - use doc_date (falls within P&L period)
      return bill.doc_date >= dateFrom && bill.doc_date <= dateTo;
    }
  });

  // Get bill items with their account mappings
  const billIds = bills?.map((b) => b.id) || [];

  let billItems: any[] = [];
  if (billIds.length > 0) {
    const { data: items } = await supabase
      .from("bill_items")
      .select("bill_id, total_price, account_id, vat_rate, vat_amount")
      .in("bill_id", billIds);
    billItems = items || [];
  }

  // Group bill items by bill
  const billItemsByBill = new Map<number, any[]>();
  billItems.forEach((item) => {
    const items = billItemsByBill.get(item.bill_id) || [];
    items.push(item);
    billItemsByBill.set(item.bill_id, items);
  });

  // Default expense account (use first level-3 operating expense account)
  const defaultExpenseAccount = accounts.find(
    (a) => a.account_type === "operating_expense" && a.level === 3
  );
  const defaultExpenseAccountId = defaultExpenseAccount?.id;

  // Helper to calculate proration factor for a bill
  const calculateProrationFactor = (bill: {
    period_start?: string | null;
    period_end?: string | null;
    doc_date: string;
  }): number => {
    if (!bill.period_start || !bill.period_end) {
      // No period defined - no proration, full amount applies
      return 1;
    }

    const billStart = new Date(bill.period_start);
    const billEnd = new Date(bill.period_end);

    // Calculate overlap period
    const overlapStart = billStart > plStart ? billStart : plStart;
    const overlapEnd = billEnd < plEnd ? billEnd : plEnd;

    // Calculate days
    const billDays =
      Math.round((billEnd.getTime() - billStart.getTime()) / msPerDay) + 1;
    const overlapDays =
      Math.round((overlapEnd.getTime() - overlapStart.getTime()) / msPerDay) +
      1;

    return billDays > 0 ? overlapDays / billDays : 0;
  };

  // Helper to calculate net amount for a bill or bill item
  const calculateNetAmount = (
    grossAmount: number,
    hasVat: boolean | null,
    vatRate: number | null,
    vatAmount: number | null
  ): number => {
    // If no VAT data or explicitly marked as no VAT, return gross
    if (!hasVat || (vatRate === null && vatAmount === null)) {
      return grossAmount;
    }
    // If we have vat_amount, use it directly
    if (vatAmount !== null && vatAmount > 0) {
      return grossAmount - vatAmount;
    }
    // If we have vat_rate, calculate net
    if (vatRate !== null && vatRate > 0) {
      return grossAmount / (1 + vatRate / 100);
    }
    // Fallback to gross
    return grossAmount;
  };

  // Aggregate expenses by account with proration
  bills?.forEach((bill) => {
    const prorationFactor = calculateProrationFactor(bill);
    const items = billItemsByBill.get(bill.id);
    const vendorName = (bill.vendors as any)?.name || `Vendor ${bill.vendor_id}`;
    const billHasVat = (bill as any).has_vat;
    const billVatRate = (bill as any).vat_rate;
    const billVatAmount = (bill as any).vat_amount;

    if (items && items.length > 0) {
      // Use line item accounts
      items.forEach((item) => {
        let accountId = item.account_id;
        if (!accountId) {
          // Fall back to bill-level account, then vendor default
          accountId =
            bill.account_id ||
            (bill.vendors as any)?.default_account_id ||
            defaultExpenseAccountId;
        }
        if (accountId) {
          const current = accountAmounts.get(accountId) || 0;
          const currentNet = accountNetAmounts.get(accountId) || 0;
          // item.total_price is NET amount (before VAT)
          const netPrice = item.total_price || 0;

          // Calculate VAT amount for this item
          // Priority: 1) item.vat_amount, 2) calculate from item.vat_rate, 3) proportional from bill-level VAT
          const itemVatRate = item.vat_rate ?? billVatRate;
          let itemVatAmount: number | null = null;

          if (item.vat_amount !== null && item.vat_amount !== undefined) {
            // Item has explicit VAT amount
            itemVatAmount = item.vat_amount;
          } else if (item.vat_rate !== null && item.vat_rate !== undefined && item.vat_rate > 0) {
            // Item has VAT rate but no amount - calculate from rate
            itemVatAmount = (netPrice * item.vat_rate) / 100;
          } else if (billVatAmount !== null && billVatAmount !== undefined && bill.total_amount) {
            // Fall back to proportional bill-level VAT
            itemVatAmount = (billVatAmount / bill.total_amount) * netPrice;
          }

          // Gross amount = net + VAT
          const grossPrice = netPrice + (itemVatAmount || 0);

          const proratedGrossAmount = grossPrice * prorationFactor;
          const proratedNetAmount = netPrice * prorationFactor;

          accountAmounts.set(accountId, current + proratedGrossAmount);
          accountNetAmounts.set(accountId, currentNet + proratedNetAmount);

          // Track source detail by vendor
          addSourceDetail(
            accountId,
            `vendor-${bill.vendor_id}`,
            vendorName,
            proratedGrossAmount,
            proratedNetAmount,
            "vendor"
          );
        }
      });
    } else {
      // No line items, use bill total with vendor default account
      const accountId =
        bill.account_id ||
        (bill.vendors as any)?.default_account_id || defaultExpenseAccountId;
      if (accountId) {
        const current = accountAmounts.get(accountId) || 0;
        const currentNet = accountNetAmounts.get(accountId) || 0;
        // bill.total_amount is NET amount (before VAT)
        const netBillAmount = bill.total_amount || 0;
        // Gross amount = net + VAT
        const grossBillAmount = netBillAmount + (billVatAmount || 0);

        const proratedGrossAmount = grossBillAmount * prorationFactor;
        const proratedNetAmount = netBillAmount * prorationFactor;

        accountAmounts.set(accountId, current + proratedGrossAmount);
        accountNetAmounts.set(accountId, currentNet + proratedNetAmount);

        // Track source detail by vendor
        addSourceDetail(
          accountId,
          `vendor-${bill.vendor_id}`,
          vendorName,
          proratedGrossAmount,
          proratedNetAmount,
          "vendor"
        );
      }
    }
  });

  // ========== LABOR COSTS ==========
  // Default personnel account (use first level-3 account under Personnel Costs - code starts with 31)
  const defaultPersonnelAccount = accounts.find(
    (a) => a.code.startsWith("31") && a.level === 3
  );
  const defaultPersonnelAccountId = defaultPersonnelAccount?.id;

  // Find labor costs that OVERLAP with the P&L period (not just contained within)
  // Overlap condition: period_start <= dateTo AND period_end >= dateFrom
  let laborQuery = supabase
    .from("labor_costs")
    .select("id, amount, account_id, period_start, period_end, description, cost_type")
    .lte("period_start", dateTo)
    .gte("period_end", dateFrom);

  if (locationId) {
    laborQuery = laborQuery.eq("location_id", locationId);
  }

  const { data: laborCosts } = await laborQuery;

  // Aggregate labor costs by account with proration
  // Labor costs are VAT-exempt, so netAmount = grossAmount
  laborCosts?.forEach((labor) => {
    const accountId = labor.account_id || defaultPersonnelAccountId;
    if (accountId) {
      // Parse labor period dates
      const laborStart = new Date(labor.period_start);
      const laborEnd = new Date(labor.period_end);

      // Calculate overlap period
      const overlapStart = laborStart > plStart ? laborStart : plStart;
      const overlapEnd = laborEnd < plEnd ? laborEnd : plEnd;

      // Calculate days
      const laborDays =
        Math.round((laborEnd.getTime() - laborStart.getTime()) / msPerDay) + 1;
      const overlapDays =
        Math.round((overlapEnd.getTime() - overlapStart.getTime()) / msPerDay) +
        1;

      // Prorate the amount based on overlap
      const fullAmount = Number(labor.amount) || 0;
      const proratedAmount =
        laborDays > 0 ? (fullAmount * overlapDays) / laborDays : 0;

      const current = accountAmounts.get(accountId) || 0;
      const currentNet = accountNetAmounts.get(accountId) || 0;
      accountAmounts.set(accountId, current + proratedAmount);
      // Labor is VAT-exempt, so net = gross
      accountNetAmounts.set(accountId, currentNet + proratedAmount);

      // Track source detail by labor entry
      const laborName = labor.description || labor.cost_type || `Labor cost ${labor.id}`;
      addSourceDetail(
        accountId,
        `labor-${labor.id}`,
        laborName,
        proratedAmount,
        proratedAmount, // VAT-exempt: net = gross
        "labor"
      );
    }
  });

  // ========== BUILD P&L STRUCTURE ==========

  // Helper to build tree for a section
  const buildSection = (
    accountType: string
  ): { items: PLLineItem[]; total: number; netTotal: number } => {
    const sectionAccounts = accounts.filter(
      (a) => a.account_type === accountType
    );

    // Build tree
    const level1Accounts = sectionAccounts.filter((a) => a.level === 1);

    const buildTree = (
      parentId: number | null,
      level: number
    ): PLLineItem[] => {
      const children = sectionAccounts.filter(
        (a) => a.parent_id === parentId && a.level === level
      );

      return children.map((account) => {
        const childItems = buildTree(account.id, level + 1);

        // Calculate amount: sum of children or direct amount for leaf nodes
        let amount = 0;
        let netAmount = 0;
        let sourceDetails: PLSourceDetail[] | undefined;

        if (childItems.length > 0) {
          amount = childItems.reduce((sum, c) => sum + c.amount, 0);
          netAmount = childItems.reduce((sum, c) => sum + c.netAmount, 0);
        } else {
          amount = accountAmounts.get(account.id) || 0;
          netAmount = accountNetAmounts.get(account.id) || 0;
          // Get source details for leaf nodes
          const details = accountSourceDetails.get(account.id);
          if (details && details.size > 0) {
            sourceDetails = Array.from(details.values())
              .filter((d) => d.amount !== 0)
              .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)); // Sort by amount descending
          }
        }

        return {
          accountId: account.id,
          code: account.code,
          name: account.name,
          nameBg: account.name_bg,
          level: account.level,
          amount,
          netAmount,
          children: childItems.length > 0 ? childItems : undefined,
          sourceDetails,
        };
      });
    };

    // Flatten: Show level 2 accounts directly under the section header
    // (since section header already represents the level 1 concept like "Revenue" or "COGS")
    const items: PLLineItem[] = [];
    level1Accounts.forEach((level1Account) => {
      const level2Items = buildTree(level1Account.id, 2);
      items.push(...level2Items);
    });

    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const netTotal = items.reduce((sum, item) => sum + item.netAmount, 0);

    return { items, total, netTotal };
  };

  const revenue = buildSection("revenue");
  const cogs = buildSection("cogs");
  const labor = buildSection("labor");
  const operatingExpenses = buildSection("operating_expense");
  const nonOperating = buildSection("non_operating");

  const grossProfit = revenue.total - cogs.total;
  const netGrossProfit = revenue.netTotal - cogs.netTotal;
  const operatingIncome = grossProfit - labor.total - operatingExpenses.total;
  const netOperatingIncome = netGrossProfit - labor.netTotal - operatingExpenses.netTotal;
  const netIncome = operatingIncome - nonOperating.total;
  const netNetIncome = netOperatingIncome - nonOperating.netTotal;

  return {
    data: {
      revenue: {
        id: "revenue",
        name: "Revenue",
        nameBg: "Приходи",
        items: revenue.items,
        total: revenue.total,
        netTotal: revenue.netTotal,
      },
      totalDiscounts,
      excludedSales,
      cogs: {
        id: "cogs",
        name: "Cost of Goods Sold",
        nameBg: "Себестойност на продадените стоки",
        items: cogs.items,
        total: cogs.total,
        netTotal: cogs.netTotal,
      },
      grossProfit,
      netGrossProfit,
      labor: {
        id: "labor",
        name: "Labor Costs",
        nameBg: "Разходи за труд",
        items: labor.items,
        total: labor.total,
        netTotal: labor.netTotal,
      },
      operatingExpenses: {
        id: "operating_expense",
        name: "Operating Expenses",
        nameBg: "Оперативни разходи",
        items: operatingExpenses.items,
        total: operatingExpenses.total,
        netTotal: operatingExpenses.netTotal,
      },
      operatingIncome,
      netOperatingIncome,
      nonOperating: {
        id: "non_operating",
        name: "Non-Operating Items",
        nameBg: "Неоперативни позиции",
        items: nonOperating.items,
        total: nonOperating.total,
        netTotal: nonOperating.netTotal,
      },
      netIncome,
      netNetIncome,
      dateFrom,
      dateTo,
      locationId: locationId || null,
      locationName,
    },
  };
};

/**
 * Get available locations for P&L filter
 */
export const getPLLocations = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return { error: error.message };
  }

  return { data };
};
