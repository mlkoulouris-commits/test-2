"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArticleRecipeIngredient,
  getArticleRecipe,
} from "@/lib/actions/product-barsy-mappings";
import { useLanguage } from "@/lib/i18n/context";
import { Box, ChefHat, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface BarsyRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  articleId: number;
  articleName: string;
}

export const BarsyRecipeDialog = ({
  open,
  onOpenChange,
  locationId,
  articleId,
  articleName,
}: BarsyRecipeDialogProps) => {
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState<ArticleRecipeIngredient[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && locationId && articleId) {
      loadRecipe();
    }
  }, [open, locationId, articleId]);

  const loadRecipe = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getArticleRecipe(locationId, articleId);

      if (result.error) {
        setError(result.error);
      } else {
        setIngredients(result.data || []);
      }
    } catch (err) {
      setError(
        locale === "bg" ? "Грешка при зареждане" : "Error loading recipe"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            {locale === "bg" ? "Рецепта" : "Recipe"}: {articleName}
          </DialogTitle>
          <DialogDescription>
            {locale === "bg"
              ? "Съставки за този артикул от Barsy"
              : "Ingredients for this Barsy article"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">{error}</div>
        ) : ingredients.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {locale === "bg"
              ? "Няма намерени съставки"
              : "No ingredients found"}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {locale === "bg" ? "Съставка" : "Ingredient"}
                  </TableHead>
                  <TableHead className="w-[100px] text-right">
                    {locale === "bg" ? "Количество" : "Quantity"}
                  </TableHead>
                  <TableHead className="w-[80px]">
                    {locale === "bg" ? "Мярка" : "Unit"}
                  </TableHead>
                  <TableHead>
                    {locale === "bg" ? "Суровина" : "Raw Material"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ingredient, idx) => (
                  <TableRow
                    key={ingredient.barsy_ingredient_article_id}
                    className={idx % 2 === 0 ? "bg-muted/30" : ""}
                  >
                    <TableCell className="font-medium">
                      {ingredient.ingredient_name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ingredient.quantity.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ingredient.unit || "—"}
                    </TableCell>
                    <TableCell>
                      {ingredient.raw_material_id ? (
                        <Badge variant="outline" className="text-xs">
                          <Box className="h-3 w-3 mr-1" />
                          {ingredient.raw_material_name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {locale === "bg" ? "Не е свързана" : "Not linked"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-2">
          {locale === "bg"
            ? `${ingredients.length} съставки`
            : `${ingredients.length} ingredients`}
        </div>
      </DialogContent>
    </Dialog>
  );
};
