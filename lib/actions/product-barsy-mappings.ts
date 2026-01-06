"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================================
// Types
// ============================================================================

export interface ProductWithBarsyMappings {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  selling_price: number | null;
  is_active: boolean;
  category_name: string | null;
  linked_articles_count: number;
  linked_articles: Array<{
    barsy_location_id: string;
    barsy_article_id: number;
    article_name: string;
    location_name: string;
  }>;
}

export interface RawMaterialWithBarsyMappings {
  id: number;
  name: string;
  unit_of_measure: string;
  reorder_level: number | null;
  linked_articles_count: number;
  linked_articles: Array<{
    barsy_location_id: string;
    barsy_article_id: number;
    article_name: string;
    location_name: string;
  }>;
}

export interface BarsyArticleForLinking {
  id: string;
  location_id: string;
  barsy_article_id: number;
  article_name: string;
  price: number | null;
  is_for_sale: boolean;
  is_active: boolean;
  has_recipe: boolean;
  location_name: string;
  // Linked product info (if any)
  linked_product_id: number | null;
  linked_product_name: string | null;
  // Linked raw material info (if any)
  linked_raw_material_id: number | null;
  linked_raw_material_name: string | null;
}

export interface RecipeIngredient {
  barsy_article_id: number;
  barsy_ingredient_article_id: number;
  ingredient_name: string;
  quantity: number;
  unit: string | null;
  location_id: string;
  location_name: string;
  // Mapped raw material (if any)
  raw_material_id: number | null;
  raw_material_name: string | null;
}

export interface ProductRecipe {
  product_id: number;
  product_name: string;
  linked_articles: Array<{
    barsy_location_id: string;
    barsy_article_id: number;
    article_name: string;
    location_name: string;
  }>;
  ingredients: RecipeIngredient[];
}

// ============================================================================
// Product Linking Functions
// ============================================================================

/**
 * Get all products with their linked Barsy article counts and details
 */
export const getProductsWithBarsyMappings = async () => {
  const supabase = await createClient();

  // Get all products with their categories
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      sku,
      description,
      selling_price,
      is_active,
      product_categories (name)
    `
    )
    .order("name");

  if (productsError) {
    return { error: productsError.message };
  }

  if (!products || products.length === 0) {
    return { data: [] };
  }

  // Get all product-barsy mappings
  const { data: mappings } = await supabase.from(
    "product_barsy_article_mappings"
  ).select(`
      product_id,
      barsy_location_id,
      barsy_article_id
    `);

  // Get barsy article names and locations
  const { data: barsyArticles } = await supabase.from("barsy_articles").select(`
      location_id,
      barsy_article_id,
      article_name,
      barsy_locations (name)
    `);

  // Build lookup maps
  const articleMap = new Map<
    string,
    { article_name: string; location_name: string }
  >();
  barsyArticles?.forEach((a: any) => {
    const key = `${a.location_id}-${a.barsy_article_id}`;
    articleMap.set(key, {
      article_name: a.article_name,
      location_name: a.barsy_locations?.name || "Unknown",
    });
  });

  // Group mappings by product
  const productMappings = new Map<
    number,
    Array<{
      barsy_location_id: string;
      barsy_article_id: number;
      article_name: string;
      location_name: string;
    }>
  >();

  mappings?.forEach((m: any) => {
    const key = `${m.barsy_location_id}-${m.barsy_article_id}`;
    const articleInfo = articleMap.get(key);

    if (!productMappings.has(m.product_id)) {
      productMappings.set(m.product_id, []);
    }

    productMappings.get(m.product_id)!.push({
      barsy_location_id: m.barsy_location_id,
      barsy_article_id: m.barsy_article_id,
      article_name: articleInfo?.article_name || "Unknown",
      location_name: articleInfo?.location_name || "Unknown",
    });
  });

  // Merge products with their mappings
  const result: ProductWithBarsyMappings[] = products.map((p: any) => {
    const linkedArticles = productMappings.get(p.id) || [];
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      selling_price: p.selling_price,
      is_active: p.is_active,
      category_name: p.product_categories?.name || null,
      linked_articles_count: linkedArticles.length,
      linked_articles: linkedArticles,
    };
  });

  return { data: result };
};

/**
 * Get Barsy articles available for linking to products
 * Filters to show only for_sale articles by default
 */
export const getBarsyArticlesForProductLinking = async (options?: {
  locationId?: string;
  search?: string;
  linkedStatus?: "all" | "linked" | "unlinked";
  page?: number;
  pageSize?: number;
}) => {
  const supabase = await createClient();
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const search = options?.search?.trim();
  const locationId = options?.locationId;
  const linkedStatus = options?.linkedStatus || "all";

  // Build query for Barsy articles
  let query = supabase
    .from("barsy_articles")
    .select(
      `
      id,
      location_id,
      barsy_article_id,
      article_name,
      price,
      is_for_sale,
      is_active,
      barsy_locations!inner (name)
    `
    )
    .eq("is_for_sale", true)
    .order("article_name");

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  if (search) {
    query = query.ilike("article_name", `%${search}%`);
  }

  // Get total count
  let countQuery = supabase
    .from("barsy_articles")
    .select("*", { count: "exact", head: true })
    .eq("is_for_sale", true);

  if (locationId) {
    countQuery = countQuery.eq("location_id", locationId);
  }
  if (search) {
    countQuery = countQuery.ilike("article_name", `%${search}%`);
  }

  const { count } = await countQuery;

  // Paginate
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: articles, error } = await query.range(from, to);

  if (error) {
    return { error: error.message };
  }

  if (!articles || articles.length === 0) {
    return { data: [], total: 0 };
  }

  // Get existing product mappings
  const { data: productMappings } = await supabase.from(
    "product_barsy_article_mappings"
  ).select(`
      barsy_location_id,
      barsy_article_id,
      product_id,
      products (name)
    `);

  // Build mapping lookup
  const productMappingMap = new Map<
    string,
    { product_id: number; product_name: string }
  >();
  productMappings?.forEach((m: any) => {
    const key = `${m.barsy_location_id}-${m.barsy_article_id}`;
    productMappingMap.set(key, {
      product_id: m.product_id,
      product_name: m.products?.name || "Unknown",
    });
  });

  // Transform result
  let result: BarsyArticleForLinking[] = articles.map((a: any) => {
    const key = `${a.location_id}-${a.barsy_article_id}`;
    const productMapping = productMappingMap.get(key);

    return {
      id: a.id,
      location_id: a.location_id,
      barsy_article_id: a.barsy_article_id,
      article_name: a.article_name,
      price: a.price,
      is_for_sale: a.is_for_sale,
      is_active: a.is_active,
      has_recipe: a.has_recipe || false,
      location_name: a.barsy_locations?.name || "Unknown",
      linked_product_id: productMapping?.product_id || null,
      linked_product_name: productMapping?.product_name || null,
      linked_raw_material_id: null,
      linked_raw_material_name: null,
    };
  });

  // Filter by linked status
  if (linkedStatus === "linked") {
    result = result.filter((r) => r.linked_product_id !== null);
  } else if (linkedStatus === "unlinked") {
    result = result.filter((r) => r.linked_product_id === null);
  }

  return { data: result, total: count || 0 };
};

/**
 * Link Barsy articles to a product
 */
export const linkBarsyArticlesToProduct = async (
  productId: number,
  articles: Array<{ locationId: string; articleId: number }>
) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const insertData = articles.map((a) => ({
    product_id: productId,
    barsy_location_id: a.locationId,
    barsy_article_id: a.articleId,
    created_by: user?.id || null,
  }));

  const { error } = await supabase
    .from("product_barsy_article_mappings")
    .upsert(insertData, {
      onConflict: "barsy_location_id,barsy_article_id",
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true };
};

/**
 * Unlink a Barsy article from a product
 */
export const unlinkBarsyArticleFromProduct = async (
  locationId: string,
  articleId: number
) => {
  const supabase = await createClient();

  const { error } = await supabase
    .from("product_barsy_article_mappings")
    .delete()
    .eq("barsy_location_id", locationId)
    .eq("barsy_article_id", articleId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true };
};

/**
 * Create a new product from a Barsy article
 */
export const createProductFromBarsyArticle = async (
  locationId: string,
  articleId: number,
  overrides?: {
    name?: string;
    sku?: string;
    categoryId?: number;
    sellingPrice?: number;
  }
) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get the Barsy article
  const { data: article, error: articleError } = await supabase
    .from("barsy_articles")
    .select("*")
    .eq("location_id", locationId)
    .eq("barsy_article_id", articleId)
    .single();

  if (articleError || !article) {
    return { error: "Barsy article not found" };
  }

  // Create the product
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name: overrides?.name || article.article_name,
      sku: overrides?.sku || null,
      category_id: overrides?.categoryId || null,
      selling_price: overrides?.sellingPrice || article.price,
      is_active: true,
      created_by: user?.id || null,
      updated_by: user?.id || null,
    })
    .select()
    .single();

  if (productError) {
    return { error: productError.message };
  }

  // Link the Barsy article to the new product
  const { error: linkError } = await supabase
    .from("product_barsy_article_mappings")
    .insert({
      product_id: product.id,
      barsy_location_id: locationId,
      barsy_article_id: articleId,
      created_by: user?.id || null,
    });

  if (linkError) {
    // Rollback: delete the product
    await supabase.from("products").delete().eq("id", product.id);
    return { error: linkError.message };
  }

  revalidatePath("/admin/products");
  return { success: true, data: product };
};

/**
 * Get a single product with all its details and linked Barsy articles
 */
export const getProductWithDetails = async (productId: number) => {
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      sku,
      description,
      selling_price,
      is_active,
      product_categories (id, name)
    `
    )
    .eq("id", productId)
    .single();

  if (error) {
    return { error: error.message };
  }

  // Get linked Barsy articles
  const { data: mappings } = await supabase
    .from("product_barsy_article_mappings")
    .select(
      `
      barsy_location_id,
      barsy_article_id
    `
    )
    .eq("product_id", productId);

  if (!mappings || mappings.length === 0) {
    const categoryData = product.product_categories as unknown as {
      id: number;
      name: string;
    } | null;
    return {
      data: {
        ...product,
        category_name: categoryData?.name || null,
        linked_articles: [],
      },
    };
  }

  // Get article details
  const articleKeys = mappings.map((m: any) => ({
    location_id: m.barsy_location_id,
    barsy_article_id: m.barsy_article_id,
  }));

  const { data: articles } = await supabase.from("barsy_articles").select(`
      location_id,
      barsy_article_id,
      article_name,
      price,
      barsy_locations (name)
    `);

  const linkedArticles = mappings.map((m: any) => {
    const article = articles?.find(
      (a: any) =>
        a.location_id === m.barsy_location_id &&
        a.barsy_article_id === m.barsy_article_id
    ) as any;
    const locationData = article?.barsy_locations as { name: string } | null;
    return {
      barsy_location_id: m.barsy_location_id,
      barsy_article_id: m.barsy_article_id,
      article_name: article?.article_name || "Unknown",
      price: article?.price || null,
      location_name: locationData?.name || "Unknown",
    };
  });

  const categoryData = product.product_categories as unknown as {
    id: number;
    name: string;
  } | null;
  return {
    data: {
      ...product,
      category_name: categoryData?.name || null,
      linked_articles: linkedArticles,
    },
  };
};

// ============================================================================
// Raw Material Linking Functions
// ============================================================================

/**
 * Get all raw materials with their linked Barsy article counts and details
 */
export const getRawMaterialsWithBarsyMappings = async () => {
  const supabase = await createClient();

  // Get all raw materials
  const { data: materials, error: materialsError } = await supabase
    .from("raw_materials")
    .select("*")
    .order("name");

  if (materialsError) {
    return { error: materialsError.message };
  }

  if (!materials || materials.length === 0) {
    return { data: [] };
  }

  // Get all raw material-barsy mappings
  const { data: mappings } = await supabase.from(
    "raw_material_barsy_article_mappings"
  ).select(`
      raw_material_id,
      barsy_location_id,
      barsy_article_id
    `);

  // Get barsy article names and locations
  const { data: barsyArticles } = await supabase.from("barsy_articles").select(`
      location_id,
      barsy_article_id,
      article_name,
      barsy_locations (name)
    `);

  // Build lookup maps
  const articleMap = new Map<
    string,
    { article_name: string; location_name: string }
  >();
  barsyArticles?.forEach((a: any) => {
    const key = `${a.location_id}-${a.barsy_article_id}`;
    articleMap.set(key, {
      article_name: a.article_name,
      location_name: a.barsy_locations?.name || "Unknown",
    });
  });

  // Group mappings by raw material
  const materialMappings = new Map<
    number,
    Array<{
      barsy_location_id: string;
      barsy_article_id: number;
      article_name: string;
      location_name: string;
    }>
  >();

  mappings?.forEach((m: any) => {
    const key = `${m.barsy_location_id}-${m.barsy_article_id}`;
    const articleInfo = articleMap.get(key);

    if (!materialMappings.has(m.raw_material_id)) {
      materialMappings.set(m.raw_material_id, []);
    }

    materialMappings.get(m.raw_material_id)!.push({
      barsy_location_id: m.barsy_location_id,
      barsy_article_id: m.barsy_article_id,
      article_name: articleInfo?.article_name || "Unknown",
      location_name: articleInfo?.location_name || "Unknown",
    });
  });

  // Merge materials with their mappings
  const result: RawMaterialWithBarsyMappings[] = materials.map((m: any) => {
    const linkedArticles = materialMappings.get(m.id) || [];
    return {
      id: m.id,
      name: m.name,
      unit_of_measure: m.unit_of_measure,
      reorder_level: m.reorder_level,
      linked_articles_count: linkedArticles.length,
      linked_articles: linkedArticles,
    };
  });

  return { data: result };
};

/**
 * Get Barsy articles available for linking to raw materials
 * Shows articles that appear as ingredients in recipes
 */
export const getBarsyArticlesForMaterialLinking = async (options?: {
  locationId?: string;
  search?: string;
  linkedStatus?: "all" | "linked" | "unlinked";
  page?: number;
  pageSize?: number;
}) => {
  const supabase = await createClient();
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const search = options?.search?.trim();
  const locationId = options?.locationId;
  const linkedStatus = options?.linkedStatus || "all";

  // Build query for Barsy articles (all articles, not just for_sale)
  let query = supabase
    .from("barsy_articles")
    .select(
      `
      id,
      location_id,
      barsy_article_id,
      article_name,
      price,
      is_for_sale,
      is_active,
      barsy_locations!inner (name)
    `
    )
    .order("article_name");

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  if (search) {
    query = query.ilike("article_name", `%${search}%`);
  }

  // Get total count
  let countQuery = supabase
    .from("barsy_articles")
    .select("*", { count: "exact", head: true });

  if (locationId) {
    countQuery = countQuery.eq("location_id", locationId);
  }
  if (search) {
    countQuery = countQuery.ilike("article_name", `%${search}%`);
  }

  const { count } = await countQuery;

  // Paginate
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: articles, error } = await query.range(from, to);

  if (error) {
    return { error: error.message };
  }

  if (!articles || articles.length === 0) {
    return { data: [], total: 0 };
  }

  // Get existing raw material mappings
  const { data: materialMappings } = await supabase.from(
    "raw_material_barsy_article_mappings"
  ).select(`
      barsy_location_id,
      barsy_article_id,
      raw_material_id,
      raw_materials (name)
    `);

  // Build mapping lookup
  const materialMappingMap = new Map<
    string,
    { raw_material_id: number; raw_material_name: string }
  >();
  materialMappings?.forEach((m: any) => {
    const key = `${m.barsy_location_id}-${m.barsy_article_id}`;
    materialMappingMap.set(key, {
      raw_material_id: m.raw_material_id,
      raw_material_name: m.raw_materials?.name || "Unknown",
    });
  });

  // Transform result
  let result: BarsyArticleForLinking[] = articles.map((a: any) => {
    const key = `${a.location_id}-${a.barsy_article_id}`;
    const materialMapping = materialMappingMap.get(key);

    return {
      id: a.id,
      location_id: a.location_id,
      barsy_article_id: a.barsy_article_id,
      article_name: a.article_name,
      price: a.price,
      is_for_sale: a.is_for_sale,
      is_active: a.is_active,
      has_recipe: a.has_recipe || false,
      location_name: a.barsy_locations?.name || "Unknown",
      linked_product_id: null,
      linked_product_name: null,
      linked_raw_material_id: materialMapping?.raw_material_id || null,
      linked_raw_material_name: materialMapping?.raw_material_name || null,
    };
  });

  // Filter by linked status
  if (linkedStatus === "linked") {
    result = result.filter((r) => r.linked_raw_material_id !== null);
  } else if (linkedStatus === "unlinked") {
    result = result.filter((r) => r.linked_raw_material_id === null);
  }

  return { data: result, total: count || 0 };
};

/**
 * Link Barsy articles to a raw material
 */
export const linkBarsyArticlesToRawMaterial = async (
  rawMaterialId: number,
  articles: Array<{ locationId: string; articleId: number }>
) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const insertData = articles.map((a) => ({
    raw_material_id: rawMaterialId,
    barsy_location_id: a.locationId,
    barsy_article_id: a.articleId,
    created_by: user?.id || null,
  }));

  const { error } = await supabase
    .from("raw_material_barsy_article_mappings")
    .upsert(insertData, {
      onConflict: "barsy_location_id,barsy_article_id",
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true };
};

/**
 * Unlink a Barsy article from a raw material
 */
export const unlinkBarsyArticleFromRawMaterial = async (
  locationId: string,
  articleId: number
) => {
  const supabase = await createClient();

  const { error } = await supabase
    .from("raw_material_barsy_article_mappings")
    .delete()
    .eq("barsy_location_id", locationId)
    .eq("barsy_article_id", articleId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true };
};

/**
 * Create a new raw material from a Barsy article
 */
export const createRawMaterialFromBarsyArticle = async (
  locationId: string,
  articleId: number,
  overrides?: {
    name?: string;
    unitOfMeasure?: string;
    reorderLevel?: number;
  }
) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get the Barsy article
  const { data: article, error: articleError } = await supabase
    .from("barsy_articles")
    .select("*")
    .eq("location_id", locationId)
    .eq("barsy_article_id", articleId)
    .single();

  if (articleError || !article) {
    return { error: "Barsy article not found" };
  }

  // Create the raw material
  const { data: material, error: materialError } = await supabase
    .from("raw_materials")
    .insert({
      name: overrides?.name || article.article_name,
      unit_of_measure: overrides?.unitOfMeasure || "unit",
      reorder_level: overrides?.reorderLevel || null,
      created_by: user?.id || null,
      updated_by: user?.id || null,
    })
    .select()
    .single();

  if (materialError) {
    return { error: materialError.message };
  }

  // Link the Barsy article to the new raw material
  const { error: linkError } = await supabase
    .from("raw_material_barsy_article_mappings")
    .insert({
      raw_material_id: material.id,
      barsy_location_id: locationId,
      barsy_article_id: articleId,
      created_by: user?.id || null,
    });

  if (linkError) {
    // Rollback: delete the raw material
    await supabase.from("raw_materials").delete().eq("id", material.id);
    return { error: linkError.message };
  }

  revalidatePath("/admin/products");
  return { success: true, data: material };
};

/**
 * Get a single raw material with all its details and linked Barsy articles
 */
export const getRawMaterialWithDetails = async (rawMaterialId: number) => {
  const supabase = await createClient();

  const { data: material, error } = await supabase
    .from("raw_materials")
    .select("*")
    .eq("id", rawMaterialId)
    .single();

  if (error) {
    return { error: error.message };
  }

  // Get linked Barsy articles
  const { data: mappings } = await supabase
    .from("raw_material_barsy_article_mappings")
    .select(
      `
      barsy_location_id,
      barsy_article_id
    `
    )
    .eq("raw_material_id", rawMaterialId);

  if (!mappings || mappings.length === 0) {
    return {
      data: {
        ...material,
        linked_articles: [],
      },
    };
  }

  // Get article details
  const { data: articles } = await supabase.from("barsy_articles").select(`
      location_id,
      barsy_article_id,
      article_name,
      price,
      barsy_locations (name)
    `);

  const linkedArticles = mappings.map((m: any) => {
    const article = articles?.find(
      (a: any) =>
        a.location_id === m.barsy_location_id &&
        a.barsy_article_id === m.barsy_article_id
    ) as any;
    const locationData = article?.barsy_locations as { name: string } | null;
    return {
      barsy_location_id: m.barsy_location_id,
      barsy_article_id: m.barsy_article_id,
      article_name: article?.article_name || "Unknown",
      price: article?.price || null,
      location_name: locationData?.name || "Unknown",
    };
  });

  return {
    data: {
      ...material,
      linked_articles: linkedArticles,
    },
  };
};

// ============================================================================
// Recipe Functions
// ============================================================================

/**
 * Get recipes for a product's linked Barsy articles, with ingredients mapped to Raw Materials
 */
export const getProductRecipes = async (
  productId: number
): Promise<{ data?: ProductRecipe; error?: string }> => {
  const supabase = await createClient();

  // Get product details
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    return { error: "Product not found" };
  }

  // Get linked Barsy articles
  const { data: mappings } = await supabase
    .from("product_barsy_article_mappings")
    .select(
      `
      barsy_location_id,
      barsy_article_id
    `
    )
    .eq("product_id", productId);

  if (!mappings || mappings.length === 0) {
    return {
      data: {
        product_id: product.id,
        product_name: product.name,
        linked_articles: [],
        ingredients: [],
      },
    };
  }

  // Get article details
  const { data: barsyArticles } = await supabase.from("barsy_articles").select(`
      location_id,
      barsy_article_id,
      article_name,
      barsy_locations (name)
    `);

  const linkedArticles = mappings.map((m: any) => {
    const article = barsyArticles?.find(
      (a: any) =>
        a.location_id === m.barsy_location_id &&
        a.barsy_article_id === m.barsy_article_id
    ) as any;
    const locationData = article?.barsy_locations as { name: string } | null;
    return {
      barsy_location_id: m.barsy_location_id,
      barsy_article_id: m.barsy_article_id,
      article_name: article?.article_name || "Unknown",
      location_name: locationData?.name || "Unknown",
    };
  });

  // Get recipes for all linked articles
  const articleIds = mappings.map((m: any) => m.barsy_article_id);
  const locationIds = [
    ...new Set(mappings.map((m: any) => m.barsy_location_id)),
  ];

  const { data: recipes } = await supabase
    .from("barsy_recipes")
    .select(
      `
      barsy_article_id,
      barsy_ingredient_article_id,
      ingredient_name,
      quantity,
      unit,
      location_id,
      barsy_locations (name)
    `
    )
    .in("location_id", locationIds)
    .in("barsy_article_id", articleIds);

  if (!recipes || recipes.length === 0) {
    return {
      data: {
        product_id: product.id,
        product_name: product.name,
        linked_articles: linkedArticles,
        ingredients: [],
      },
    };
  }

  // Get raw material mappings for recipe ingredients
  const ingredientArticleIds = [
    ...new Set(recipes.map((r: any) => r.barsy_ingredient_article_id)),
  ];

  const { data: materialMappings } = await supabase
    .from("raw_material_barsy_article_mappings")
    .select(
      `
      barsy_location_id,
      barsy_article_id,
      raw_material_id,
      raw_materials (name)
    `
    )
    .in("barsy_location_id", locationIds)
    .in("barsy_article_id", ingredientArticleIds);

  // Build material mapping lookup
  const materialMap = new Map<
    string,
    { raw_material_id: number; raw_material_name: string }
  >();
  materialMappings?.forEach((m: any) => {
    const key = `${m.barsy_location_id}-${m.barsy_article_id}`;
    materialMap.set(key, {
      raw_material_id: m.raw_material_id,
      raw_material_name: m.raw_materials?.name || "Unknown",
    });
  });

  // Transform recipe ingredients
  const ingredients: RecipeIngredient[] = recipes.map((r: any) => {
    const key = `${r.location_id}-${r.barsy_ingredient_article_id}`;
    const materialMapping = materialMap.get(key);

    return {
      barsy_article_id: r.barsy_article_id,
      barsy_ingredient_article_id: r.barsy_ingredient_article_id,
      ingredient_name: r.ingredient_name,
      quantity: parseFloat(r.quantity) || 0,
      unit: r.unit,
      location_id: r.location_id,
      location_name: r.barsy_locations?.name || "Unknown",
      raw_material_id: materialMapping?.raw_material_id || null,
      raw_material_name: materialMapping?.raw_material_name || null,
    };
  });

  return {
    data: {
      product_id: product.id,
      product_name: product.name,
      linked_articles: linkedArticles,
      ingredients,
    },
  };
};

/**
 * Get all Barsy articles with their product and raw material mappings
 * Used for the unified Barsy Articles tab
 */
export const getAllBarsyArticlesWithMappings = async (options?: {
  locationId?: string;
  search?: string;
  type?: "all" | "for_sale" | "ingredient";
  linkedStatus?: "all" | "linked" | "unlinked";
  recipeFilter?: "all" | "with_recipe" | "no_recipe";
  deletedFilter?: "all" | "active" | "deleted";
  page?: number;
  pageSize?: number;
}) => {
  const supabase = await createClient();
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const search = options?.search?.trim();
  const locationId = options?.locationId;
  const type = options?.type || "all";
  const linkedStatus = options?.linkedStatus || "all";
  const recipeFilter = options?.recipeFilter || "all";
  const deletedFilter = options?.deletedFilter || "all";

  // Build query
  let query = supabase
    .from("barsy_articles")
    .select(
      `
      id,
      location_id,
      barsy_article_id,
      article_name,
      price,
      is_for_sale,
      is_active,
      has_recipe,
      barsy_locations!inner (name)
    `
    )
    .order("article_name");

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  if (search) {
    query = query.ilike("article_name", `%${search}%`);
  }

  if (type === "for_sale") {
    query = query.eq("is_for_sale", true);
  } else if (type === "ingredient") {
    query = query.eq("is_for_sale", false);
  }

  if (recipeFilter === "with_recipe") {
    query = query.eq("has_recipe", true);
  } else if (recipeFilter === "no_recipe") {
    query = query.eq("has_recipe", false);
  }

  if (deletedFilter === "active") {
    query = query.eq("is_active", true);
  } else if (deletedFilter === "deleted") {
    query = query.eq("is_active", false);
  }

  // Count query
  let countQuery = supabase
    .from("barsy_articles")
    .select("*", { count: "exact", head: true });

  if (locationId) {
    countQuery = countQuery.eq("location_id", locationId);
  }
  if (search) {
    countQuery = countQuery.ilike("article_name", `%${search}%`);
  }
  if (type === "for_sale") {
    countQuery = countQuery.eq("is_for_sale", true);
  } else if (type === "ingredient") {
    countQuery = countQuery.eq("is_for_sale", false);
  }

  if (recipeFilter === "with_recipe") {
    countQuery = countQuery.eq("has_recipe", true);
  } else if (recipeFilter === "no_recipe") {
    countQuery = countQuery.eq("has_recipe", false);
  }

  if (deletedFilter === "active") {
    countQuery = countQuery.eq("is_active", true);
  } else if (deletedFilter === "deleted") {
    countQuery = countQuery.eq("is_active", false);
  }

  const { count } = await countQuery;

  // Paginate
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: articles, error } = await query.range(from, to);

  if (error) {
    return { error: error.message };
  }

  if (!articles || articles.length === 0) {
    return { data: [], total: 0 };
  }

  // Get product mappings
  const { data: productMappings } = await supabase.from(
    "product_barsy_article_mappings"
  ).select(`
      barsy_location_id,
      barsy_article_id,
      product_id,
      products (name)
    `);

  // Get raw material mappings
  const { data: materialMappings } = await supabase.from(
    "raw_material_barsy_article_mappings"
  ).select(`
      barsy_location_id,
      barsy_article_id,
      raw_material_id,
      raw_materials (name)
    `);

  // Build lookup maps
  const productMap = new Map<
    string,
    { product_id: number; product_name: string }
  >();
  productMappings?.forEach((m: any) => {
    const key = `${m.barsy_location_id}-${m.barsy_article_id}`;
    productMap.set(key, {
      product_id: m.product_id,
      product_name: m.products?.name || "Unknown",
    });
  });

  const materialMap = new Map<
    string,
    { raw_material_id: number; raw_material_name: string }
  >();
  materialMappings?.forEach((m: any) => {
    const key = `${m.barsy_location_id}-${m.barsy_article_id}`;
    materialMap.set(key, {
      raw_material_id: m.raw_material_id,
      raw_material_name: m.raw_materials?.name || "Unknown",
    });
  });

  // Transform result
  let result: BarsyArticleForLinking[] = articles.map((a: any) => {
    const key = `${a.location_id}-${a.barsy_article_id}`;
    const productMapping = productMap.get(key);
    const materialMapping = materialMap.get(key);

    return {
      id: a.id,
      location_id: a.location_id,
      barsy_article_id: a.barsy_article_id,
      article_name: a.article_name,
      price: a.price,
      is_for_sale: a.is_for_sale,
      is_active: a.is_active,
      has_recipe: a.has_recipe || false,
      location_name: a.barsy_locations?.name || "Unknown",
      linked_product_id: productMapping?.product_id || null,
      linked_product_name: productMapping?.product_name || null,
      linked_raw_material_id: materialMapping?.raw_material_id || null,
      linked_raw_material_name: materialMapping?.raw_material_name || null,
    };
  });

  // Filter by linked status
  if (linkedStatus === "linked") {
    result = result.filter(
      (r) => r.linked_product_id !== null || r.linked_raw_material_id !== null
    );
  } else if (linkedStatus === "unlinked") {
    result = result.filter(
      (r) => r.linked_product_id === null && r.linked_raw_material_id === null
    );
  }

  return { data: result, total: count || 0 };
};

/**
 * Get Barsy locations for filter dropdowns
 */
export const getBarsyLocations = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("barsy_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return { error: error.message };
  }

  return { data };
};

/**
 * Get recipe ingredients for a specific Barsy article
 */
export interface ArticleRecipeIngredient {
  ingredient_name: string;
  quantity: number;
  unit: string | null;
  barsy_ingredient_article_id: number;
  // Mapped raw material info (if any)
  raw_material_id: number | null;
  raw_material_name: string | null;
}

export const getArticleRecipe = async (
  locationId: string,
  articleId: number
): Promise<{ data?: ArticleRecipeIngredient[]; error?: string }> => {
  const supabase = await createClient();

  // Get recipe ingredients
  const { data: recipes, error } = await supabase
    .from("barsy_recipes")
    .select(
      `
      barsy_ingredient_article_id,
      ingredient_name,
      quantity,
      unit
    `
    )
    .eq("location_id", locationId)
    .eq("barsy_article_id", articleId)
    .order("ingredient_name");

  if (error) {
    return { error: error.message };
  }

  if (!recipes || recipes.length === 0) {
    return { data: [] };
  }

  // Get raw material mappings for ingredients
  const ingredientIds = recipes.map((r) => r.barsy_ingredient_article_id);

  const { data: materialMappings } = await supabase
    .from("raw_material_barsy_article_mappings")
    .select(
      `
      barsy_article_id,
      raw_material_id,
      raw_materials (name)
    `
    )
    .eq("barsy_location_id", locationId)
    .in("barsy_article_id", ingredientIds);

  // Build material lookup
  const materialMap = new Map<number, { id: number; name: string }>();
  materialMappings?.forEach((m: any) => {
    materialMap.set(m.barsy_article_id, {
      id: m.raw_material_id,
      name: m.raw_materials?.name || "Unknown",
    });
  });

  // Transform result
  const result: ArticleRecipeIngredient[] = recipes.map((r) => {
    const material = materialMap.get(r.barsy_ingredient_article_id);
    return {
      ingredient_name: r.ingredient_name,
      quantity: parseFloat(String(r.quantity)) || 0,
      unit: r.unit,
      barsy_ingredient_article_id: r.barsy_ingredient_article_id,
      raw_material_id: material?.id || null,
      raw_material_name: material?.name || null,
    };
  });

  return { data: result };
};
