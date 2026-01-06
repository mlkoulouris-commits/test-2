"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createManualBill,
  getBillLocations,
  getVendorsWithAccounts,
} from "@/lib/actions/bills";
import { useLanguage } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  BookOpen,
  CalendarIcon,
  Check,
  ChevronsUpDown,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountSelector } from "./account-selector";

interface BillItem {
  id: string;
  articleName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string;
  accountId: number | null;
  vatRate: number | null;
  vatAmount: number | null;
}

interface VendorWithAccount {
  id: number;
  name: string;
  default_account_id: number | null;
  default_account_code: string | null;
  default_account_name: string | null;
}

export const CreateManualBillDialog = () => {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [locations, setLocations] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [vendors, setVendors] = useState<VendorWithAccount[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [openVendor, setOpenVendor] = useState(false);
  const [openDocDate, setOpenDocDate] = useState(false);
  const [openDueDate, setOpenDueDate] = useState(false);
  const [openPeriodDate, setOpenPeriodDate] = useState(false);
  const [docNum, setDocNum] = useState("");
  const [docDate, setDocDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [periodDateRange, setPeriodDateRange] = useState<{
    from: Date | undefined;
    to?: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<BillItem[]>([
    {
      id: "1",
      articleName: "",
      quantity: 0,
      unitPrice: 0,
      totalPrice: 0,
      notes: "",
      accountId: null,
      vatRate: null,
      vatAmount: null,
    },
  ]);
  // Account selection
  const [billAccountId, setBillAccountId] = useState<number | null>(null);
  const [showItemAccounts, setShowItemAccounts] = useState(false);
  // VAT fields
  const [hasVat, setHasVat] = useState(false);
  const [billVatRate, setBillVatRate] = useState<number | null>(null);
  const [billVatAmount, setBillVatAmount] = useState<number | null>(null);
  const [vatMode, setVatMode] = useState<"bill" | "items">("bill");

  const loadData = async () => {
    const [locationsResult, vendorsResult] = await Promise.all([
      getBillLocations(),
      getVendorsWithAccounts(),
    ]);

    if (locationsResult.data) {
      setLocations(locationsResult.data);

      // Load saved location from localStorage
      if (!selectedLocationId) {
        const savedLocationId = localStorage.getItem("bill-location-id");
        if (savedLocationId) {
          const locationExists = locationsResult.data.some(
            (loc) => loc.id.toString() === savedLocationId
          );
          if (locationExists) {
            setSelectedLocationId(savedLocationId);
          }
        }
      }
    }

    if (vendorsResult.data) {
      setVendors(vendorsResult.data as VendorWithAccount[]);
    }
  };

  // Load saved location from localStorage when locations are available (backup)
  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      const savedLocationId = localStorage.getItem("bill-location-id");
      if (savedLocationId) {
        const locationExists = locations.some(
          (loc) => loc.id.toString() === savedLocationId
        );
        if (locationExists) {
          setSelectedLocationId(savedLocationId);
        }
      }
    }
  }, [locations, selectedLocationId]);

  // When vendor changes, set default account if vendor has one
  useEffect(() => {
    if (selectedVendorId) {
      const vendor = vendors.find((v) => v.id === selectedVendorId);
      if (vendor?.default_account_id && !billAccountId) {
        setBillAccountId(vendor.default_account_id);
      }
    }
  }, [selectedVendorId, vendors]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      loadData();
    } else {
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedLocationId(null);
    setSelectedVendorId(null);
    setOpenVendor(false);
    setOpenDocDate(false);
    setOpenDueDate(false);
    setOpenPeriodDate(false);
    setDocNum("");
    setDocDate(new Date());
    setDueDate(undefined);
    setPeriodDateRange({ from: undefined, to: undefined });
    setDescription("");
    setItems([
      {
        id: "1",
        articleName: "",
        quantity: 0,
        unitPrice: 0,
        totalPrice: 0,
        notes: "",
        accountId: null,
        vatRate: null,
        vatAmount: null,
      },
    ]);
    setBillAccountId(null);
    setShowItemAccounts(false);
    setHasVat(false);
    setBillVatRate(null);
    setBillVatAmount(null);
    setVatMode("bill");
    setError("");
    setIsLoading(false);
  };

  const addItem = () => {
    const newId = (
      Math.max(...items.map((i) => parseInt(i.id))) + 1
    ).toString();
    setItems([
      ...items,
      {
        id: newId,
        articleName: "",
        quantity: 0,
        unitPrice: 0,
        totalPrice: 0,
        notes: "",
        accountId: null,
        vatRate: null,
        vatAmount: null,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (
    id: string,
    field: keyof BillItem,
    value: string | number | null
  ) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item };

        if (field === "accountId") {
          updated.accountId = value === 0 ? null : (value as number | null);
        } else {
          (updated as Record<string, unknown>)[field] = value;
        }

        // Auto-calculate total price
        if (field === "quantity" || field === "unitPrice") {
          updated.totalPrice =
            Number(updated.quantity) * Number(updated.unitPrice);
        }

        // Auto-calculate VAT amount when VAT rate changes
        if (field === "vatRate" && updated.vatRate !== null && updated.totalPrice > 0) {
          updated.vatAmount = (updated.totalPrice * Number(updated.vatRate)) / 100;
        } else if (field === "totalPrice" && updated.vatRate !== null && updated.totalPrice > 0) {
          updated.vatAmount = (updated.totalPrice * Number(updated.vatRate)) / 100;
        }

        return updated;
      })
    );
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + Number(item.totalPrice || 0),
    0
  );

  // Calculate bill-level VAT when rate or total changes
  useEffect(() => {
    if (hasVat && vatMode === "bill" && billVatRate !== null && totalAmount > 0) {
      setBillVatAmount((totalAmount * billVatRate) / 100);
    } else if (!hasVat || vatMode !== "bill") {
      setBillVatAmount(null);
    }
  }, [hasVat, vatMode, billVatRate, totalAmount]);

  const totalVatAmount = vatMode === "bill"
    ? (billVatAmount || 0)
    : items.reduce((sum, item) => sum + Number(item.vatAmount || 0), 0);

  const grandTotal = totalAmount + totalVatAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedLocationId) {
      setError("Please select a location");
      return;
    }

    if (!selectedVendorId) {
      setError("Please select a vendor");
      return;
    }

    if (!docNum.trim()) {
      setError("Please enter a document number");
      return;
    }

    if (items.length === 0 || items.every((item) => !item.articleName.trim())) {
      setError("Please add at least one item");
      return;
    }

    if (totalAmount <= 0) {
      setError("Total amount must be greater than 0");
      return;
    }

    setIsLoading(true);

    const validItems = items
      .filter((item) => item.articleName.trim())
      .map(({ id, ...item }) => ({
        articleName: item.articleName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        notes: item.notes,
        accountId: item.accountId,
        vatRate: vatMode === "items" ? item.vatRate : null,
        vatAmount: vatMode === "items" ? item.vatAmount : null,
      }));

    const result = await createManualBill(
      selectedLocationId,
      selectedVendorId,
      docNum,
      format(docDate, "yyyy-MM-dd"),
      dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      totalAmount,
      description || null,
      validItems,
      periodDateRange.from ? format(periodDateRange.from, "yyyy-MM-dd") : null,
      periodDateRange.to ? format(periodDateRange.to, "yyyy-MM-dd") : null,
      billAccountId,
      hasVat,
      vatMode === "bill" ? billVatRate : null,
      vatMode === "bill" ? billVatAmount : null
    );

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setOpen(false);
      resetForm();
      router.refresh();
    }
  };

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Manual Bill
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-5xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create Manual Bill</DialogTitle>
          <DialogDescription>
            Enter bill details and line items manually
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-grow overflow-hidden"
        >
          <div className="flex-grow overflow-y-auto pr-2 space-y-6">
            {/* Basic Information */}
            <div className="grid gap-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="location">Location *</Label>
                  <Select
                    value={selectedLocationId || ""}
                    onValueChange={(value) => {
                      setSelectedLocationId(value);
                      // Save to localStorage
                      localStorage.setItem("bill-location-id", value);
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem
                          key={location.id}
                          value={location.id.toString()}
                        >
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="vendor">Vendor *</Label>
                  <Popover open={openVendor} onOpenChange={setOpenVendor}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openVendor}
                        className="w-full justify-between"
                        disabled={isLoading}
                      >
                        {selectedVendor ? selectedVendor.name : "Select vendor"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search vendor..." />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>No vendor found.</CommandEmpty>
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

                <div className="grid gap-2">
                  <Label htmlFor="docNum">Document Number *</Label>
                  <Input
                    id="docNum"
                    value={docNum}
                    onChange={(e) => setDocNum(e.target.value)}
                    placeholder="INV-001"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="docDate">Document Date *</Label>
                  <Popover open={openDocDate} onOpenChange={setOpenDocDate}>
                    <PopoverTrigger asChild>
                      <Button
                        id="docDate"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !docDate && "text-muted-foreground"
                        )}
                        disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {docDate ? (
                          format(docDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={docDate}
                        onSelect={(date) => {
                          if (date) {
                            setDocDate(date);
                            setOpenDocDate(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Popover open={openDueDate} onOpenChange={setOpenDueDate}>
                    <PopoverTrigger asChild>
                      <Button
                        id="dueDate"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dueDate && "text-muted-foreground"
                        )}
                        disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? (
                          format(dueDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={(date) => {
                          setDueDate(date);
                          setOpenDueDate(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="periodDate">Billing Period (Optional)</Label>
                  <Popover
                    open={openPeriodDate}
                    onOpenChange={setOpenPeriodDate}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        id="periodDate"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !periodDateRange.from && "text-muted-foreground"
                        )}
                        disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {periodDateRange.from ? (
                          periodDateRange.to ? (
                            <>
                              {format(periodDateRange.from, "LLL dd, y")} -{" "}
                              {format(periodDateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(periodDateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={periodDateRange}
                        onSelect={(range) => {
                          setPeriodDateRange(
                            range || { from: undefined, to: undefined }
                          );
                        }}
                        numberOfMonths={2}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    For utility bills or recurring expenses - what period does
                    this bill cover?
                  </p>
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label>Subtotal</Label>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 pt-2">
                    {totalAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    лв.
                  </div>
                </div>
              </div>

              {/* VAT Section */}
              <div className="grid gap-4 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasVat"
                    checked={hasVat}
                    onChange={(e) => {
                      setHasVat(e.target.checked);
                      if (!e.target.checked) {
                        setBillVatRate(null);
                        setBillVatAmount(null);
                        setVatMode("bill");
                        // Clear item VAT when disabling VAT
                        setItems(items.map(item => ({ ...item, vatRate: null, vatAmount: null })));
                      }
                    }}
                    className="h-4 w-4"
                    disabled={isLoading}
                  />
                  <Label htmlFor="hasVat" className="font-semibold text-amber-900 dark:text-amber-100 cursor-pointer">
                    This bill has VAT
                  </Label>
                </div>

                {hasVat && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>VAT Mode</Label>
                      <Select
                        value={vatMode}
                        onValueChange={(value: "bill" | "items") => {
                          setVatMode(value);
                          if (value === "bill") {
                            // Clear item VAT
                            setItems(items.map(item => ({ ...item, vatRate: null, vatAmount: null })));
                          } else {
                            // Clear bill VAT
                            setBillVatRate(null);
                            setBillVatAmount(null);
                          }
                        }}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bill">Apply VAT to entire bill</SelectItem>
                          <SelectItem value="items">Apply VAT per item</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {vatMode === "bill" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="billVatRate">VAT Rate (%)</Label>
                          <Input
                            id="billVatRate"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={billVatRate || ""}
                            onChange={(e) => {
                              const rate = e.target.value ? parseFloat(e.target.value) : null;
                              setBillVatRate(rate);
                            }}
                            placeholder="20.00"
                            disabled={isLoading}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="billVatAmount">VAT Amount</Label>
                          <Input
                            id="billVatAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={billVatAmount || ""}
                            onChange={(e) => {
                              const amount = e.target.value ? parseFloat(e.target.value) : null;
                              setBillVatAmount(amount);
                            }}
                            placeholder="0.00"
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Set VAT rate for each item in the line items table below
                      </p>
                    )}

                    {hasVat && totalVatAmount > 0 && (
                      <div className="grid gap-2">
                        <Label>Total VAT</Label>
                        <div className="text-xl font-semibold text-amber-700 dark:text-amber-300">
                          {totalVatAmount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          лв.
                        </div>
                      </div>
                    )}

                    {hasVat && grandTotal > 0 && (
                      <div className="grid gap-2 border-t pt-4">
                        <Label>Grand Total (Subtotal + VAT)</Label>
                        <div className="text-2xl font-bold text-amber-800 dark:text-amber-200">
                          {grandTotal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          лв.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional notes..."
                  disabled={isLoading}
                  rows={2}
                />
              </div>
            </div>

            {/* Chart of Accounts */}
            <div className="grid gap-4 p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                    {locale === "bg"
                      ? "Сметка от сметкоплан"
                      : "Chart of Accounts"}
                  </h3>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowItemAccounts(!showItemAccounts)}
                  className="text-xs"
                >
                  {showItemAccounts
                    ? locale === "bg"
                      ? "Скрий сметки по артикули"
                      : "Hide item accounts"
                    : locale === "bg"
                    ? "Задай сметки по артикули"
                    : "Set accounts per item"}
                </Button>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <AccountSelector
                    value={billAccountId}
                    onChange={setBillAccountId}
                    label={
                      locale === "bg"
                        ? "Сметка (за цялата фактура)"
                        : "Account (for entire bill)"
                    }
                    placeholder={
                      locale === "bg" ? "Избери сметка..." : "Select account..."
                    }
                    disabled={isLoading}
                  />
                  {selectedVendor?.default_account_name && !billAccountId && (
                    <p className="text-xs text-muted-foreground">
                      {locale === "bg"
                        ? "Използвана сметка по подразбиране за доставчика:"
                        : "Using vendor default account:"}{" "}
                      <span className="font-medium">
                        {selectedVendor.default_account_code} -{" "}
                        {selectedVendor.default_account_name}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="grid gap-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Line Items</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addItem}
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Item Name *</TableHead>
                      <TableHead className="w-[100px] text-right">
                        Quantity *
                      </TableHead>
                      <TableHead className="w-[100px] text-right">
                        Unit Price *
                      </TableHead>
                      <TableHead className="w-[100px] text-right">
                        Total
                      </TableHead>
                      {hasVat && vatMode === "items" && (
                        <>
                          <TableHead className="w-[100px] text-right">
                            VAT Rate (%)
                          </TableHead>
                          <TableHead className="w-[100px] text-right">
                            VAT Amount
                          </TableHead>
                        </>
                      )}
                      {showItemAccounts && (
                        <TableHead className="w-[200px]">
                          {locale === "bg" ? "Сметка" : "Account"}
                        </TableHead>
                      )}
                      <TableHead className="w-[150px]">Notes</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Input
                            value={item.articleName}
                            onChange={(e) =>
                              updateItem(item.id, "articleName", e.target.value)
                            }
                            placeholder="Item name"
                            disabled={isLoading}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={item.quantity || ""}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "quantity",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="text-right"
                            disabled={isLoading}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice || ""}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "unitPrice",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="text-right"
                            disabled={isLoading}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {item.totalPrice.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          лв.
                        </TableCell>
                        {hasVat && vatMode === "items" && (
                          <>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={item.vatRate || ""}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "vatRate",
                                    e.target.value ? parseFloat(e.target.value) : null
                                  )
                                }
                                placeholder="20.00"
                                className="text-right"
                                disabled={isLoading}
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium whitespace-nowrap">
                              {(item.vatAmount || 0).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              лв.
                            </TableCell>
                          </>
                        )}
                        {showItemAccounts && (
                          <TableCell>
                            <AccountSelector
                              value={item.accountId}
                              onChange={(accountId) =>
                                updateItem(item.id, "accountId", accountId || 0)
                              }
                              placeholder={
                                locale === "bg" ? "По подр." : "Default"
                              }
                              disabled={isLoading}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Input
                            value={item.notes}
                            onChange={(e) =>
                              updateItem(item.id, "notes", e.target.value)
                            }
                            placeholder="Optional notes"
                            disabled={isLoading}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => removeItem(item.id)}
                            disabled={isLoading || items.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-destructive text-sm mt-4 px-4 flex-shrink-0">
              {error}
            </div>
          )}

          <DialogFooter className="flex-shrink-0 p-4 bg-background border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating Bill..." : "Create Bill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
