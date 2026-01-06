"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteRecurringTemplate,
  getPendingBillsCount,
  getRecurringTemplates,
  updateRecurringTemplate,
} from "@/lib/actions/recurring-bills";
import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import { useDateFormatter } from "@/lib/i18n/date-formatter";
import { RecurringBillTemplate } from "@/lib/types/bill";
import {
  CalendarClock,
  Edit,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CreateRecurringBillDialog } from "./create-recurring-bill-dialog";
import { GenerateRecurringBillsDialog } from "./generate-recurring-bills-dialog";

interface RecurringBillsTabProps {
  locations: Array<{ id: number; name: string }>;
  vendors: Array<{ id: number; name: string }>;
}

const frequencyLabels: Record<string, { en: string; bg: string }> = {
  weekly: { en: "Weekly", bg: "Седмично" },
  monthly: { en: "Monthly", bg: "Месечно" },
  bimonthly: { en: "Every 2 Months", bg: "На 2 месеца" },
};

const dayOfWeekLabels: Record<number, { en: string; bg: string }> = {
  0: { en: "Sunday", bg: "Неделя" },
  1: { en: "Monday", bg: "Понеделник" },
  2: { en: "Tuesday", bg: "Вторник" },
  3: { en: "Wednesday", bg: "Сряда" },
  4: { en: "Thursday", bg: "Четвъртък" },
  5: { en: "Friday", bg: "Петък" },
  6: { en: "Saturday", bg: "Събота" },
};

export const RecurringBillsTab = ({
  locations,
  vendors,
}: RecurringBillsTabProps) => {
  const { locale } = useLanguage();
  const { formatAmount } = useCurrency();
  const { formatDate } = useDateFormatter();
  const router = useRouter();

  const [templates, setTemplates] = useState<RecurringBillTemplate[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] =
    useState<RecurringBillTemplate | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const [templatesResult, pendingResult] = await Promise.all([
      getRecurringTemplates(),
      getPendingBillsCount(),
    ]);

    if (templatesResult.data) {
      setTemplates(templatesResult.data);
    }
    setPendingCount(pendingResult.count);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async () => {
    if (!templateToDelete) return;

    await deleteRecurringTemplate(templateToDelete);
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
    loadData();
  };

  const handleToggleActive = async (template: RecurringBillTemplate) => {
    await updateRecurringTemplate(template.id, {
      is_active: !template.is_active,
    });
    loadData();
  };

  const handleEditClick = (template: RecurringBillTemplate) => {
    setEditTemplate(template);
    setCreateDialogOpen(true);
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setEditTemplate(null);
    loadData();
  };

  const handleGenerateClose = () => {
    setGenerateDialogOpen(false);
    loadData();
    router.refresh();
  };

  const getScheduleDescription = (template: RecurringBillTemplate) => {
    const lang = locale === "bg" ? "bg" : "en";

    if (template.frequency === "weekly" && template.day_of_week !== null) {
      const day = dayOfWeekLabels[template.day_of_week]?.[lang] || "";
      return locale === "bg" ? `Всеки ${day}` : `Every ${day}`;
    }

    if (
      (template.frequency === "monthly" ||
        template.frequency === "bimonthly") &&
      template.day_of_month !== null
    ) {
      const freq = frequencyLabels[template.frequency][lang];
      return locale === "bg"
        ? `${freq}, ${template.day_of_month}-ти`
        : `${freq}, day ${template.day_of_month}`;
    }

    return frequencyLabels[template.frequency]?.[lang] || template.frequency;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">
            {locale === "bg" ? "Периодични фактури" : "Recurring Bills"}
          </h3>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pendingCount} {locale === "bg" ? "за генериране" : "pending"}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setGenerateDialogOpen(true)}
            >
              <Zap className="h-4 w-4 mr-2" />
              {locale === "bg" ? "Генерирай фактури" : "Generate Bills"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {locale === "bg" ? "Добави шаблон" : "Add Template"}
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarClock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>
            {locale === "bg"
              ? "Няма настроени периодични фактури"
              : "No recurring bill templates configured"}
          </p>
          <Button
            variant="link"
            className="mt-2"
            onClick={() => setCreateDialogOpen(true)}
          >
            {locale === "bg"
              ? "Създай първия шаблон"
              : "Create your first template"}
          </Button>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {locale === "bg" ? "Локация" : "Location"}
                </TableHead>
                <TableHead>
                  {locale === "bg" ? "Доставчик" : "Vendor"}
                </TableHead>
                <TableHead>
                  {locale === "bg" ? "Честота" : "Schedule"}
                </TableHead>
                <TableHead className="text-right">
                  {locale === "bg" ? "Сума" : "Amount"}
                </TableHead>
                <TableHead>
                  {locale === "bg" ? "Следващо генериране" : "Next Generation"}
                </TableHead>
                <TableHead>{locale === "bg" ? "Статус" : "Status"}</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template, index) => (
                <TableRow
                  key={template.id}
                  className={index % 2 === 0 ? "bg-muted/50" : ""}
                >
                  <TableCell className="font-medium">
                    {template.location_name}
                  </TableCell>
                  <TableCell>{template.vendor_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{getScheduleDescription(template)}</span>
                      {template.description && (
                        <span className="text-xs text-muted-foreground">
                          {template.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {template.default_amount > 0
                      ? formatAmount(template.default_amount, "BGN")
                      : locale === "bg"
                      ? "Въведи ръчно"
                      : "Manual entry"}
                  </TableCell>
                  <TableCell>
                    {template.next_generation_date
                      ? formatDate(template.next_generation_date)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={template.is_active ? "default" : "secondary"}
                    >
                      {template.is_active
                        ? locale === "bg"
                          ? "Активен"
                          : "Active"
                        : locale === "bg"
                        ? "Спрян"
                        : "Paused"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEditClick(template)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {locale === "bg" ? "Редактирай" : "Edit"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(template)}
                        >
                          {template.is_active ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              {locale === "bg" ? "Спри" : "Pause"}
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              {locale === "bg" ? "Активирай" : "Activate"}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setTemplateToDelete(template.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {locale === "bg" ? "Изтрий" : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === "bg" ? "Изтриване на шаблон" : "Delete Template"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === "bg"
                ? "Сигурни ли сте, че искате да изтриете този шаблон? Това действие не може да бъде отменено."
                : "Are you sure you want to delete this template? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {locale === "bg" ? "Отказ" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {locale === "bg" ? "Изтрий" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Dialog */}
      <CreateRecurringBillDialog
        open={createDialogOpen}
        onOpenChange={handleDialogClose}
        locations={locations}
        vendors={vendors}
        editTemplate={editTemplate}
      />

      {/* Generate Bills Dialog */}
      <GenerateRecurringBillsDialog
        open={generateDialogOpen}
        onOpenChange={handleGenerateClose}
      />
    </div>
  );
};
