"use client";

import { AlertDialogConfirm } from "@/components/ui/alert-dialog-confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteProduct, toggleProductStatus } from "@/lib/actions/products";
import { useLanguage } from "@/lib/i18n/context";
import { Link2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  selling_price: number | null;
  is_active: boolean;
  product_categories: { id: number; name: string } | null;
  linked_articles_count?: number;
}

interface ProductsTableProps {
  products: Product[];
  onProductClick?: (productId: number) => void;
}

export const ProductsTable = ({
  products,
  onProductClick,
}: ProductsTableProps) => {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleToggle = async (id: number, status: boolean) => {
    await toggleProductStatus(id, !status);
    router.refresh();
  };

  const handleDeleteClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    setDeleting(true);
    const result = await deleteProduct(productToDelete.id);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(locale === "bg" ? "Продуктът е изтрит" : "Product deleted");
      router.refresh();
    }
    setDeleting(false);
    setProductToDelete(null);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{locale === "bg" ? "Име" : "Name"}</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>{locale === "bg" ? "Категория" : "Category"}</TableHead>
          <TableHead>{locale === "bg" ? "Цена" : "Price"}</TableHead>
          <TableHead>
            {locale === "bg" ? "Barsy връзки" : "Barsy Links"}
          </TableHead>
          <TableHead>{locale === "bg" ? "Статус" : "Status"}</TableHead>
          <TableHead className="text-center">
            {locale === "bg" ? "Действия" : "Actions"}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="text-center text-muted-foreground"
            >
              {locale === "bg" ? "Няма намерени продукти" : "No products found"}
            </TableCell>
          </TableRow>
        ) : (
          products.map((p, idx) => (
            <TableRow
              key={p.id}
              className={`${idx % 2 === 0 ? "bg-muted/30" : ""} ${
                onProductClick ? "cursor-pointer hover:bg-muted/50" : ""
              }`}
              onClick={() => onProductClick?.(p.id)}
            >
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {p.sku || "—"}
              </TableCell>
              <TableCell>
                {p.product_categories ? (
                  <Badge variant="outline">{p.product_categories.name}</Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {p.selling_price ? `${p.selling_price.toFixed(2)} BGN` : "—"}
              </TableCell>
              <TableCell>
                {p.linked_articles_count !== undefined &&
                p.linked_articles_count > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    <Link2 className="h-3 w-3 mr-1" />
                    {p.linked_articles_count}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={p.is_active ? "default" : "secondary"}>
                  {p.is_active
                    ? locale === "bg"
                      ? "Активен"
                      : "Active"
                    : locale === "bg"
                    ? "Неактивен"
                    : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-28"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(p.id, p.is_active);
                    }}
                  >
                    {p.is_active
                      ? locale === "bg"
                        ? "Деактивирай"
                        : "Deactivate"
                      : locale === "bg"
                      ? "Активирай"
                      : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={(e) => handleDeleteClick(e, p)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>

      <AlertDialogConfirm
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t("products.deleteConfirm")}
        description={
          productToDelete
            ? `${t("products.deleteDescriptionNamed").replace(
                "{name}",
                productToDelete.name
              )}`
            : t("products.deleteDescription")
        }
        confirmText={deleting ? t("products.deleting") : t("common.delete")}
        cancelText={t("common.cancel")}
        variant="destructive"
      />
    </Table>
  );
};
