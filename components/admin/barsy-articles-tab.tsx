"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createProductFromBarsyArticle,
  createRawMaterialFromBarsyArticle,
  getAllBarsyArticlesWithMappings,
  getBarsyLocations,
  type BarsyArticleForLinking,
} from "@/lib/actions/product-barsy-mappings";
import { useLanguage } from "@/lib/i18n/context";
import {
  Ban,
  Box,
  Boxes,
  CheckCircle2,
  ChefHat,
  Link2,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BarsyRecipeDialog } from "./barsy-recipe-dialog";
import { LinkBarsyToProductDialog } from "./link-barsy-to-product-dialog";
import { LinkBarsyToRawMaterialDialog } from "./link-barsy-to-raw-material-dialog";

interface BarsyArticlesTabProps {
  products: Array<{ id: number; name: string }>;
  rawMaterials: Array<{ id: number; name: string }>;
  onRefresh: () => void;
}

export const BarsyArticlesTab = ({
  products,
  rawMaterials,
  onRefresh,
}: BarsyArticlesTabProps) => {
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [articles, setArticles] = useState<BarsyArticleForLinking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "for_sale" | "ingredient"
  >("all");
  const [linkedFilter, setLinkedFilter] = useState<
    "all" | "linked" | "unlinked"
  >("all");
  const [recipeFilter, setRecipeFilter] = useState<
    "all" | "with_recipe" | "no_recipe"
  >("all");
  const [deletedFilter, setDeletedFilter] = useState<
    "all" | "active" | "deleted"
  >("all");

  // Link to product dialog
  const [linkProductDialogOpen, setLinkProductDialogOpen] = useState(false);
  const [selectedForProduct, setSelectedForProduct] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [articleToLink, setArticleToLink] =
    useState<BarsyArticleForLinking | null>(null);

  // Link to raw material dialog
  const [linkMaterialDialogOpen, setLinkMaterialDialogOpen] = useState(false);
  const [selectedForMaterial, setSelectedForMaterial] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Recipe dialog
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [articleForRecipe, setArticleForRecipe] =
    useState<BarsyArticleForLinking | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadArticles();
  }, [page, search, locationFilter, typeFilter, linkedFilter, recipeFilter, deletedFilter]);

  const loadLocations = async () => {
    const result = await getBarsyLocations();
    if (result.data) {
      setLocations(result.data);
    }
  };

  const loadArticles = async () => {
    setLoading(true);
    try {
      const result = await getAllBarsyArticlesWithMappings({
        locationId: locationFilter !== "all" ? locationFilter : undefined,
        search: search || undefined,
        type: typeFilter,
        linkedStatus: linkedFilter,
        recipeFilter: recipeFilter,
        deletedFilter: deletedFilter,
        page,
        pageSize: 50,
      });

      if (result.data) {
        setArticles(result.data);
        setTotal(result.total || 0);
      }
    } catch (error) {
      console.error("Error loading articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCreateProduct = async (article: BarsyArticleForLinking) => {
    const result = await createProductFromBarsyArticle(
      article.location_id,
      article.barsy_article_id
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        locale === "bg"
          ? `Продукт "${article.article_name}" създаден`
          : `Product "${article.article_name}" created`
      );
      loadArticles();
      onRefresh();
    }
  };

  const handleCreateRawMaterial = async (article: BarsyArticleForLinking) => {
    const result = await createRawMaterialFromBarsyArticle(
      article.location_id,
      article.barsy_article_id
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        locale === "bg"
          ? `Суровина "${article.article_name}" създадена`
          : `Raw material "${article.article_name}" created`
      );
      loadArticles();
      onRefresh();
    }
  };

  const handleLinkToProduct = (article: BarsyArticleForLinking) => {
    setArticleToLink(article);
    // Open a mini-dialog to select which product to link to
    // For simplicity, we'll use the existing dialog but need to select a product first
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            {locale === "bg" ? "Barsy артикули" : "Barsy Articles"}
          </CardTitle>
          <CardDescription>
            {locale === "bg"
              ? "Преглед и свързване на Barsy артикули към продукти и суровини"
              : "View and link Barsy articles to products and raw materials"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  locale === "bg" ? "Търсене по име..." : "Search by name..."
                }
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={locationFilter}
              onValueChange={(v) => {
                setLocationFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue
                  placeholder={locale === "bg" ? "Локация" : "Location"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === "bg" ? "Всички локации" : "All locations"}
                </SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(v: any) => {
                setTypeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={locale === "bg" ? "Тип" : "Type"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === "bg" ? "Всички" : "All"}
                </SelectItem>
                <SelectItem value="for_sale">
                  {locale === "bg" ? "За продажба" : "For Sale"}
                </SelectItem>
                <SelectItem value="ingredient">
                  {locale === "bg" ? "Съставки" : "Ingredients"}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={linkedFilter}
              onValueChange={(v: any) => {
                setLinkedFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue
                  placeholder={locale === "bg" ? "Статус" : "Status"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === "bg" ? "Всички" : "All"}
                </SelectItem>
                <SelectItem value="unlinked">
                  {locale === "bg" ? "Несвързани" : "Unlinked"}
                </SelectItem>
                <SelectItem value="linked">
                  {locale === "bg" ? "Свързани" : "Linked"}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={recipeFilter}
              onValueChange={(v: any) => {
                setRecipeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue
                  placeholder={locale === "bg" ? "Рецепта" : "Recipe"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === "bg" ? "Всички" : "All"}
                </SelectItem>
                <SelectItem value="with_recipe">
                  <span className="flex items-center gap-1">
                    <ChefHat className="h-3 w-3" />
                    {locale === "bg" ? "С рецепта" : "With Recipe"}
                  </span>
                </SelectItem>
                <SelectItem value="no_recipe">
                  {locale === "bg" ? "Без рецепта" : "No Recipe"}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={deletedFilter}
              onValueChange={(v: any) => {
                setDeletedFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue
                  placeholder={locale === "bg" ? "Активност" : "Active"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === "bg" ? "Всички" : "All"}
                </SelectItem>
                <SelectItem value="active">
                  {locale === "bg" ? "Активни" : "Active"}
                </SelectItem>
                <SelectItem value="deleted">
                  {locale === "bg" ? "Изтрити" : "Deleted"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {locale === "bg" ? "Артикул" : "Article"}
                  </TableHead>
                  <TableHead>
                    {locale === "bg" ? "Локация" : "Location"}
                  </TableHead>
                  <TableHead>{locale === "bg" ? "Тип" : "Type"}</TableHead>
                  <TableHead>
                    {locale === "bg" ? "Статус" : "Status"}
                  </TableHead>
                  <TableHead>
                    {locale === "bg" ? "Свързан към" : "Linked To"}
                  </TableHead>
                  <TableHead className="w-[100px]">
                    {locale === "bg" ? "Действия" : "Actions"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {locale === "bg" ? "Зареждане..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : articles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {locale === "bg"
                        ? "Няма намерени артикули"
                        : "No articles found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  articles.map((article, idx) => (
                    <TableRow
                      key={`${article.location_id}-${article.barsy_article_id}`}
                      className={idx % 2 === 0 ? "bg-muted/30" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">
                            {article.article_name}
                          </div>
                          {article.has_recipe && (
                            <button
                              onClick={() => {
                                setArticleForRecipe(article);
                                setRecipeDialogOpen(true);
                              }}
                              className="text-orange-500 hover:text-orange-600 transition-colors"
                              title={
                                locale === "bg"
                                  ? "Виж рецепта"
                                  : "View recipe"
                              }
                            >
                              <ChefHat className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {article.price && (
                          <div className="text-xs text-muted-foreground">
                            {article.price.toFixed(2)} BGN
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {article.location_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {article.is_for_sale ? (
                          <Badge variant="default" className="text-xs">
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            {locale === "bg" ? "За продажба" : "For Sale"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <Box className="h-3 w-3 mr-1" />
                            {locale === "bg" ? "Съставка" : "Ingredient"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {article.is_active ? (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {locale === "bg" ? "Активен" : "Active"}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <Ban className="h-3 w-3 mr-1" />
                            {locale === "bg" ? "Изтрит" : "Deleted"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {article.linked_product_id ? (
                          <Badge variant="outline" className="text-xs">
                            <Package className="h-3 w-3 mr-1" />
                            {article.linked_product_name}
                          </Badge>
                        ) : article.linked_raw_material_id ? (
                          <Badge variant="outline" className="text-xs">
                            <Box className="h-3 w-3 mr-1" />
                            {article.linked_raw_material_name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!article.linked_product_id &&
                              !article.linked_raw_material_id && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleCreateProduct(article)}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    {locale === "bg"
                                      ? "Създай продукт"
                                      : "Create Product"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleCreateRawMaterial(article)
                                    }
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    {locale === "bg"
                                      ? "Създай суровина"
                                      : "Create Raw Material"}
                                  </DropdownMenuItem>
                                </>
                              )}
                            {!article.linked_product_id && (
                              <DropdownMenuItem
                                onClick={() => {
                                  // For linking to existing product, we need a selector
                                  // This is a simplified version - in a real app you'd want a search dialog
                                  if (products.length > 0) {
                                    setArticleToLink(article);
                                    setSelectedForProduct(products[0]);
                                    setLinkProductDialogOpen(true);
                                  }
                                }}
                              >
                                <Link2 className="h-4 w-4 mr-2" />
                                {locale === "bg"
                                  ? "Свържи към продукт"
                                  : "Link to Product"}
                              </DropdownMenuItem>
                            )}
                            {!article.linked_raw_material_id && (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (rawMaterials.length > 0) {
                                    setArticleToLink(article);
                                    setSelectedForMaterial(rawMaterials[0]);
                                    setLinkMaterialDialogOpen(true);
                                  }
                                }}
                              >
                                <Link2 className="h-4 w-4 mr-2" />
                                {locale === "bg"
                                  ? "Свържи към суровина"
                                  : "Link to Raw Material"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {locale === "bg" ? "Страница" : "Page"} {page}{" "}
                {locale === "bg" ? "от" : "of"} {totalPages} ({total}{" "}
                {locale === "bg" ? "резултата" : "results"})
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {locale === "bg" ? "Назад" : "Previous"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {locale === "bg" ? "Напред" : "Next"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link to Product Dialog */}
      {selectedForProduct && (
        <LinkBarsyToProductDialog
          open={linkProductDialogOpen}
          onOpenChange={setLinkProductDialogOpen}
          productId={selectedForProduct.id}
          productName={selectedForProduct.name}
          onSuccess={() => {
            loadArticles();
            onRefresh();
          }}
        />
      )}

      {/* Link to Raw Material Dialog */}
      {selectedForMaterial && (
        <LinkBarsyToRawMaterialDialog
          open={linkMaterialDialogOpen}
          onOpenChange={setLinkMaterialDialogOpen}
          rawMaterialId={selectedForMaterial.id}
          rawMaterialName={selectedForMaterial.name}
          onSuccess={() => {
            loadArticles();
            onRefresh();
          }}
        />
      )}

      {/* Recipe Dialog */}
      {articleForRecipe && (
        <BarsyRecipeDialog
          open={recipeDialogOpen}
          onOpenChange={setRecipeDialogOpen}
          locationId={articleForRecipe.location_id}
          articleId={articleForRecipe.barsy_article_id}
          articleName={articleForRecipe.article_name}
        />
      )}
    </>
  );
};
