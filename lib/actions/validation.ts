"use server";

import { createClient } from "@/lib/supabase/server";

// Fiscal cutoff time is 6:45 AM
const FISCAL_CUTOFF_HOUR = 6;
const FISCAL_CUTOFF_MINUTE = 45;

// VAT rate
const VAT_RATE = 0.2;

export interface ArticleSalesRow {
  articleId: number;
  articleName: string;
  quantity: number;
  totalSales: number;
  netSales: number;
  discountAmount: number;
  costOfSales: number;
  netCostOfSales: number;
}

export interface CategorySalesRow {
  categoryId: number | null;
  categoryName: string;
  revenueAccountCode: string | null;
  revenueAccountName: string | null;
  orderCount: number;
  totalSales: number;
  netSales: number;
  discountAmount: number;
  costOfSales: number;
  netCostOfSales: number;
  articles: ArticleSalesRow[];
}

export interface ValidationData {
  date: string;
  locationId: string;
  locationName: string;
  categories: CategorySalesRow[];
  totalSales: number;
  netTotalSales: number;
  totalDiscounts: number;
  totalCostOfSales: number;
  netTotalCostOfSales: number;
  totalTips: number;
  netTotalTips: number;
  totalWaste: number;
  netTotalWaste: number;
  salesWithNoPayment: number;
  netSalesWithNoPayment: number;
  salesWithNoPaymentCount: number;
}

export type PaymentMethodFilter = "all" | "cash" | "card" | "wallet" | "bank_transfer" | "no_payment";

export interface ValidationFilters {
  date: string;
  locationId: string;
  excludeVat?: boolean;
  excludeTipsWaste?: boolean;
  excludeNoPayment?: boolean;
  useFiscalDate?: boolean;
  paymentMethodFilter?: PaymentMethodFilter;
}

const removeVat = (amount: number): number => {
  return amount / (1 + VAT_RATE);
};

/**
 * Get validation data - sales by category for a specific date and location
 */
export const getValidationData = async (
  filters: ValidationFilters
): Promise<{ data?: ValidationData; error?: string }> => {
  const supabase = await createClient();
  const {
    date,
    locationId,
    useFiscalDate = true,
    paymentMethodFilter = "all",
  } = filters;

  // Get location info
  const { data: location, error: locationError } = await supabase
    .from("barsy_locations")
    .select("id, name")
    .eq("id", locationId)
    .single();

  if (locationError || !location) {
    return { error: "Location not found" };
  }

  // Calculate date range based on fiscal date setting
  let startDateTime: string;
  let endDateTime: string;

  if (useFiscalDate) {
    // Fiscal date: from 6:45 AM on selected date to 6:44:59 AM next day
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split("T")[0];

    startDateTime = `${date} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE}:00`;
    endDateTime = `${nextDateStr} 0${FISCAL_CUTOFF_HOUR}:${FISCAL_CUTOFF_MINUTE - 1}:59`;
  } else {
    startDateTime = `${date} 00:00:00`;
    endDateTime = `${date} 23:59:59`;
  }

  // Get all accounts for the date range to check payment methods
  const { data: accounts, error: accountsError } = await supabase
    .from("barsy_accounts")
    .select("barsy_account_id, total_amount, raw_data")
    .eq("location_id", locationId)
    .not("close_date", "is", null)
    .gte("close_date", startDateTime)
    .lte("close_date", endDateTime);

  if (accountsError) {
    return { error: accountsError.message };
  }

  // Helper to check if payment method matches filter
  const matchesPaymentFilter = (paymentName: string | null): boolean => {
    if (paymentMethodFilter === "all") return true;
    if (paymentMethodFilter === "no_payment") return !paymentName;
    if (!paymentName) return false;

    const lowerPayment = paymentName.toLowerCase();
    switch (paymentMethodFilter) {
      case "cash":
        return lowerPayment.includes("брой") || lowerPayment.includes("cash");
      case "card":
        return lowerPayment.includes("карта") || lowerPayment.includes("card");
      case "wallet":
        return lowerPayment.includes("изход") || lowerPayment.includes("wallet") || lowerPayment.includes("house");
      case "bank_transfer":
        return lowerPayment.includes("банков") || lowerPayment.includes("превод") || lowerPayment.includes("bank");
      default:
        return true;
    }
  };

  // Build maps for payment method and accounts with no payment
  const accountPaymentMap = new Map<number, string | null>();
  const noPaymentAccountIds = new Set<number>();
  const filteredAccountIds = new Set<number>();

  accounts?.forEach((acc) => {
    const paymentName = acc.raw_data?.payment_name || acc.raw_data?.paymethod_name || null;
    accountPaymentMap.set(acc.barsy_account_id, paymentName);
    if (!paymentName) {
      noPaymentAccountIds.add(acc.barsy_account_id);
    }
    // Track which accounts match the payment filter
    if (matchesPaymentFilter(paymentName)) {
      filteredAccountIds.add(acc.barsy_account_id);
    }
  });

  // Get all orders for the date range
  const { data: orders, error: ordersError } = await supabase
    .from("barsy_orders")
    .select(`
      id,
      barsy_article_id,
      article_name,
      actual_price,
      amount,
      raw_data,
      location_id
    `)
    .eq("location_id", locationId)
    .gte("order_date", startDateTime)
    .lte("order_date", endDateTime);

  if (ordersError) {
    return { error: ordersError.message };
  }

  // Get all articles with their categories
  const { data: articles } = await supabase
    .from("barsy_articles")
    .select("barsy_article_id, article_name, category_id")
    .eq("location_id", locationId);

  const articleCategoryMap = new Map<number, number | null>();
  articles?.forEach((a) => {
    articleCategoryMap.set(a.barsy_article_id, a.category_id);
  });

  // Get all categories for the location
  const { data: categories } = await supabase
    .from("barsy_categories")
    .select("barsy_cat_id, cat_name")
    .eq("location_id", locationId);

  const categoryNameMap = new Map<number, string>();
  categories?.forEach((c) => {
    categoryNameMap.set(c.barsy_cat_id, c.cat_name);
  });

  // Get category to revenue account mappings
  const { data: categoryAccountMappings } = await supabase
    .from("barsy_category_account_mapping")
    .select(`
      barsy_category_id,
      chart_of_accounts!barsy_category_account_mapping_revenue_account_id_fkey (
        code,
        name
      )
    `)
    .eq("barsy_location_id", locationId);

  const categoryAccountMap = new Map<number, { code: string; name: string }>();
  categoryAccountMappings?.forEach((m: any) => {
    if (m.chart_of_accounts) {
      categoryAccountMap.set(m.barsy_category_id, {
        code: m.chart_of_accounts.code,
        name: m.chart_of_accounts.name,
      });
    }
  });

  // Get article cost prices (avg_delivery_price from barsy_articles)
  const articleCostMap = new Map<number, number>();
  articles?.forEach((a: any) => {
    if (a.avg_delivery_price) {
      articleCostMap.set(a.barsy_article_id, a.avg_delivery_price);
    }
  });

  // Also get avg_delivery_price for articles
  const { data: articlesWithCost } = await supabase
    .from("barsy_articles")
    .select("barsy_article_id, avg_delivery_price")
    .eq("location_id", locationId);

  articlesWithCost?.forEach((a) => {
    if (a.avg_delivery_price) {
      articleCostMap.set(a.barsy_article_id, Number(a.avg_delivery_price));
    }
  });

  // Process orders and aggregate by category and article
  interface ArticleAggregate {
    articleId: number;
    articleName: string;
    quantity: number;
    totalSales: number;
    discountAmount: number;
    costOfSales: number;
  }

  interface CategoryAggregate {
    orderCount: number;
    totalSales: number;
    discountAmount: number;
    costOfSales: number;
    articles: Map<number, ArticleAggregate>;
  }

  const categoryAggregates = new Map<number | null, CategoryAggregate>();

  let totalTips = 0;
  let totalWaste = 0;
  let salesWithNoPayment = 0;
  let salesWithNoPaymentCount = 0;
  let totalDiscounts = 0;

  // Helper to check if article is tips or waste
  const isTipsOrWaste = (articleName: string): "tips" | "waste" | null => {
    const lowerName = articleName.toLowerCase();
    if (
      lowerName.includes("бакшиш") ||
      lowerName.includes("tip") ||
      lowerName.includes("типс")
    ) {
      return "tips";
    }
    if (
      lowerName.includes("брак") ||
      lowerName.includes("waste") ||
      lowerName.includes("brak")
    ) {
      return "waste";
    }
    return null;
  };

  // Helper to check if category is tips or waste
  const isCategoryTipsOrWaste = (categoryName: string): "tips" | "waste" | null => {
    const lowerName = categoryName.toLowerCase();
    if (
      lowerName.includes("бакшиш") ||
      lowerName.includes("tip") ||
      lowerName.includes("типс")
    ) {
      return "tips";
    }
    if (
      lowerName.includes("брак") ||
      lowerName.includes("waste") ||
      lowerName.includes("brak")
    ) {
      return "waste";
    }
    return null;
  };

  orders?.forEach((order) => {
    if (order.amount <= 0) return; // Skip voided/negative orders

    const accountId = order.raw_data?.account_id;
    const saleAmount = order.amount * order.actual_price;
    const discount = order.raw_data?.discount
      ? Math.abs(saleAmount * (order.raw_data.discount / 100))
      : 0;

    // Track no-payment sales (before filtering)
    if (accountId && noPaymentAccountIds.has(accountId)) {
      salesWithNoPayment += saleAmount;
      salesWithNoPaymentCount++;
    }

    // Skip orders that don't match payment filter
    if (accountId && !filteredAccountIds.has(accountId)) {
      return;
    }

    // Check if tips or waste by article name
    const tipsWasteType = isTipsOrWaste(order.article_name || "");
    if (tipsWasteType === "tips") {
      totalTips += saleAmount;
      return; // Don't add to category aggregates
    }
    if (tipsWasteType === "waste") {
      totalWaste += saleAmount;
      return; // Don't add to category aggregates
    }

    // Get category
    const categoryId = articleCategoryMap.get(order.barsy_article_id) ?? null;
    const categoryName = categoryId ? categoryNameMap.get(categoryId) : null;

    // Check if category itself is tips or waste
    if (categoryName) {
      const catTipsWaste = isCategoryTipsOrWaste(categoryName);
      if (catTipsWaste === "tips") {
        totalTips += saleAmount;
        return;
      }
      if (catTipsWaste === "waste") {
        totalWaste += saleAmount;
        return;
      }
    }

    // Add to category aggregates
    const existing = categoryAggregates.get(categoryId) || {
      orderCount: 0,
      totalSales: 0,
      discountAmount: 0,
      costOfSales: 0,
      articles: new Map<number, ArticleAggregate>(),
    };

    // Calculate cost of sales for this order
    const unitCost = articleCostMap.get(order.barsy_article_id) || 0;
    const orderCost = order.amount * unitCost;

    existing.orderCount++;
    existing.totalSales += saleAmount;
    existing.discountAmount += discount;
    existing.costOfSales += orderCost;
    totalDiscounts += discount;

    // Track article-level data
    const articleId = order.barsy_article_id;
    const existingArticle = existing.articles.get(articleId) || {
      articleId,
      articleName: order.article_name || "Unknown Article",
      quantity: 0,
      totalSales: 0,
      discountAmount: 0,
      costOfSales: 0,
    };

    existingArticle.quantity += order.amount;
    existingArticle.totalSales += saleAmount;
    existingArticle.discountAmount += discount;
    existingArticle.costOfSales += orderCost;
    existing.articles.set(articleId, existingArticle);

    categoryAggregates.set(categoryId, existing);
  });

  // Build category rows with nested articles
  const categoryRows: CategorySalesRow[] = Array.from(categoryAggregates.entries())
    .map(([categoryId, data]) => {
      // Build article rows sorted by sales descending
      const articleRows: ArticleSalesRow[] = Array.from(data.articles.values())
        .map((article) => ({
          articleId: article.articleId,
          articleName: article.articleName,
          quantity: article.quantity,
          totalSales: article.totalSales,
          netSales: removeVat(article.totalSales),
          discountAmount: article.discountAmount,
          costOfSales: article.costOfSales,
          netCostOfSales: removeVat(article.costOfSales),
        }))
        .sort((a, b) => b.totalSales - a.totalSales);

      const accountInfo = categoryId ? categoryAccountMap.get(categoryId) : null;

      return {
        categoryId,
        categoryName: categoryId
          ? categoryNameMap.get(categoryId) || "Unknown"
          : "Uncategorized",
        revenueAccountCode: accountInfo?.code || null,
        revenueAccountName: accountInfo?.name || null,
        orderCount: data.orderCount,
        totalSales: data.totalSales,
        netSales: removeVat(data.totalSales),
        discountAmount: data.discountAmount,
        costOfSales: data.costOfSales,
        netCostOfSales: removeVat(data.costOfSales),
        articles: articleRows,
      };
    })
    .sort((a, b) => b.totalSales - a.totalSales);

  // Calculate totals
  const totalSales = categoryRows.reduce((sum, r) => sum + r.totalSales, 0);
  const netTotalSales = removeVat(totalSales);
  const totalCostOfSales = categoryRows.reduce((sum, r) => sum + r.costOfSales, 0);
  const netTotalCostOfSales = removeVat(totalCostOfSales);

  return {
    data: {
      date,
      locationId,
      locationName: location.name,
      categories: categoryRows,
      totalSales,
      netTotalSales,
      totalDiscounts,
      totalCostOfSales,
      netTotalCostOfSales,
      totalTips,
      netTotalTips: removeVat(totalTips),
      totalWaste,
      netTotalWaste: removeVat(totalWaste),
      salesWithNoPayment,
      netSalesWithNoPayment: removeVat(salesWithNoPayment),
      salesWithNoPaymentCount,
    },
  };
};

/**
 * Get all Barsy locations for the validation dropdown
 */
export const getValidationLocations = async (): Promise<{
  data?: Array<{ id: string; name: string }>;
  error?: string;
}> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("barsy_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return { error: error.message };
  }

  return { data: data || [] };
};
