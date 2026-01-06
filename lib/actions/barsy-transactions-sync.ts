"use server";

/**
 * Barsy Transactions Sync - SIMPLIFIED
 * Directly transform barsy_orders to Memento transactions (no intermediate tables needed)
 */

import { createClient } from "@/lib/supabase/server";
import { getBusinessDate } from "@/lib/utils/business-date";

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

/**
 * Transform barsy_orders directly to Memento transactions
 * Groups orders by date and creates transactions with line items
 */
export async function syncBarsyTransactions(
  barsyLocationId: string,
  mementoLocationId: number,
  dateFrom: string,
  dateTo: string
): Promise<SyncResult> {
  try {
    const supabase = await createClient();

    console.log(
      `Transforming barsy_orders to transactions for ${dateFrom} to ${dateTo}`
    );

    // Get all barsy_orders for the date range that haven't been synced yet
    const { data: orders, error: ordersError } = await supabase
      .from("barsy_orders")
      .select("*")
      .eq("location_id", barsyLocationId)
      .gte("order_date", dateFrom)
      .lte("order_date", dateTo)
      .order("order_date", { ascending: true });

    if (ordersError) {
      return { success: false, error: ordersError.message };
    }

    if (!orders || orders.length === 0) {
      return { success: true, recordsSynced: 0 };
    }

    console.log(`Found ${orders.length} orders to process`);

    // OPTIMIZATION: Batch fetch all products by barsy_article_id upfront
    const uniqueArticleIds = [
      ...new Set(orders.map((o: any) => o.barsy_article_id)),
    ];
    const productMap = new Map<number, number>(); // barsy_article_id -> product_id
    const costPriceMap = new Map<number, number>(); // barsy_article_id -> avg_delivery_price
    const missingArticles = new Set<string>(); // Track missing articles to log once

    if (uniqueArticleIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, barsy_article_id")
        .in("barsy_article_id", uniqueArticleIds);

      if (products) {
        for (const product of products) {
          productMap.set(product.barsy_article_id, product.id);
        }
      }

      // Fetch cost prices from barsy_articles
      const { data: articles } = await supabase
        .from("barsy_articles")
        .select("barsy_article_id, avg_delivery_price")
        .eq("location_id", barsyLocationId)
        .in("barsy_article_id", uniqueArticleIds);

      if (articles) {
        for (const article of articles) {
          if (article.avg_delivery_price) {
            costPriceMap.set(article.barsy_article_id, article.avg_delivery_price);
          }
        }
      }

      // Identify missing articles (log once instead of per-order)
      for (const order of orders) {
        if (!productMap.has(order.barsy_article_id)) {
          missingArticles.add(
            `${order.barsy_article_id} (${order.article_name})`
          );
        }
      }
    }

    if (missingArticles.size > 0) {
      console.warn(
        `⚠️ No products found for ${missingArticles.size} unique barsy_article_ids:`,
        [...missingArticles].slice(0, 10).join(", "),
        missingArticles.size > 10
          ? `... and ${missingArticles.size - 10} more`
          : ""
      );
    }

    console.log(`📦 Found cost prices for ${costPriceMap.size} articles`);

    // Group orders by date to create daily transactions
    const ordersByDate = orders.reduce((acc: any, order: any) => {
      const date = order.order_date.split("T")[0]; // Get just the date part
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(order);
      return acc;
    }, {});

    let transactionsCreated = 0;

    // OPTIMIZATION: Pre-fetch all recipes for this location
    const { data: allRecipes } = await supabase
      .from("barsy_recipes")
      .select("*")
      .eq("location_id", barsyLocationId);

    const recipesByArticle = new Map<number, any[]>();
    if (allRecipes) {
      for (const recipe of allRecipes) {
        const articleId = recipe.barsy_article_id;
        if (!recipesByArticle.has(articleId)) {
          recipesByArticle.set(articleId, []);
        }
        recipesByArticle.get(articleId)!.push(recipe);
      }
    }

    // OPTIMIZATION: Pre-fetch all store amounts for this location
    const { data: allStoreAmounts } = await supabase
      .from("barsy_store_amounts")
      .select("barsy_article_id, quantity")
      .eq("location_id", barsyLocationId);

    const storeAmountsMap = new Map<number, number>();
    if (allStoreAmounts) {
      for (const amount of allStoreAmounts) {
        storeAmountsMap.set(amount.barsy_article_id, amount.quantity);
      }
    }

    // Create one transaction per day
    for (const [date, dayOrders] of Object.entries(ordersByDate)) {
      const ordersArray = dayOrders as any[];

      // Calculate total
      const totalAmount = ordersArray.reduce((sum, order) => {
        return sum + (order.amount || 1) * (order.actual_price || 0);
      }, 0);

      // Get business date
      const orderDate = new Date(date);
      const businessDate = getBusinessDate(orderDate);

      // Create transaction
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          location_id: mementoLocationId,
          business_date: businessDate,
          actual_timestamp: orderDate.toISOString(),
          transaction_number: `BARSY-${date}`,
          total_amount: totalAmount,
          payment_method: "cash", // Default, can be updated later
          is_comp: false,
        })
        .select()
        .single();

      if (txError) {
        console.error(`Failed to create transaction for ${date}:`, txError);
        continue;
      }

      // Create line items using pre-fetched product and cost maps (no DB calls in loop)
      const lineItems = ordersArray.map((order) => ({
        transaction_id: transaction.id,
        product_id: productMap.get(order.barsy_article_id) || null,
        barsy_article_id: order.barsy_article_id,
        article_name: order.article_name,
        quantity: order.amount || 1,
        unit_price: order.actual_price || 0,
        total_price: (order.amount || 1) * (order.actual_price || 0),
        cost_price: costPriceMap.get(order.barsy_article_id) || null,
      }));

      // Insert line items
      if (lineItems.length > 0) {
        const { error: lineItemsError } = await supabase
          .from("transaction_line_items")
          .insert(lineItems);

        if (lineItemsError) {
          console.error(
            `Failed to create line items for ${date}:`,
            lineItemsError
          );
        } else {
          transactionsCreated++;

          // Process inventory depletion using pre-fetched data
          await processInventoryDepletionOptimized(
            supabase,
            barsyLocationId,
            ordersArray,
            orderDate,
            recipesByArticle,
            storeAmountsMap
          );
        }
      }
    }

    console.log(
      `✅ Created ${transactionsCreated} transactions from barsy_orders`
    );

    return { success: true, recordsSynced: transactionsCreated };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process inventory depletion based on recipes when items are sold
 * OPTIMIZED: Uses pre-fetched recipe and store amount data
 */
async function processInventoryDepletionOptimized(
  supabase: any,
  locationId: string,
  orders: any[],
  orderDate: Date,
  recipesByArticle: Map<number, any[]>,
  storeAmountsMap: Map<number, number>
) {
  try {
    const depletionRecords: any[] = [];
    const storeAmountUpdates = new Map<number, number>(); // barsy_article_id -> new quantity

    for (const order of orders) {
      const barsyArticleId = order.barsy_article_id;
      const quantitySold = order.amount || 1;

      // Get recipe from pre-fetched map (no DB call)
      const recipes = recipesByArticle.get(barsyArticleId);
      if (!recipes || recipes.length === 0) {
        // No recipe found, skip depletion
        continue;
      }

      // For each ingredient in the recipe, calculate depletion
      for (const recipe of recipes) {
        const ingredientArticleId = recipe.barsy_ingredient_article_id;
        const quantityPerUnit = recipe.quantity;
        const totalDepletion = quantitySold * quantityPerUnit;

        // Get current stock from map (or from accumulated updates)
        const currentQuantity = storeAmountUpdates.has(ingredientArticleId)
          ? storeAmountUpdates.get(ingredientArticleId)!
          : storeAmountsMap.get(ingredientArticleId);

        if (currentQuantity !== undefined && currentQuantity !== null) {
          const newQuantity = Math.max(0, currentQuantity - totalDepletion);
          storeAmountUpdates.set(ingredientArticleId, newQuantity);
        }

        // Log the depletion
        depletionRecords.push({
          location_id: locationId,
          barsy_order_id: parseInt(order.barsy_order_id) || 0,
          barsy_article_id: barsyArticleId,
          barsy_ingredient_article_id: ingredientArticleId,
          quantity_sold: quantitySold,
          quantity_depleted: totalDepletion,
          unit: recipe.unit,
          order_date: orderDate.toISOString(),
        });
      }
    }

    // Batch update store amounts
    if (storeAmountUpdates.size > 0) {
      const updatePromises = Array.from(storeAmountUpdates.entries()).map(
        ([articleId, newQuantity]) =>
          supabase
            .from("barsy_store_amounts")
            .update({
              quantity: newQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq("location_id", locationId)
            .eq("barsy_article_id", articleId)
      );

      await Promise.all(updatePromises);

      // Update the map for subsequent days
      for (const [articleId, newQuantity] of storeAmountUpdates) {
        storeAmountsMap.set(articleId, newQuantity);
      }
    }

    // Batch insert depletion log records
    if (depletionRecords.length > 0) {
      const { error: logError } = await supabase
        .from("barsy_inventory_depletion_log")
        .insert(depletionRecords);

      if (logError) {
        console.error("Failed to log inventory depletion:", logError);
      } else {
        console.log(
          `📦 Depleted ${depletionRecords.length} ingredient records`
        );
      }
    }
  } catch (error) {
    console.error("Error processing inventory depletion:", error);
  }
}
