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
import { deleteRawMaterial } from "@/lib/actions/products";
import { useLanguage } from "@/lib/i18n/context";
import { Link2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface RawMaterial {
  id: number;
  name: string;
  unit_of_measure: string;
  current_stock?: number | null;
  reorder_level: number | null;
  is_active?: boolean;
  linked_articles_count?: number;
}

interface RawMaterialsTableProps {
  materials: RawMaterial[];
  onMaterialClick?: (materialId: number) => void;
}

export const RawMaterialsTable = ({
  materials,
  onMaterialClick,
}: RawMaterialsTableProps) => {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<RawMaterial | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent, material: RawMaterial) => {
    e.stopPropagation();
    setMaterialToDelete(material);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!materialToDelete) return;

    setDeleting(true);
    const result = await deleteRawMaterial(materialToDelete.id);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        locale === "bg" ? "Суровината е изтрита" : "Raw material deleted"
      );
      router.refresh();
    }
    setDeleting(false);
    setDeleteDialogOpen(false);
    setMaterialToDelete(null);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{locale === "bg" ? "Име" : "Name"}</TableHead>
          <TableHead>{locale === "bg" ? "Мерна единица" : "Unit"}</TableHead>
          <TableHead>
            {locale === "bg" ? "Наличност" : "Current Stock"}
          </TableHead>
          <TableHead>
            {locale === "bg" ? "Минимално ниво" : "Reorder Level"}
          </TableHead>
          <TableHead>
            {locale === "bg" ? "Barsy връзки" : "Barsy Links"}
          </TableHead>
          <TableHead className="text-center">
            {locale === "bg" ? "Действия" : "Actions"}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className="text-center text-muted-foreground"
            >
              {locale === "bg"
                ? "Няма намерени суровини"
                : "No raw materials found"}
            </TableCell>
          </TableRow>
        ) : (
          materials.map((m, idx) => (
            <TableRow
              key={m.id}
              className={`${idx % 2 === 0 ? "bg-muted/30" : ""} ${
                onMaterialClick ? "cursor-pointer hover:bg-muted/50" : ""
              }`}
              onClick={() => onMaterialClick?.(m.id)}
            >
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>{m.unit_of_measure}</TableCell>
              <TableCell>{m.current_stock?.toFixed(2) || "0.00"}</TableCell>
              <TableCell>{m.reorder_level?.toFixed(2) || "—"}</TableCell>
              <TableCell>
                {m.linked_articles_count !== undefined &&
                m.linked_articles_count > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    <Link2 className="h-3 w-3 mr-1" />
                    {m.linked_articles_count}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={(e) => handleDeleteClick(e, m)}
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
        title={t("products.deleteRawMaterialConfirm")}
        description={
          materialToDelete
            ? `${t("products.deleteRawMaterialDescriptionNamed").replace(
                "{name}",
                materialToDelete.name
              )}`
            : t("products.deleteRawMaterialDescription")
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
