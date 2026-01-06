"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { useCurrency } from "@/lib/i18n/currency";
import { getBillLocations, getBillVendors } from "@/lib/actions/bills";
import { getBarsyLocations, getCategoriesByLocation } from "@/lib/actions/barsy-account-mappings";
import { CoaAccountBadge } from "@/components/admin/coa-account-badge";
import {
  EffectiveBarsyArticleRow,
  EffectiveBarsyCategoryRow,
  EffectiveBillItemRow,
  EffectiveMappingSource,
  getEffectiveBarsyArticleMappings,
  getEffectiveBarsyCategoryMappings,
  getEffectiveBillItemMappings,
} from "@/lib/actions/effective-coa-mappings";
import { toast } from "sonner";

const getSourceLabel = (source: EffectiveMappingSource, locale: "en" | "bg") => {
  const labels: Record<EffectiveMappingSource, { en: string; bg: string }> = {
    explicit: { en: "Explicit", bg: "Ръчно" },
    override: { en: "Override", bg: "Специална" },
    inherited: { en: "Inherited", bg: "Наследена" },
    heuristic: { en: "Heuristic", bg: "Авто" },
    default: { en: "Default", bg: "По подразб." },
    excluded_tips: { en: "Excluded (tips)", bg: "Изключено (типс)" },
  };
  return labels[source][locale];
};

const getSourceBadgeVariant = (source: EffectiveMappingSource) => {
  switch (source) {
    case "explicit":
    case "override":
      return "default" as const;
    case "inherited":
      return "secondary" as const;
    case "heuristic":
      return "outline" as const;
    case "excluded_tips":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
};

export default function EffectiveCoaMappingsPage() {
  const { locale, t } = useLanguage();
  const { formatAmount } = useCurrency();

  // Shared dropdown data
  const [barsyLocations, setBarsyLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [billLocations, setBillLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [billVendors, setBillVendors] = useState<Array<{ id: number; name: string }>>([]);

  // Income/Categories state
  const [catRows, setCatRows] = useState<EffectiveBarsyCategoryRow[]>([]);
  const [catTotal, setCatTotal] = useState(0);
  const [catPage, setCatPage] = useState(1);
  const [catPageSize, setCatPageSize] = useState(50);
  const [catSearch, setCatSearch] = useState("");
  const [catLocationId, setCatLocationId] = useState<string>("");
  const [catOnlyUnmapped, setCatOnlyUnmapped] = useState(false);
  const [catLoading, setCatLoading] = useState(false);

  // Income/Articles state
  const [articleRows, setArticleRows] = useState<EffectiveBarsyArticleRow[]>([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articlePage, setArticlePage] = useState(1);
  const [articlePageSize, setArticlePageSize] = useState(50);
  const [articleSearch, setArticleSearch] = useState("");
  const [articleLocationId, setArticleLocationId] = useState<string>("");
  const [articleCategoryId, setArticleCategoryId] = useState<number | null>(null);
  const [articleOnlyFallbacks, setArticleOnlyFallbacks] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleCategories, setArticleCategories] = useState<Array<{ barsy_category_id: number; category_name: string }>>([]);

  // Expenses/Bill items state
  const [billItemRows, setBillItemRows] = useState<EffectiveBillItemRow[]>([]);
  const [billItemTotal, setBillItemTotal] = useState(0);
  const [billItemPage, setBillItemPage] = useState(1);
  const [billItemPageSize, setBillItemPageSize] = useState(50);
  const [billItemSearch, setBillItemSearch] = useState("");
  const [billItemLocationId, setBillItemLocationId] = useState<number | null>(null);
  const [billItemVendorId, setBillItemVendorId] = useState<number | null>(null);
  const [billItemDateFrom, setBillItemDateFrom] = useState<string>("");
  const [billItemDateTo, setBillItemDateTo] = useState<string>("");
  const [billItemOnlyFallbacks, setBillItemOnlyFallbacks] = useState(false);
  const [billItemLoading, setBillItemLoading] = useState(false);

  const billLocationOptions = useMemo(() => [{ id: -1, name: locale === "bg" ? "Всички" : "All" }, ...billLocations], [billLocations, locale]);
  const billVendorOptions = useMemo(() => [{ id: -1, name: locale === "bg" ? "Всички" : "All" }, ...billVendors], [billVendors, locale]);

  useEffect(() => {
    const loadLookups = async () => {
      const [barsyLocResult, billLocResult, billVendorResult] = await Promise.all([
        getBarsyLocations(),
        getBillLocations(),
        getBillVendors(),
      ]);

      if (barsyLocResult.data) setBarsyLocations(barsyLocResult.data);
      if (billLocResult.data) setBillLocations(billLocResult.data);
      if (billVendorResult.data) setBillVendors(billVendorResult.data);
    };

    loadLookups().catch(() => {
      toast.error(locale === "bg" ? "Грешка при зареждане" : "Failed to load lookup data");
    });
  }, [locale]);

  // Load Barsy categories list when selecting location in Articles tab
  useEffect(() => {
    const loadCategories = async () => {
      if (!articleLocationId) {
        setArticleCategories([]);
        setArticleCategoryId(null);
        return;
      }

      const result = await getCategoriesByLocation(articleLocationId);
      if (result.data) {
        setArticleCategories(result.data);
      } else {
        setArticleCategories([]);
      }
    };

    loadCategories().catch(() => {
      toast.error(locale === "bg" ? "Грешка при зареждане на категории" : "Failed to load categories");
    });
  }, [articleLocationId, locale]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCatLoading(true);
      getEffectiveBarsyCategoryMappings({
        page: catPage,
        pageSize: catPageSize,
        search: catSearch,
        locationId: catLocationId || undefined,
        showOnlyUnmapped: catOnlyUnmapped,
      })
        .then((result) => {
          if (result.error) {
            toast.error(result.error);
            return;
          }
          setCatRows(result.data ?? []);
          setCatTotal(result.total ?? 0);
        })
        .finally(() => setCatLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [catPage, catPageSize, catSearch, catLocationId, catOnlyUnmapped]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setArticleLoading(true);
      getEffectiveBarsyArticleMappings({
        page: articlePage,
        pageSize: articlePageSize,
        search: articleSearch,
        locationId: articleLocationId || undefined,
        categoryId: articleCategoryId ?? undefined,
        showOnlyFallbacks: articleOnlyFallbacks,
      })
        .then((result) => {
          if (result.error) {
            toast.error(result.error);
            return;
          }
          setArticleRows(result.data ?? []);
          setArticleTotal(result.total ?? 0);
        })
        .finally(() => setArticleLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [articlePage, articlePageSize, articleSearch, articleLocationId, articleCategoryId, articleOnlyFallbacks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBillItemLoading(true);
      getEffectiveBillItemMappings({
        page: billItemPage,
        pageSize: billItemPageSize,
        search: billItemSearch,
        locationId: billItemLocationId ?? undefined,
        vendorId: billItemVendorId ?? undefined,
        dateFrom: billItemDateFrom || undefined,
        dateTo: billItemDateTo || undefined,
        showOnlyFallbacks: billItemOnlyFallbacks,
      })
        .then((result) => {
          if (result.error) {
            toast.error(result.error);
            return;
          }
          setBillItemRows(result.data ?? []);
          setBillItemTotal(result.total ?? 0);
        })
        .finally(() => setBillItemLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [billItemPage, billItemPageSize, billItemSearch, billItemLocationId, billItemVendorId, billItemDateFrom, billItemDateTo, billItemOnlyFallbacks]);

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">{t("common.admin")}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/chart-of-accounts">
              {locale === "bg" ? "Сметкоплан" : "Chart of Accounts"}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {locale === "bg" ? "Ефективни връзки" : "Effective Mappings"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">
          {locale === "bg" ? "Ефективни връзки (с fallback)" : "Effective Mappings (with fallbacks)"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {locale === "bg"
            ? "Вижте коя сметка от сметкоплана ще се използва реално и защо (override/наследяване/авто/по подразбиране)."
            : "See which chart of accounts entry will actually be used and why (override/inherited/heuristic/default)."}
        </p>
      </div>

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">{locale === "bg" ? "Приходи (Barsy)" : "Income (Barsy)"}</TabsTrigger>
          <TabsTrigger value="expenses">{locale === "bg" ? "Разходи (Фактури)" : "Expenses (Bills)"}</TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-6 space-y-6">
          <Tabs defaultValue="categories">
            <TabsList>
              <TabsTrigger value="categories">{locale === "bg" ? "Категории" : "Categories"}</TabsTrigger>
              <TabsTrigger value="articles">{locale === "bg" ? "Артикули" : "Articles"}</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{locale === "bg" ? "Категории (ефективна сметка)" : "Categories (effective account)"}</CardTitle>
                  <CardDescription>
                    {catTotal > 0
                      ? `${catTotal} ${locale === "bg" ? "категории" : "categories"}`
                      : catLoading
                        ? (locale === "bg" ? "Зареждане..." : "Loading...")
                        : (locale === "bg" ? "Няма данни" : "No data")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <div className="min-w-[220px] flex-1">
                      <Input
                        value={catSearch}
                        onChange={(e) => {
                          setCatSearch(e.target.value);
                          setCatPage(1);
                        }}
                        placeholder={locale === "bg" ? "Търсене..." : "Search..."}
                      />
                    </div>

                    <Select
                      value={catLocationId || "all"}
                      onValueChange={(v) => {
                        setCatLocationId(v === "all" ? "" : v);
                        setCatPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder={locale === "bg" ? "Всички локации" : "All locations"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{locale === "bg" ? "Всички локации" : "All locations"}</SelectItem>
                        {barsyLocations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={catOnlyUnmapped}
                        onCheckedChange={(v) => {
                          setCatOnlyUnmapped(Boolean(v));
                          setCatPage(1);
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {locale === "bg" ? "Само без връзка" : "Only unmapped"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{locale === "bg" ? "Категория" : "Category"}</TableHead>
                          <TableHead>{locale === "bg" ? "Локация" : "Location"}</TableHead>
                          <TableHead>{locale === "bg" ? "Ръчна (Приходи)" : "Explicit (Revenue)"}</TableHead>
                          <TableHead>{locale === "bg" ? "Ефективна (Приходи)" : "Effective (Revenue)"}</TableHead>
                          <TableHead>{locale === "bg" ? "Ръчна (Себ.)" : "Explicit (COGS)"}</TableHead>
                          <TableHead>{locale === "bg" ? "Ефективна (Себ.)" : "Effective (COGS)"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catLoading ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              {locale === "bg" ? "Зареждане..." : "Loading..."}
                            </TableCell>
                          </TableRow>
                        ) : catRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              {locale === "bg" ? "Няма резултати" : "No results"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          catRows.map((row, idx) => (
                            <TableRow key={`${row.locationId}-${row.categoryId}`} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                              <TableCell className="font-medium">{row.categoryName}</TableCell>
                              <TableCell className="text-muted-foreground">{row.locationName}</TableCell>
                              <TableCell>
                                <CoaAccountBadge
                                  code={row.explicitRevenueAccount?.code}
                                  name={row.explicitRevenueAccount?.name}
                                  variant="outline"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <CoaAccountBadge
                                    code={row.effectiveRevenueAccount?.code}
                                    name={row.effectiveRevenueAccount?.name}
                                    variant="outline"
                                  />
                                  <Badge variant={getSourceBadgeVariant(row.effectiveRevenueSource)} className="text-xs">
                                    {getSourceLabel(row.effectiveRevenueSource, locale)}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <CoaAccountBadge
                                  code={row.explicitCogsAccount?.code}
                                  name={row.explicitCogsAccount?.name}
                                  variant="outline"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <CoaAccountBadge
                                    code={row.effectiveCogsAccount?.code}
                                    name={row.effectiveCogsAccount?.name}
                                    variant="outline"
                                  />
                                  <Badge variant={getSourceBadgeVariant(row.effectiveCogsSource)} className="text-xs">
                                    {getSourceLabel(row.effectiveCogsSource, locale)}
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {!catLoading && catTotal > 0 && (
                    <DataTablePagination
                      currentPage={catPage}
                      pageSize={catPageSize}
                      totalItems={catTotal}
                      onPageChange={setCatPage}
                      onPageSizeChange={(size) => {
                        setCatPageSize(size);
                        setCatPage(1);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="articles" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{locale === "bg" ? "Артикули (ефективна сметка)" : "Articles (effective account)"}</CardTitle>
                  <CardDescription>
                    {articleTotal > 0
                      ? `${articleTotal} ${locale === "bg" ? "артикули" : "articles"}`
                      : articleLoading
                        ? (locale === "bg" ? "Зареждане..." : "Loading...")
                        : (locale === "bg" ? "Няма данни" : "No data")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <div className="min-w-[220px] flex-1">
                      <Input
                        value={articleSearch}
                        onChange={(e) => {
                          setArticleSearch(e.target.value);
                          setArticlePage(1);
                        }}
                        placeholder={locale === "bg" ? "Търсене..." : "Search..."}
                      />
                    </div>

                    <Select
                      value={articleLocationId || "all"}
                      onValueChange={(v) => {
                        setArticleLocationId(v === "all" ? "" : v);
                        setArticlePage(1);
                      }}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder={locale === "bg" ? "Всички локации" : "All locations"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{locale === "bg" ? "Всички локации" : "All locations"}</SelectItem>
                        {barsyLocations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={articleCategoryId?.toString() || "all"}
                      onValueChange={(v) => {
                        setArticleCategoryId(v === "all" ? null : Number(v));
                        setArticlePage(1);
                      }}
                      disabled={!articleLocationId || articleCategories.length === 0}
                    >
                      <SelectTrigger className="w-[240px]">
                        <SelectValue placeholder={locale === "bg" ? "Всички категории" : "All categories"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{locale === "bg" ? "Всички категории" : "All categories"}</SelectItem>
                        {articleCategories.map((cat) => (
                          <SelectItem key={cat.barsy_category_id} value={cat.barsy_category_id.toString()}>
                            {cat.category_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={articleOnlyFallbacks}
                        onCheckedChange={(v) => {
                          setArticleOnlyFallbacks(Boolean(v));
                          setArticlePage(1);
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {locale === "bg" ? "Само fallback" : "Only fallbacks"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{locale === "bg" ? "Артикул" : "Article"}</TableHead>
                          <TableHead>{locale === "bg" ? "Категория" : "Category"}</TableHead>
                          <TableHead>{locale === "bg" ? "Локация" : "Location"}</TableHead>
                          <TableHead>{locale === "bg" ? "Ефективна (Приходи)" : "Effective (Revenue)"}</TableHead>
                          <TableHead>{locale === "bg" ? "Ефективна (Себ.)" : "Effective (COGS)"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {articleLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              {locale === "bg" ? "Зареждане..." : "Loading..."}
                            </TableCell>
                          </TableRow>
                        ) : articleRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              {locale === "bg" ? "Няма резултати" : "No results"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          articleRows.map((row, idx) => (
                            <TableRow key={row.id} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <span className="truncate" title={row.articleName}>
                                    {row.articleName}
                                  </span>
                                  {row.isTips && (
                                    <Badge variant="destructive" className="text-xs">
                                      {locale === "bg" ? "Типс" : "Tips"}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{row.categoryName || "—"}</TableCell>
                              <TableCell className="text-muted-foreground">{row.locationName}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <CoaAccountBadge
                                    code={row.effectiveRevenueAccount?.code}
                                    name={row.effectiveRevenueAccount?.name}
                                    variant="outline"
                                  />
                                  <Badge variant={getSourceBadgeVariant(row.effectiveRevenueSource)} className="text-xs">
                                    {getSourceLabel(row.effectiveRevenueSource, locale)}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <CoaAccountBadge
                                    code={row.effectiveCogsAccount?.code}
                                    name={row.effectiveCogsAccount?.name}
                                    variant="outline"
                                  />
                                  <Badge variant={getSourceBadgeVariant(row.effectiveCogsSource)} className="text-xs">
                                    {getSourceLabel(row.effectiveCogsSource, locale)}
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {!articleLoading && articleTotal > 0 && (
                    <DataTablePagination
                      currentPage={articlePage}
                      pageSize={articlePageSize}
                      totalItems={articleTotal}
                      onPageChange={setArticlePage}
                      onPageSizeChange={(size) => {
                        setArticlePageSize(size);
                        setArticlePage(1);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{locale === "bg" ? "Фактурни артикули (ефективна сметка)" : "Bill items (effective account)"}</CardTitle>
              <CardDescription>
                {billItemTotal > 0
                  ? `${billItemTotal} ${locale === "bg" ? "реда" : "items"}`
                  : billItemLoading
                    ? (locale === "bg" ? "Зареждане..." : "Loading...")
                    : (locale === "bg" ? "Няма данни" : "No data")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[220px] flex-1">
                  <Input
                    value={billItemSearch}
                    onChange={(e) => {
                      setBillItemSearch(e.target.value);
                      setBillItemPage(1);
                    }}
                    placeholder={locale === "bg" ? "Търсене (артикул/доставчик)..." : "Search (item/vendor)..."}
                  />
                </div>

                <Select
                  value={(billItemLocationId ?? -1).toString()}
                  onValueChange={(v) => {
                    const next = Number(v);
                    setBillItemLocationId(next === -1 ? null : next);
                    setBillItemPage(1);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {billLocationOptions.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={(billItemVendorId ?? -1).toString()}
                  onValueChange={(v) => {
                    const next = Number(v);
                    setBillItemVendorId(next === -1 ? null : next);
                    setBillItemPage(1);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {billVendorOptions.map((ven) => (
                      <SelectItem key={ven.id} value={ven.id.toString()}>
                        {ven.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{locale === "bg" ? "От" : "From"}</span>
                  <Input
                    type="date"
                    value={billItemDateFrom}
                    onChange={(e) => {
                      setBillItemDateFrom(e.target.value);
                      setBillItemPage(1);
                    }}
                    className="w-[160px]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{locale === "bg" ? "До" : "To"}</span>
                  <Input
                    type="date"
                    value={billItemDateTo}
                    onChange={(e) => {
                      setBillItemDateTo(e.target.value);
                      setBillItemPage(1);
                    }}
                    className="w-[160px]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={billItemOnlyFallbacks}
                    onCheckedChange={(v) => {
                      setBillItemOnlyFallbacks(Boolean(v));
                      setBillItemPage(1);
                    }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {locale === "bg" ? "Само fallback" : "Only fallbacks"}
                  </span>
                </div>
              </div>

              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{locale === "bg" ? "Фактура" : "Bill"}</TableHead>
                      <TableHead>{locale === "bg" ? "Доставчик" : "Vendor"}</TableHead>
                      <TableHead>{locale === "bg" ? "Локация" : "Location"}</TableHead>
                      <TableHead>{locale === "bg" ? "Артикул" : "Item"}</TableHead>
                      <TableHead className="text-right">{locale === "bg" ? "Сума" : "Amount"}</TableHead>
                      <TableHead>{locale === "bg" ? "Ефективна сметка" : "Effective account"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billItemLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {locale === "bg" ? "Зареждане..." : "Loading..."}
                        </TableCell>
                      </TableRow>
                    ) : billItemRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {locale === "bg" ? "Няма резултати" : "No results"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      billItemRows.map((row, idx) => (
                        <TableRow key={row.id} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                          <TableCell className="text-muted-foreground">
                            <div className="text-sm">
                              {row.billDocNum || `#${row.billId}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.billDocDate || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{row.vendorName || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{row.locationName || "—"}</TableCell>
                          <TableCell className="font-medium">
                            <span className="truncate" title={row.itemName || ""}>
                              {row.itemName || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {formatAmount(row.totalPrice, "BGN")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CoaAccountBadge
                                code={row.effectiveExpenseAccount?.code}
                                name={row.effectiveExpenseAccount?.name}
                                variant="outline"
                              />
                              <Badge variant={getSourceBadgeVariant(row.effectiveExpenseSource)} className="text-xs">
                                {getSourceLabel(row.effectiveExpenseSource, locale)}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {!billItemLoading && billItemTotal > 0 && (
                <DataTablePagination
                  currentPage={billItemPage}
                  pageSize={billItemPageSize}
                  totalItems={billItemTotal}
                  onPageChange={setBillItemPage}
                  onPageSizeChange={(size) => {
                    setBillItemPageSize(size);
                    setBillItemPage(1);
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
