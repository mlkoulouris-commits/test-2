"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  getProductRecipes,
  getProductWithDetails,
  unlinkBarsyArticleFromProduct,
  type ProductRecipe,
} from "@/lib/actions/product-barsy-mappings";
import { useLanguage } from "@/lib/i18n/context";
import {
  AlertCircle,
  Check,
  ChefHat,
  Link2,
  MapPin,
  Package,
  Plus,
  Unlink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number | null;
  onLinkClick: () => void;
  onRefresh: () => void;
}

export const ProductDetailDialog = ({
  open,
  onOpenChange,
  productId,
  onLinkClick,
  onRefresh,
}: ProductDetailDialogProps) => {
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [recipe, setRecipe] = useState<ProductRecipe | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  useEffect(() => {
    if (open && productId) {
      loadProductData();
    }
  }, [open, productId]);

  const loadProductData = async () => {
    if (!productId) return;

    setLoading(true);
    try {
      const [productResult, recipeResult] = await Promise.all([
        getProductWithDetails(productId),
        getProductRecipes(productId),
      ]);

      if (productResult.data) {
        setProduct(productResult.data);
      }
      if (recipeResult.data) {
        setRecipe(recipeResult.data);
      }
    } catch (error) {
      console.error("Error loading product data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (locationId: string, articleId: number) => {
    const key = `${locationId}-${articleId}`;
    setUnlinking(key);

    const result = await unlinkBarsyArticleFromProduct(locationId, articleId);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(locale === "bg" ? "Връзката е премахната" : "Link removed");
      loadProductData();
      onRefresh();
    }

    setUnlinking(null);
  };

  if (!productId) return null;

  // Group linked articles by location
  const articlesByLocation =
    product?.linked_articles?.reduce((acc: any, article: any) => {
      if (!acc[article.location_name]) {
        acc[article.location_name] = [];
      }
      acc[article.location_name].push(article);
      return acc;
    }, {}) || {};

  // Group recipe ingredients by location
  const ingredientsByLocation =
    recipe?.ingredients?.reduce((acc: any, ing: any) => {
      if (!acc[ing.location_name]) {
        acc[ing.location_name] = [];
      }
      acc[ing.location_name].push(ing);
      return acc;
    }, {}) || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {product?.name || (locale === "bg" ? "Зареждане..." : "Loading...")}
          </DialogTitle>
          <DialogDescription>
            {product?.category_name && (
              <Badge variant="outline" className="mt-1">
                {product.category_name}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {locale === "bg" ? "Зареждане..." : "Loading..."}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Product Info */}
              {product && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {product.sku && (
                    <div>
                      <span className="text-muted-foreground">SKU:</span>{" "}
                      <span className="font-mono">{product.sku}</span>
                    </div>
                  )}
                  {product.selling_price && (
                    <div>
                      <span className="text-muted-foreground">
                        {locale === "bg" ? "Цена" : "Price"}:
                      </span>{" "}
                      <span className="font-medium">
                        {product.selling_price.toFixed(2)} BGN
                      </span>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Linked Barsy Articles */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    {locale === "bg"
                      ? "Свързани Barsy артикули"
                      : "Linked Barsy Articles"}
                  </h3>
                  <Button size="sm" variant="outline" onClick={onLinkClick}>
                    <Plus className="h-4 w-4 mr-1" />
                    {locale === "bg" ? "Свържи" : "Link"}
                  </Button>
                </div>

                {Object.keys(articlesByLocation).length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                    {locale === "bg"
                      ? "Няма свързани Barsy артикули"
                      : "No linked Barsy articles"}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(articlesByLocation).map(
                      ([locationName, articles]: [string, any]) => (
                        <div
                          key={locationName}
                          className="border rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2 text-sm font-medium mb-2">
                            <MapPin className="h-3 w-3" />
                            {locationName}
                          </div>
                          <div className="space-y-1">
                            {articles.map((article: any) => {
                              const key = `${article.barsy_location_id}-${article.barsy_article_id}`;
                              return (
                                <div
                                  key={key}
                                  className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                                >
                                  <span>{article.article_name}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-destructive hover:text-destructive"
                                    onClick={() =>
                                      handleUnlink(
                                        article.barsy_location_id,
                                        article.barsy_article_id
                                      )
                                    }
                                    disabled={unlinking === key}
                                  >
                                    <Unlink className="h-3 w-3" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Recipe Ingredients */}
              {recipe && recipe.ingredients.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <ChefHat className="h-4 w-4" />
                      {locale === "bg"
                        ? "Рецепта (съставки)"
                        : "Recipe (Ingredients)"}
                    </h3>

                    <div className="space-y-3">
                      {Object.entries(ingredientsByLocation).map(
                        ([locationName, ingredients]: [string, any]) => (
                          <div
                            key={locationName}
                            className="border rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 text-sm font-medium mb-2">
                              <MapPin className="h-3 w-3" />
                              {locationName}
                            </div>
                            <div className="space-y-1">
                              {ingredients.map((ing: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{ing.ingredient_name}</span>
                                    {ing.quantity > 0 && (
                                      <span className="text-muted-foreground text-xs">
                                        ({ing.quantity} {ing.unit || ""})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {ing.raw_material_id ? (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        <Check className="h-3 w-3 mr-1" />
                                        {ing.raw_material_name}
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-xs text-amber-600"
                                      >
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        {locale === "bg"
                                          ? "Несвързан"
                                          : "Not linked"}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
