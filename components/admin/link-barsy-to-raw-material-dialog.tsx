"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getBarsyArticlesForMaterialLinking,
  getBarsyLocations,
  linkBarsyArticlesToRawMaterial,
  type BarsyArticleForLinking,
} from "@/lib/actions/product-barsy-mappings";
import { useLanguage } from "@/lib/i18n/context";
import { Check, Link2, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface LinkBarsyToRawMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawMaterialId: number | null;
  rawMaterialName: string;
  onSuccess: () => void;
}

export const LinkBarsyToRawMaterialDialog = ({
  open,
  onOpenChange,
  rawMaterialId,
  rawMaterialName,
  onSuccess,
}: LinkBarsyToRawMaterialDialogProps) => {
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [articles, setArticles] = useState<BarsyArticleForLinking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [linkedFilter, setLinkedFilter] = useState<
    "all" | "linked" | "unlinked"
  >("unlinked");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadLocations();
      setSelected(new Set());
      setSearch("");
      setPage(1);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      loadArticles();
    }
  }, [open, page, search, locationFilter, linkedFilter]);

  const loadLocations = async () => {
    const result = await getBarsyLocations();
    if (result.data) {
      setLocations(result.data);
    }
  };

  const loadArticles = async () => {
    setLoading(true);
    try {
      const result = await getBarsyArticlesForMaterialLinking({
        locationId: locationFilter !== "all" ? locationFilter : undefined,
        search: search || undefined,
        linkedStatus: linkedFilter,
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

  const handleToggle = (article: BarsyArticleForLinking) => {
    const key = `${article.location_id}-${article.barsy_article_id}`;
    const newSelected = new Set(selected);

    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }

    setSelected(newSelected);
  };

  const handleSave = async () => {
    if (!rawMaterialId || selected.size === 0) return;

    setSaving(true);

    const articlesToLink = Array.from(selected).map((key) => {
      // UUID contains hyphens, so we need to split from the last hyphen
      const lastHyphenIndex = key.lastIndexOf("-");
      const locationId = key.substring(0, lastHyphenIndex);
      const articleId = parseInt(key.substring(lastHyphenIndex + 1));
      return { locationId, articleId };
    });

    const result = await linkBarsyArticlesToRawMaterial(
      rawMaterialId,
      articlesToLink
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        locale === "bg"
          ? `${articlesToLink.length} артикул(а) свързани успешно`
          : `${articlesToLink.length} article(s) linked successfully`
      );
      onSuccess();
      onOpenChange(false);
    }

    setSaving(false);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {locale === "bg"
              ? "Свързване на Barsy артикули"
              : "Link Barsy Articles"}
          </DialogTitle>
          <DialogDescription>
            {locale === "bg" ? "Към суровина" : "To raw material"}:{" "}
            <strong>{rawMaterialName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
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
                placeholder={
                  locale === "bg" ? "Всички локации" : "All locations"
                }
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
            value={linkedFilter}
            onValueChange={(v: any) => {
              setLinkedFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
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
        </div>

        {/* Articles List */}
        <ScrollArea className="h-[350px] border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {locale === "bg" ? "Зареждане..." : "Loading..."}
            </div>
          ) : articles.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {locale === "bg" ? "Няма намерени артикули" : "No articles found"}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {articles.map((article) => {
                const key = `${article.location_id}-${article.barsy_article_id}`;
                const isSelected = selected.has(key);
                const isLinkedToOther =
                  article.linked_raw_material_id !== null &&
                  article.linked_raw_material_id !== rawMaterialId;

                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    } ${isLinkedToOther ? "opacity-60" : ""}`}
                    onClick={() => !isLinkedToOther && handleToggle(article)}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isLinkedToOther}
                      onCheckedChange={() => handleToggle(article)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {article.article_name}
                        </span>
                        {article.is_for_sale && (
                          <Badge variant="outline" className="text-xs">
                            {locale === "bg" ? "За продажба" : "For sale"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {article.location_name}
                      </div>
                    </div>
                    {article.linked_raw_material_id && (
                      <Badge
                        variant={
                          article.linked_raw_material_id === rawMaterialId
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {article.linked_raw_material_name}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Pagination info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {locale === "bg" ? "Общо" : "Total"}: {total} |{" "}
            {locale === "bg" ? "Избрани" : "Selected"}: {selected.size}
          </span>
          {total > 50 && (
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
                disabled={page * 50 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                {locale === "bg" ? "Напред" : "Next"}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {locale === "bg" ? "Отказ" : "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={saving || selected.size === 0}>
            {saving
              ? locale === "bg"
                ? "Запазване..."
                : "Saving..."
              : locale === "bg"
              ? `Свържи (${selected.size})`
              : `Link (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
