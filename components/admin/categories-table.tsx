"use client";

import { AlertDialogConfirm } from "@/components/ui/alert-dialog-confirm";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteProductCategory } from "@/lib/actions/products";
import { useLanguage } from "@/lib/i18n/context";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface Category {
  id: number;
  name: string;
  parent_id?: number | null;
}

interface CategoriesTableProps {
  categories: Category[];
}

export const CategoriesTable = ({ categories }: CategoriesTableProps) => {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent, category: Category) => {
    e.stopPropagation();
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    setDeleting(true);
    const result = await deleteProductCategory(categoryToDelete.id);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        locale === "bg" ? "Категорията е изтрита" : "Category deleted"
      );
      router.refresh();
    }
    setDeleting(false);
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  // Helper function to get parent category name
  const getParentName = (parentId: number | null | undefined) => {
    if (!parentId) return "—";
    const parent = categories.find((c) => c.id === parentId);
    return parent ? parent.name : "—";
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{locale === "bg" ? "Име" : "Name"}</TableHead>
          <TableHead>
            {locale === "bg" ? "Родителска категория" : "Parent Category"}
          </TableHead>
          <TableHead className="text-center">
            {locale === "bg" ? "Действия" : "Actions"}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={3}
              className="text-center text-muted-foreground"
            >
              {locale === "bg"
                ? "Няма намерени категории"
                : "No categories found"}
            </TableCell>
          </TableRow>
        ) : (
          categories.map((c, idx) => (
            <TableRow
              key={c.id}
              className={idx % 2 === 0 ? "bg-muted/30" : ""}
            >
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {getParentName(c.parent_id)}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={(e) => handleDeleteClick(e, c)}
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
        title={t("products.deleteCategoryConfirm")}
        description={
          categoryToDelete
            ? `${t("products.deleteCategoryDescriptionNamed").replace(
                "{name}",
                categoryToDelete.name
              )}`
            : t("products.deleteCategoryDescription")
        }
        confirmText={
          deleting ? t("products.deleting") : t("common.delete")
        }
        cancelText={t("common.cancel")}
        variant="destructive"
      />
    </Table>
  );
};
