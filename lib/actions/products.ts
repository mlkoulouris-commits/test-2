"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CreateProductData {
  name: string;
  categoryId?: number;
  sku?: string;
  description?: string;
  sellingPrice?: number;
}

export interface CreateRawMaterialData {
  name: string;
  unitOfMeasure: string;
  reorderLevel?: number;
}

export interface CreateCategoryData {
  name: string;
  parentId?: number;
}

export const createProduct = async (data: CreateProductData) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: data.name,
      category_id: data.categoryId,
      sku: data.sku,
      description: data.description,
      selling_price: data.sellingPrice,
      created_by: user?.id || null,
      updated_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true, data: product };
};

export const getAllProducts = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      product_categories (id, name)
    `
    )
    .order("name");

  if (error) {
    return { error: error.message };
  }

  return { data };
};

export const createRawMaterial = async (data: CreateRawMaterialData) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: material, error } = await supabase
    .from("raw_materials")
    .insert({
      name: data.name,
      unit_of_measure: data.unitOfMeasure,
      reorder_level: data.reorderLevel,
      created_by: user?.id || null,
      updated_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true, data: material };
};

export const getAllRawMaterials = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("raw_materials")
    .select("*")
    .order("name");

  if (error) {
    return { error: error.message };
  }

  return { data };
};

export const createProductCategory = async (data: CreateCategoryData) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: category, error } = await supabase
    .from("product_categories")
    .insert({
      name: data.name,
      parent_id: data.parentId,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true, data: category };
};

export const getAllProductCategories = async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .order("name");

  if (error) {
    return { error: error.message };
  }

  return { data };
};

export const toggleProductStatus = async (id: number, isActive: boolean) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("products")
    .update({
      is_active: isActive,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true };
};

export const deleteProduct = async (id: number) => {
  const supabase = await createClient();

  // Check if product has any transaction line items (which would block deletion)
  const { data: lineItems, error: checkError } = await supabase
    .from("transaction_line_items")
    .select("id")
    .eq("product_id", id)
    .limit(1);

  if (checkError) {
    return { error: checkError.message };
  }

  if (lineItems && lineItems.length > 0) {
    return {
      error:
        "Cannot delete product that has been used in transactions. Consider deactivating it instead.",
    };
  }

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }  revalidatePath("/admin/products");
  return { success: true };
};

export const deleteRawMaterial = async (id: number) => {
  const supabase = await createClient();

  // Delete associated Barsy article mappings first
  const { error: mappingsError } = await supabase
    .from("raw_material_barsy_article_mappings")
    .delete()
    .eq("raw_material_id", id);

  if (mappingsError) {
    return { error: mappingsError.message };
  }

  // Delete the raw material
  const { error } = await supabase
    .from("raw_materials")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true };
};

export const deleteProductCategory = async (id: number) => {
  const supabase = await createClient();

  // Check if category has child categories
  const { data: childCategories, error: checkChildrenError } = await supabase
    .from("product_categories")
    .select("id")
    .eq("parent_id", id)
    .limit(1);

  if (checkChildrenError) {
    return { error: checkChildrenError.message };
  }

  if (childCategories && childCategories.length > 0) {
    return {
      error:
        "Cannot delete category that has child categories. Please delete or reassign child categories first.",
    };
  }

  // Check if category is used by any products
  const { data: products, error: checkProductsError } = await supabase
    .from("products")
    .select("id")
    .eq("category_id", id)
    .limit(1);

  if (checkProductsError) {
    return { error: checkProductsError.message };
  }

  if (products && products.length > 0) {
    return {
      error:
        "Cannot delete category that is used by products. Please reassign or remove products from this category first.",
    };
  }

  // Delete the category
  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true };
};
