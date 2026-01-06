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
  getRawMaterialWithDetails,
  unlinkBarsyArticleFromRawMaterial,
} from "@/lib/actions/product-barsy-mappings";
import { useLanguage } from "@/lib/i18n/context";
import { Box, Link2, MapPin, Plus, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface RawMaterialDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawMaterialId: number | null;
  onLinkClick: () => void;
  onRefresh: () => void;
}

export const RawMaterialDetailDialog = ({
  open,
  onOpenChange,
  rawMaterialId,
  onLinkClick,
  onRefresh,
}: RawMaterialDetailDialogProps) => {
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [material, setMaterial] = useState<any>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  useEffect(() => {
    if (open && rawMaterialId) {
      loadMaterialData();
    }
  }, [open, rawMaterialId]);

  const loadMaterialData = async () => {
    if (!rawMaterialId) return;

    setLoading(true);
    try {
      const result = await getRawMaterialWithDetails(rawMaterialId);
      if (result.data) {
        setMaterial(result.data);
      }
    } catch (error) {
      console.error("Error loading raw material data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (locationId: string, articleId: number) => {
    const key = `${locationId}-${articleId}`;
    setUnlinking(key);

    const result = await unlinkBarsyArticleFromRawMaterial(
      locationId,
      articleId
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(locale === "bg" ? "Връзката е премахната" : "Link removed");
      loadMaterialData();
      onRefresh();
    }

    setUnlinking(null);
  };

  if (!rawMaterialId) return null;

  // Group linked articles by location
  const articlesByLocation =
    material?.linked_articles?.reduce((acc: any, article: any) => {
      if (!acc[article.location_name]) {
        acc[article.location_name] = [];
      }
      acc[article.location_name].push(article);
      return acc;
    }, {}) || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" />
            {material?.name ||
              (locale === "bg" ? "Зареждане..." : "Loading...")}
          </DialogTitle>
          <DialogDescription>
            {material?.unit_of_measure && (
              <Badge variant="outline" className="mt-1">
                {locale === "bg" ? "Мерна единица" : "Unit"}:{" "}
                {material.unit_of_measure}
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
              {/* Material Info */}
              {material && material.reorder_level && (
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {locale === "bg" ? "Ниво за презареждане" : "Reorder Level"}
                    :
                  </span>{" "}
                  <span className="font-medium">{material.reorder_level}</span>
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
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
