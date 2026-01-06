"use client";

import { BarsyArticlesTab } from "@/components/admin/barsy-articles-tab";
import { CreateCategoryDialog } from "@/components/admin/create-category-dialog";
import { CreateProductDialog } from "@/components/admin/create-product-dialog";
import { CreateRawMaterialDialog } from "@/components/admin/create-raw-material-dialog";
import { LinkBarsyToProductDialog } from "@/components/admin/link-barsy-to-product-dialog";
import { LinkBarsyToRawMaterialDialog } from "@/components/admin/link-barsy-to-raw-material-dialog";
import { ProductDetailDialog } from "@/components/admin/product-detail-dialog";
import { ProductsTable } from "@/components/admin/products-table";
import { RawMaterialDetailDialog } from "@/components/admin/raw-material-detail-dialog";
import { RawMaterialsTable } from "@/components/admin/raw-materials-table";
import { CategoriesTable } from "@/components/admin/categories-table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/i18n/context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

interface ProductsPageClientProps {
  products: any[];
  categories: any[];
  materials: any[];
  productsError?: string;
  categoriesError?: string;
  materialsError?: string;
}

export const ProductsPageClient = ({
  products,
  categories,
  materials,
  productsError,
  categoriesError,
  materialsError,
}: ProductsPageClientProps) => {
  const { t } = useLanguage();
  const router = useRouter();

  // Product detail dialog state
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null
  );
  const [selectedProductName, setSelectedProductName] = useState("");

  // Link to product dialog state
  const [linkToProductOpen, setLinkToProductOpen] = useState(false);

  // Raw material detail dialog state
  const [materialDetailOpen, setMaterialDetailOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(
    null
  );
  const [selectedMaterialName, setSelectedMaterialName] = useState("");

  // Link to raw material dialog state
  const [linkToMaterialOpen, setLinkToMaterialOpen] = useState(false);

  // Pagination state for products
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize, setProductsPageSize] = useState(25);

  // Pagination state for raw materials
  const [materialsPage, setMaterialsPage] = useState(1);
  const [materialsPageSize, setMaterialsPageSize] = useState(25);

  // Pagination state for categories
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [categoriesPageSize, setCategoriesPageSize] = useState(25);

  // Paginated data
  const paginatedProducts = useMemo(() => {
    const startIndex = (productsPage - 1) * productsPageSize;
    const endIndex = startIndex + productsPageSize;
    return products.slice(startIndex, endIndex);
  }, [products, productsPage, productsPageSize]);

  const paginatedMaterials = useMemo(() => {
    const startIndex = (materialsPage - 1) * materialsPageSize;
    const endIndex = startIndex + materialsPageSize;
    return materials.slice(startIndex, endIndex);
  }, [materials, materialsPage, materialsPageSize]);

  const paginatedCategories = useMemo(() => {
    const startIndex = (categoriesPage - 1) * categoriesPageSize;
    const endIndex = startIndex + categoriesPageSize;
    return categories.slice(startIndex, endIndex);
  }, [categories, categoriesPage, categoriesPageSize]);

  const handleProductClick = useCallback(
    (productId: number) => {
      const product = products.find((p) => p.id === productId);
      if (product) {
        setSelectedProductId(productId);
        setSelectedProductName(product.name);
        setProductDetailOpen(true);
      }
    },
    [products]
  );

  const handleMaterialClick = useCallback(
    (materialId: number) => {
      const material = materials.find((m) => m.id === materialId);
      if (material) {
        setSelectedMaterialId(materialId);
        setSelectedMaterialName(material.name);
        setMaterialDetailOpen(true);
      }
    },
    [materials]
  );

  const handleLinkToProductClick = useCallback(() => {
    setProductDetailOpen(false);
    setLinkToProductOpen(true);
  }, []);

  const handleLinkToMaterialClick = useCallback(() => {
    setMaterialDetailOpen(false);
    setLinkToMaterialOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <>
      <div className="space-y-6">
        <div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin">Admin</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t("nav.products")}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl sm:text-3xl font-bold mt-2">{t("products.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("products.description")}
          </p>
        </div>

        <Tabs
          defaultValue="products"
          className="space-y-4"
          onValueChange={() => {
            // Reset pagination when switching tabs
            setProductsPage(1);
            setMaterialsPage(1);
            setCategoriesPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="products">{t("products.products")}</TabsTrigger>
            <TabsTrigger value="materials">
              {t("products.rawMaterials")}
            </TabsTrigger>
            <TabsTrigger value="categories">
              {t("products.categories")}
            </TabsTrigger>
            <TabsTrigger value="barsy">
              {t("products.barsyArticles") || "Barsy Articles"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <div className="flex justify-end">
              <CreateProductDialog categories={categories} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>{t("products.allProducts")}</CardTitle>
                <CardDescription>
                  {products.length} {t("products.product")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {productsError ? (
                  <p className="text-destructive">{productsError}</p>
                ) : (
                  <>
                    <ProductsTable
                      products={paginatedProducts}
                      onProductClick={handleProductClick}
                    />
                    {products.length > productsPageSize && (
                      <div className="mt-4">
                        <DataTablePagination
                          currentPage={productsPage}
                          pageSize={productsPageSize}
                          totalItems={products.length}
                          onPageChange={setProductsPage}
                          onPageSizeChange={(size) => {
                            setProductsPageSize(size);
                            setProductsPage(1);
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materials" className="space-y-4">
            <div className="flex justify-end">
              <CreateRawMaterialDialog />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>{t("products.allRawMaterials")}</CardTitle>
                <CardDescription>
                  {materials.length} {t("products.material")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {materialsError ? (
                  <p className="text-destructive">{materialsError}</p>
                ) : (
                  <>
                    <RawMaterialsTable
                      materials={paginatedMaterials}
                      onMaterialClick={handleMaterialClick}
                    />
                    {materials.length > materialsPageSize && (
                      <div className="mt-4">
                        <DataTablePagination
                          currentPage={materialsPage}
                          pageSize={materialsPageSize}
                          totalItems={materials.length}
                          onPageChange={setMaterialsPage}
                          onPageSizeChange={(size) => {
                            setMaterialsPageSize(size);
                            setMaterialsPage(1);
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-end">
              <CreateCategoryDialog categories={categories} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>{t("products.allCategories")}</CardTitle>
                <CardDescription>
                  {categories.length} {t("products.category")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoriesError ? (
                  <p className="text-destructive">{categoriesError}</p>
                ) : (
                  <>
                    <CategoriesTable categories={paginatedCategories} />
                    {categories.length > categoriesPageSize && (
                      <div className="mt-4">
                        <DataTablePagination
                          currentPage={categoriesPage}
                          pageSize={categoriesPageSize}
                          totalItems={categories.length}
                          onPageChange={setCategoriesPage}
                          onPageSizeChange={(size) => {
                            setCategoriesPageSize(size);
                            setCategoriesPage(1);
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="barsy" className="space-y-4">
            <BarsyArticlesTab
              products={products.map((p) => ({ id: p.id, name: p.name }))}
              rawMaterials={materials.map((m) => ({ id: m.id, name: m.name }))}
              onRefresh={handleRefresh}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Product Detail Dialog */}
      <ProductDetailDialog
        open={productDetailOpen}
        onOpenChange={setProductDetailOpen}
        productId={selectedProductId}
        onLinkClick={handleLinkToProductClick}
        onRefresh={handleRefresh}
      />

      {/* Link Barsy to Product Dialog */}
      <LinkBarsyToProductDialog
        open={linkToProductOpen}
        onOpenChange={setLinkToProductOpen}
        productId={selectedProductId}
        productName={selectedProductName}
        onSuccess={handleRefresh}
      />

      {/* Raw Material Detail Dialog */}
      <RawMaterialDetailDialog
        open={materialDetailOpen}
        onOpenChange={setMaterialDetailOpen}
        rawMaterialId={selectedMaterialId}
        onLinkClick={handleLinkToMaterialClick}
        onRefresh={handleRefresh}
      />

      {/* Link Barsy to Raw Material Dialog */}
      <LinkBarsyToRawMaterialDialog
        open={linkToMaterialOpen}
        onOpenChange={setLinkToMaterialOpen}
        rawMaterialId={selectedMaterialId}
        rawMaterialName={selectedMaterialName}
        onSuccess={handleRefresh}
      />
    </>
  );
};
