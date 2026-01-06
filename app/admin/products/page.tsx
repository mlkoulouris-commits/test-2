import { ProductsPageClient } from "@/components/admin/products-page-client";
import {
  getProductsWithBarsyMappings,
  getRawMaterialsWithBarsyMappings,
} from "@/lib/actions/product-barsy-mappings";
import { getAllProductCategories } from "@/lib/actions/products";

export default async function ProductsPage() {
  const [productsResult, categoriesResult, materialsResult] = await Promise.all(
    [
      getProductsWithBarsyMappings(),
      getAllProductCategories(),
      getRawMaterialsWithBarsyMappings(),
    ]
  );

  return (
    <ProductsPageClient
      products={productsResult.data || []}
      categories={categoriesResult.data || []}
      materials={materialsResult.data || []}
      productsError={productsResult.error}
      categoriesError={categoriesResult.error}
      materialsError={materialsResult.error}
    />
  );
}
