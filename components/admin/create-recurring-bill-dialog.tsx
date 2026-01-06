"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createRecurringTemplate,
  updateRecurringTemplate,
} from "@/lib/actions/recurring-bills";
import { useLanguage } from "@/lib/i18n/context";
import {
  CreateRecurringTemplateInput,
  RecurringBillTemplate,
  RecurringFrequency,
} from "@/lib/types/bill";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountSelector } from "./account-selector";

interface CreateRecurringBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Array<{ id: number; name: string }>;
  vendors: Array<{ id: number; name: string }>;
  editTemplate?: RecurringBillTemplate | null;
}

const frequencies: {
  value: RecurringFrequency;
  labelEn: string;
  labelBg: string;
}[] = [
  { value: "weekly", labelEn: "Weekly", labelBg: "Седмично" },
  { value: "monthly", labelEn: "Monthly", labelBg: "Месечно" },
  {
    value: "bimonthly",
    labelEn: "Every 2 Months",
    labelBg: "На всеки 2 месеца",
  },
];

const daysOfWeek = [
  { value: 1, labelEn: "Monday", labelBg: "Понеделник" },
  { value: 2, labelEn: "Tuesday", labelBg: "Вторник" },
  { value: 3, labelEn: "Wednesday", labelBg: "Сряда" },
  { value: 4, labelEn: "Thursday", labelBg: "Четвъртък" },
  { value: 5, labelEn: "Friday", labelBg: "Петък" },
  { value: 6, labelEn: "Saturday", labelBg: "Събота" },
  { value: 0, labelEn: "Sunday", labelBg: "Неделя" },
];

export const CreateRecurringBillDialog = ({
  open,
  onOpenChange,
  locations,
  vendors,
  editTemplate,
}: CreateRecurringBillDialogProps) => {
  const { locale } = useLanguage();
  const isEditing = !!editTemplate;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [openVendor, setOpenVendor] = useState(false);
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [defaultAmount, setDefaultAmount] = useState<string>("");
  const [description, setDescription] = useState("");
  const [dueDateOffset, setDueDateOffset] = useState<number>(0);
  const [accountId, setAccountId] = useState<number | null>(null);

  // Reset form when dialog opens/closes or editTemplate changes
  useEffect(() => {
    if (open) {
      if (editTemplate) {
        setSelectedLocationId(editTemplate.location_id);
        setSelectedVendorId(editTemplate.vendor_id);
        setFrequency(editTemplate.frequency);
        setDayOfWeek(editTemplate.day_of_week ?? 1);
        setDayOfMonth(editTemplate.day_of_month ?? 1);
        setDefaultAmount(
          editTemplate.default_amount > 0
            ? editTemplate.default_amount.toString()
            : ""
        );
        setDescription(editTemplate.description || "");
        setDueDateOffset(editTemplate.due_date_offset);
        setAccountId(editTemplate.account_id);
      } else {
        resetForm();
      }
    }
  }, [open, editTemplate]);

  const resetForm = () => {
    setSelectedLocationId(null);
    setSelectedVendorId(null);
    setOpenVendor(false);
    setFrequency("monthly");
    setDayOfWeek(1);
    setDayOfMonth(1);
    setDefaultAmount("");
    setDescription("");
    setDueDateOffset(0);
    setAccountId(null);
    setError("");
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isEditing) {
      if (!selectedLocationId) {
        setError(
          locale === "bg"
            ? "Моля, изберете локация"
            : "Please select a location"
        );
        return;
      }

      if (!selectedVendorId) {
        setError(
          locale === "bg"
            ? "Моля, изберете доставчик"
            : "Please select a vendor"
        );
        return;
      }
    }

    setIsLoading(true);

    if (isEditing && editTemplate) {
      // Update existing template
      const result = await updateRecurringTemplate(editTemplate.id, {
        frequency,
        day_of_week: frequency === "weekly" ? dayOfWeek : null,
        day_of_month: frequency !== "weekly" ? dayOfMonth : null,
        default_amount: defaultAmount ? parseFloat(defaultAmount) : 0,
        description: description || null,
        due_date_offset: dueDateOffset,
        account_id: accountId,
      });

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
    } else {
      // Create new template
      const input: CreateRecurringTemplateInput = {
        location_id: selectedLocationId!,
        vendor_id: selectedVendorId!,
        frequency,
        day_of_week: frequency === "weekly" ? dayOfWeek : null,
        day_of_month: frequency !== "weekly" ? dayOfMonth : null,
        default_amount: defaultAmount ? parseFloat(defaultAmount) : 0,
        description: description || null,
        due_date_offset: dueDateOffset,
        account_id: accountId,
      };

      const result = await createRecurringTemplate(input);

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
    }

    onOpenChange(false);
    resetForm();
  };

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? locale === "bg"
                ? "Редактирай шаблон"
                : "Edit Template"
              : locale === "bg"
              ? "Нов периодичен шаблон"
              : "New Recurring Template"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? locale === "bg"
                ? "Промени настройките на периодичния шаблон"
                : "Update the recurring bill template settings"
              : locale === "bg"
              ? "Настрой автоматично генериране на фактури"
              : "Set up automatic bill generation for a vendor"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Location - disabled when editing */}
          <div className="grid gap-2">
            <Label htmlFor="location">
              {locale === "bg" ? "Локация" : "Location"} *
            </Label>
            <Select
              value={selectedLocationId?.toString() || ""}
              onValueChange={(value) => setSelectedLocationId(parseInt(value))}
              disabled={isLoading || isEditing}
            >
              <SelectTrigger id="location">
                <SelectValue
                  placeholder={
                    locale === "bg" ? "Избери локация" : "Select location"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vendor - disabled when editing */}
          <div className="grid gap-2">
            <Label htmlFor="vendor">
              {locale === "bg" ? "Доставчик" : "Vendor"} *
            </Label>
            <Popover open={openVendor} onOpenChange={setOpenVendor}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openVendor}
                  className="w-full justify-between"
                  disabled={isLoading || isEditing}
                >
                  {selectedVendor
                    ? selectedVendor.name
                    : locale === "bg"
                    ? "Избери доставчик"
                    : "Select vendor"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={
                      locale === "bg"
                        ? "Търси доставчик..."
                        : "Search vendor..."
                    }
                  />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>
                      {locale === "bg"
                        ? "Няма намерен доставчик."
                        : "No vendor found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {vendors.map((vendor) => (
                        <CommandItem
                          key={vendor.id}
                          value={vendor.name}
                          onSelect={() => {
                            setSelectedVendorId(vendor.id);
                            setOpenVendor(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedVendorId === vendor.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {vendor.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Frequency */}
          <div className="grid gap-2">
            <Label htmlFor="frequency">
              {locale === "bg" ? "Честота" : "Frequency"} *
            </Label>
            <Select
              value={frequency}
              onValueChange={(value) =>
                setFrequency(value as RecurringFrequency)
              }
              disabled={isLoading}
            >
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencies.map((freq) => (
                  <SelectItem key={freq.value} value={freq.value}>
                    {locale === "bg" ? freq.labelBg : freq.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Day of Week - for weekly */}
          {frequency === "weekly" && (
            <div className="grid gap-2">
              <Label htmlFor="dayOfWeek">
                {locale === "bg" ? "Ден от седмицата" : "Day of Week"} *
              </Label>
              <Select
                value={dayOfWeek.toString()}
                onValueChange={(value) => setDayOfWeek(parseInt(value))}
                disabled={isLoading}
              >
                <SelectTrigger id="dayOfWeek">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {daysOfWeek.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {locale === "bg" ? day.labelBg : day.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day of Month - for monthly/bimonthly */}
          {frequency !== "weekly" && (
            <div className="grid gap-2">
              <Label htmlFor="dayOfMonth">
                {locale === "bg" ? "Ден от месеца" : "Day of Month"} *
              </Label>
              <Select
                value={dayOfMonth.toString()}
                onValueChange={(value) => setDayOfMonth(parseInt(value))}
                disabled={isLoading}
              >
                <SelectTrigger id="dayOfMonth">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {locale === "bg"
                  ? "Максимум 28 за да се избегнат проблеми с февруари"
                  : "Maximum 28 to avoid issues with February"}
              </p>
            </div>
          )}

          {/* Default Amount */}
          <div className="grid gap-2">
            <Label htmlFor="defaultAmount">
              {locale === "bg" ? "Сума по подразбиране" : "Default Amount"}
            </Label>
            <Input
              id="defaultAmount"
              type="number"
              step="0.01"
              min="0"
              value={defaultAmount}
              onChange={(e) => setDefaultAmount(e.target.value)}
              placeholder={
                locale === "bg" ? "0.00 (въведи ръчно)" : "0.00 (manual entry)"
              }
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {locale === "bg"
                ? "Остави празно или 0 ако сумата се различава всеки път"
                : "Leave empty or 0 if amount varies each time"}
            </p>
          </div>

          {/* Due Date Offset */}
          <div className="grid gap-2">
            <Label htmlFor="dueDateOffset">
              {locale === "bg"
                ? "Дни до падеж (след края на периода)"
                : "Days until due (after period end)"}
            </Label>
            <Input
              id="dueDateOffset"
              type="number"
              min="0"
              max="90"
              value={dueDateOffset}
              onChange={(e) => setDueDateOffset(parseInt(e.target.value) || 0)}
              disabled={isLoading}
            />
          </div>

          {/* Account */}
          <AccountSelector
            value={accountId}
            onChange={setAccountId}
            label={
              locale === "bg" ? "Сметка от сметкоплан" : "Chart of Accounts"
            }
            placeholder={
              locale === "bg" ? "Избери сметка..." : "Select account..."
            }
            disabled={isLoading}
          />

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">
              {locale === "bg" ? "Описание" : "Description"}
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                locale === "bg"
                  ? "напр. Месечен наем, Ток, Вода..."
                  : "e.g., Monthly rent, Electricity, Water..."
              }
              disabled={isLoading}
              rows={2}
            />
          </div>

          {error && <div className="text-destructive text-sm">{error}</div>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {locale === "bg" ? "Отказ" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? locale === "bg"
                  ? "Запазване..."
                  : "Saving..."
                : isEditing
                ? locale === "bg"
                  ? "Запази промените"
                  : "Save Changes"
                : locale === "bg"
                ? "Създай шаблон"
                : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
