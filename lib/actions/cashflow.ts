 "use server";

import { createClient } from "@/lib/supabase/server";

export interface CashflowAccountLineItem {
  accountId: number;
  code: string;
  name: string;
  nameBg: string | null;
  level: number;
  amount: number;
  netAmount: number;
  children?: CashflowAccountLineItem[];
  sourceDetails?: CashflowSourceDetail[];
}

export interface CashflowSourceDetail {
  id: string;
  name: string;
  amount: number;
  netAmount: number;
  type: "article" | "vendor" | "labor" | "unallocated";
}

export interface CashflowAccountSection {
  id: string;
  name: string;
  nameBg: string;
  items: CashflowAccountLineItem[];
  total: number;
  netTotal: number;
}

export interface CashflowData {
  revenue: CashflowAccountSection;
  cogs: CashflowAccountSection;
  labor: CashflowAccountSection;
  operatingExpenses: CashflowAccountSection;
  nonOperating: CashflowAccountSection;
  netCashFlow: number;
  netNetCashFlow: number;
  openingBalance: number;
  closingBalance: number;
  netChange: number;
  dateFrom: string;
  dateTo: string;
  locationId: string | null;
  locationName: string | null;
}

export interface CashflowFilters {
  dateFrom: string;
  dateTo: string;
  locationId?: string;
}

/**
 * Get Cash Flow Statement data
 *
 * Cash Flow Statement Structure:
 * - Operating Activities
 *   - Cash Received from Customers (Revenue/Sales)
 *   - Cash Paid to Suppliers (Bill Payments)
 *   - Cash Paid to Employees (Labor Costs)
 * - Internal Transfers (net zero impact)
 */
export const getCashflowData = async (filters: CashflowFilters): Promise<{ data?: CashflowData; error?: string }> => {
  const supabase = await createClient();
  const { dateFrom, dateTo, locationId } = filters;

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

  // Get all chart of accounts
  const { data: accounts, error: accountsError } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .eq("is_active", true)
    .order("code");

  if (accountsError) {
    return { error: accountsError.message };
  }

  // Initialize amounts per Chart of Accounts (cash-basis movements) - both gross and net
  const accountAmounts = new Map<number, number>();
  const accountNetAmounts = new Map<number, number>();
  accounts.forEach((a) => {
    accountAmounts.set(a.id, 0);
    accountNetAmounts.set(a.id, 0);
  });

  // Track source details for each account (articles, vendors, labor, etc.)
  const accountSourceDetails = new Map<number, Map<string, CashflowSourceDetail>>();
  accounts.forEach((a) => accountSourceDetails.set(a.id, new Map()));

  const addSourceDetail = (
    accountId: number,
    detailId: string,
    name: string,
    amount: number,
    netAmount: number,
    type: CashflowSourceDetail["type"]
  ) => {
    const details = accountSourceDetails.get(accountId);
    if (!details) return;

    const existing = details.get(detailId);
    if (existing) {
      existing.amount += amount;
      existing.netAmount += netAmount;
      return;
    }

    details.set(detailId, { id: detailId, name, amount, netAmount, type });
  };

  // Default accounts (fallbacks)
  const defaultRevenueAccount = accounts.find(
    (a) => a.account_type === "revenue" && a.level === 3
  );
  const defaultRevenueAccountId = defaultRevenueAccount?.id;

  const defaultExpenseAccount = accounts.find(
    (a) => a.account_type === "operating_expense" && a.level === 3
  );
  const defaultExpenseAccountId = defaultExpenseAccount?.id;

  const defaultPersonnelAccount = accounts.find(
    (a) => a.code?.startsWith("31") && a.level === 3
  );
  const defaultPersonnelAccountId = defaultPersonnelAccount?.id;

  // ========== CASH INFLOWS (BY ACCOUNT): Barsy sales mapped to revenue accounts ==========
  // Category mappings
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

  // Article mappings (overrides)
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

  // Articles for category, name, and tax rate
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

  // Helper: tips detection by name
  const isTipsArticle = (articleName: string): boolean => {
    const name = articleName.toLowerCase();
    return (
      name.includes("типс") || name.includes("бакшиш") || name.includes("tip")
    );
  };

  // Category classification map (granular)
  const { data: barsyCategories } = await supabase
    .from("barsy_categories")
    .select("location_id, barsy_cat_id, cat_name, cat_path");

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
      catName.includes("аперативни коктейл")
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

  // Map memento location -> barsy location id
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

  // Get accounts with payment methods (to exclude "no payment" sales)
  let barsyAccountsQuery = supabase
    .from("barsy_accounts")
    .select("location_id, barsy_account_id, raw_data")
    .gte("close_date", dateFrom)
    .lte("close_date", dateTo + " 23:59:59");

  if (barsyLocationId) {
    barsyAccountsQuery = barsyAccountsQuery.eq("location_id", barsyLocationId);
  }

  // If location was requested but has no barsy integration, skip accounts query
  const { data: accountsWithPayments } = locationHasNoBarsyIntegration
    ? { data: [] }
    : await barsyAccountsQuery;

  const validAccountIds = new Set<string>();
  accountsWithPayments?.forEach((acc) => {
    const paymentName = acc.raw_data?.payment_name;
    const paymethodName = acc.raw_data?.paymethod_name;
    if (paymentName || paymethodName) {
      validAccountIds.add(`${acc.location_id}-${acc.barsy_account_id}`);
    }
  });

  // Get sales data
  let salesQuery = supabase
    .from("barsy_orders")
    .select("location_id, barsy_article_id, actual_price, amount, raw_data")
    .gte("order_date", dateFrom)
    .lte("order_date", dateTo)
    .gt("amount", 0);

  if (barsyLocationId) {
    salesQuery = salesQuery.eq("location_id", barsyLocationId);
  }

  // If location was requested but has no barsy integration, skip sales query
  // This prevents showing all locations' sales for a non-barsy location (e.g., HQ)
  const { data: allSales } = locationHasNoBarsyIntegration
    ? { data: [] }
    : await salesQuery;

  const sales = allSales?.filter((sale) => {
    const accountId = sale.raw_data?.account_id;
    if (!accountId) return false;
    return validAccountIds.has(`${sale.location_id}-${accountId}`);
  });

  // Aggregate sales by revenue account
  sales?.forEach((sale) => {
    const articleKey = `${sale.location_id}-${sale.barsy_article_id}`;

    const categoryId = articleCategoryMap.get(articleKey);
    const classification = categoryId
      ? categoryClassificationMap.get(`${sale.location_id}-${categoryId}`)
      : undefined;

    const articleName = articleNameMap.get(articleKey) || "";
    if (classification === "tips" || isTipsArticle(articleName)) {
      return;
    }

    let accountId = articleAccountMap.get(articleKey);

    if (!accountId && categoryId) {
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

    if (!accountId) {
      // Use uncategorized account if article has no category, otherwise use default
      accountId = uncategorizedRevenueAccount?.id || defaultRevenueAccountId;
    }

    if (!accountId) return;

    const quantity = parseFloat(String(sale.amount)) || 0;
    const unitPrice = parseFloat(String(sale.actual_price)) || 0;
    const lineTotal = quantity * unitPrice;

    // Calculate net amount based on article tax rate
    // If tax is null/missing, show gross (don't try to exclude VAT)
    const taxRate = articleTaxMap.get(articleKey);
    const lineNetTotal = taxRate !== null && taxRate !== undefined
      ? lineTotal / (1 + taxRate / 100)
      : lineTotal;

    const current = accountAmounts.get(accountId) || 0;
    const currentNet = accountNetAmounts.get(accountId) || 0;
    accountAmounts.set(accountId, current + lineTotal);
    accountNetAmounts.set(accountId, currentNet + lineNetTotal);

    addSourceDetail(
      accountId,
      `article-${sale.barsy_article_id}`,
      articleName || `Article ${sale.barsy_article_id}`,
      lineTotal,
      lineNetTotal,
      "article"
    );
  });

  // ========== CASH OUTFLOWS (BY ACCOUNT): Bill payments allocated by applied bill account ==========
  let paymentsQuery = supabase
    .from("bill_payments")
    .select("id, payment_date, total_amount, location_id")
    .gte("payment_date", dateFrom)
    .lte("payment_date", dateTo);

  if (locationId) {
    paymentsQuery = paymentsQuery.eq("location_id", locationId);
  }

  const { data: payments, error: paymentsError } = await paymentsQuery;
  if (paymentsError) {
    return { error: paymentsError.message };
  }

  const paymentIds = (payments || []).map((p) => p.id);

  const paymentTotalsById = new Map<number, number>();
  (payments || []).forEach((p) => {
    paymentTotalsById.set(p.id, Number(p.total_amount || 0));
  });

  const paymentAppliedById = new Map<number, number>();

  if (paymentIds.length > 0) {
    const { data: applications } = await supabase
      .from("bill_payment_applications")
      .select(
        `
        payment_id,
        amount_applied,
        bills!bill_payment_applications_new_bill_id_fkey (
          vendor_id,
          account_id,
          total_amount,
          has_vat,
          vat_rate,
          vat_amount,
          vendors!bills_vendor_id_fkey (default_account_id, name)
        )
      `
      )
      .in("payment_id", paymentIds);

    applications?.forEach((app: any) => {
      const paymentId: number | undefined = app.payment_id ?? undefined;
      if (!paymentId) return;

      const amountApplied = Number(app.amount_applied || 0);
      const billAccountId =
        app.bills?.account_id ??
        app.bills?.vendors?.default_account_id ??
        defaultExpenseAccountId ??
        null;

      paymentAppliedById.set(
        paymentId,
        (paymentAppliedById.get(paymentId) || 0) + amountApplied
      );

      if (!billAccountId) return;

      // Calculate net amount based on bill VAT data
      const billHasVat = app.bills?.has_vat;
      const billVatRate = app.bills?.vat_rate;
      const billVatAmount = app.bills?.vat_amount;
      const billTotal = app.bills?.total_amount || 0;

      let netAmountApplied = amountApplied;
      if (billHasVat && billTotal > 0) {
        // Calculate the proportion of VAT for this payment
        if (billVatAmount !== null && billVatAmount > 0) {
          const vatProportion = billVatAmount / billTotal;
          netAmountApplied = amountApplied * (1 - vatProportion);
        } else if (billVatRate !== null && billVatRate > 0) {
          netAmountApplied = amountApplied / (1 + billVatRate / 100);
        }
      }

      const current = accountAmounts.get(billAccountId) || 0;
      const currentNet = accountNetAmounts.get(billAccountId) || 0;
      accountAmounts.set(billAccountId, current - amountApplied);
      accountNetAmounts.set(billAccountId, currentNet - netAmountApplied);

      const vendorId: number | null = app.bills?.vendor_id ?? null;
      const vendorName: string | null = app.bills?.vendors?.name ?? null;
      addSourceDetail(
        billAccountId,
        vendorId ? `vendor-${vendorId}` : "vendor-unknown",
        vendorName || (vendorId ? `Vendor ${vendorId}` : "Vendor"),
        -amountApplied,
        -netAmountApplied,
        "vendor"
      );
    });
  }

  // Allocate any remainder / uncategorized payments to default expense account
  // For unallocated payments, we don't have VAT data, so net = gross
  if (defaultExpenseAccountId) {
    paymentIds.forEach((paymentId) => {
      const total = paymentTotalsById.get(paymentId) || 0;
      const applied = paymentAppliedById.get(paymentId) || 0;
      const remainder = total - applied;
      if (remainder <= 0) return;

      const current = accountAmounts.get(defaultExpenseAccountId) || 0;
      const currentNet = accountNetAmounts.get(defaultExpenseAccountId) || 0;
      accountAmounts.set(defaultExpenseAccountId, current - remainder);
      // No VAT data for unallocated, so net = gross
      accountNetAmounts.set(defaultExpenseAccountId, currentNet - remainder);

      addSourceDetail(
        defaultExpenseAccountId,
        "unallocated-bill-payments",
        "Unallocated bill payments",
        -remainder,
        -remainder, // No VAT data, net = gross
        "unallocated"
      );
    });
  }

  // ========== CASH OUTFLOWS (BY ACCOUNT): Salary payments allocated by labor cost account ==========
  let salaryPaymentsQuery = supabase
    .from("salary_payments")
    .select("id, payment_date, total_amount, location_id")
    .gte("payment_date", dateFrom)
    .lte("payment_date", dateTo);

  if (locationId) {
    salaryPaymentsQuery = salaryPaymentsQuery.eq("location_id", locationId);
  }

  const { data: salaryPayments, error: salaryPaymentsError } = await salaryPaymentsQuery;
  if (salaryPaymentsError) {
    return { error: salaryPaymentsError.message };
  }

  const salaryPaymentIds = (salaryPayments || []).map((p) => p.id);

  const salaryPaymentTotalsById = new Map<number, number>();
  (salaryPayments || []).forEach((p) => {
    salaryPaymentTotalsById.set(p.id, Number(p.total_amount || 0));
  });

  const salaryPaymentAppliedById = new Map<number, number>();

  if (salaryPaymentIds.length > 0) {
    const { data: salaryApplications } = await supabase
      .from("salary_payment_applications")
      .select(
        `
        payment_id,
        amount_applied,
        labor_costs!salary_payment_applications_labor_cost_id_fkey (
          id,
          account_id,
          description,
          cost_type
        )
      `
      )
      .in("payment_id", salaryPaymentIds);

    // Labor costs are VAT-exempt, so net = gross
    salaryApplications?.forEach((app: any) => {
      const paymentId: number | undefined = app.payment_id ?? undefined;
      if (!paymentId) return;

      const amountApplied = Number(app.amount_applied || 0);
      const laborAccountId =
        app.labor_costs?.account_id ?? defaultPersonnelAccountId ?? null;

      salaryPaymentAppliedById.set(
        paymentId,
        (salaryPaymentAppliedById.get(paymentId) || 0) + amountApplied
      );

      if (!laborAccountId) return;

      const current = accountAmounts.get(laborAccountId) || 0;
      const currentNet = accountNetAmounts.get(laborAccountId) || 0;
      accountAmounts.set(laborAccountId, current - amountApplied);
      // Labor is VAT-exempt, so net = gross
      accountNetAmounts.set(laborAccountId, currentNet - amountApplied);

      const laborId: number | null = app.labor_costs?.id ?? null;
      const laborName: string =
        app.labor_costs?.description ??
        app.labor_costs?.cost_type ??
        (laborId ? `Labor cost ${laborId}` : "Labor cost");

      addSourceDetail(
        laborAccountId,
        laborId ? `labor-${laborId}` : "labor-unknown",
        laborName,
        -amountApplied,
        -amountApplied, // VAT-exempt: net = gross
        "labor"
      );
    });
  }

  // Allocate any remainder / uncategorized salary payments to default personnel account
  // Labor is VAT-exempt, so net = gross
  if (defaultPersonnelAccountId) {
    salaryPaymentIds.forEach((paymentId) => {
      const total = salaryPaymentTotalsById.get(paymentId) || 0;
      const applied = salaryPaymentAppliedById.get(paymentId) || 0;
      const remainder = total - applied;
      if (remainder <= 0) return;

      const current = accountAmounts.get(defaultPersonnelAccountId) || 0;
      const currentNet = accountNetAmounts.get(defaultPersonnelAccountId) || 0;
      accountAmounts.set(defaultPersonnelAccountId, current - remainder);
      // Labor is VAT-exempt, so net = gross
      accountNetAmounts.set(defaultPersonnelAccountId, currentNet - remainder);

      addSourceDetail(
        defaultPersonnelAccountId,
        "unallocated-salary-payments",
        "Unallocated salary payments",
        -remainder,
        -remainder, // VAT-exempt: net = gross
        "unallocated"
      );
    });
  }

  // ========== CALCULATE BANK BALANCES ==========
  let accountsQuery = supabase
    .from("bank_accounts")
    .select("id, opening_balance, opening_date, location_id")
    .eq("is_active", true);

  if (locationId) {
    accountsQuery = accountsQuery.eq("location_id", locationId);
  }

  const { data: bankAccounts } = await accountsQuery;

  const openingBalance = (bankAccounts || []).reduce((sum, acc) => {
    const openingDate = acc.opening_date ? new Date(acc.opening_date) : null;
    const periodStart = new Date(dateFrom);

    if (!openingDate || openingDate <= periodStart) {
      return sum + Number(acc.opening_balance || 0);
    }

    return sum;
  }, 0);

  // ========== BUILD CASH FLOW STRUCTURE (BY ACCOUNT) ==========
  const buildSection = (
    accountTypes: string[],
    amounts: ReadonlyMap<number, number>,
    netAmounts: ReadonlyMap<number, number>
  ) => {
    const sectionAccounts = accounts.filter((a) =>
      accountTypes.includes(a.account_type)
    );

    const level1Accounts = sectionAccounts.filter((a) => a.level === 1);

    const buildTree = (
      parentId: number | null,
      level: number
    ): CashflowAccountLineItem[] => {
      const children = sectionAccounts.filter(
        (a) => a.parent_id === parentId && a.level === level
      );

      return children.map((account) => {
        const childItems = buildTree(account.id, level + 1);

        let amount = 0;
        let netAmount = 0;
        let sourceDetails: CashflowSourceDetail[] | undefined;
        if (childItems.length > 0) {
          amount = childItems.reduce((sum, c) => sum + c.amount, 0);
          netAmount = childItems.reduce((sum, c) => sum + c.netAmount, 0);
        } else {
          amount = amounts.get(account.id) || 0;
          netAmount = netAmounts.get(account.id) || 0;

          const details = accountSourceDetails.get(account.id);
          if (details && details.size > 0) {
            sourceDetails = Array.from(details.values())
              .filter((d) => d.amount !== 0)
              .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
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
        } satisfies CashflowAccountLineItem;
      });
    };

    // Flatten: Section header already represents the level 1 concept (e.g. "Revenue"),
    // so show level 2 accounts directly to avoid "Revenue under Revenue" nesting.
    const items: CashflowAccountLineItem[] = [];
    level1Accounts.forEach((level1Account) => {
      items.push(...buildTree(level1Account.id, 2));
    });

    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const netTotal = items.reduce((sum, item) => sum + item.netAmount, 0);
    return { items, total, netTotal };
  };

  const revenue = buildSection(["revenue"], accountAmounts, accountNetAmounts);
  const cogs = buildSection(["cogs"], accountAmounts, accountNetAmounts);
  const labor = buildSection(["labor"], accountAmounts, accountNetAmounts);
  const operatingExpenses = buildSection(["operating_expense"], accountAmounts, accountNetAmounts);
  const nonOperating = buildSection(["non_operating"], accountAmounts, accountNetAmounts);

  const netCashFlow =
    revenue.total + cogs.total + labor.total + operatingExpenses.total + nonOperating.total;
  const netNetCashFlow =
    revenue.netTotal + cogs.netTotal + labor.netTotal + operatingExpenses.netTotal + nonOperating.netTotal;

  const closingBalance = openingBalance + netCashFlow;

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
      cogs: {
        id: "cogs",
        name: "Cost of Goods Sold",
        nameBg: "Себестойност на продадените стоки",
        items: cogs.items,
        total: cogs.total,
        netTotal: cogs.netTotal,
      },
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
      nonOperating: {
        id: "non_operating",
        name: "Non-Operating Items",
        nameBg: "Неоперативни позиции",
        items: nonOperating.items,
        total: nonOperating.total,
        netTotal: nonOperating.netTotal,
      },
      netCashFlow,
      netNetCashFlow,
      openingBalance,
      closingBalance,
      netChange: netCashFlow,
      dateFrom,
      dateTo,
      locationId: locationId || null,
      locationName,
    },
  };
}

/**
 * Get available locations for Cash Flow filter
 */
export const getCashflowLocations = async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) {
    return { error: error.message }
  }

  return { data }
}

/**
 * Helper function to get cost type label
 */
// Intentionally no additional helpers here; cashflow is aggregated by Chart of Accounts.
