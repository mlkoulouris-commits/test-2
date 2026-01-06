"use client";

import { InventoryComparisonTable } from "@/components/dashboard/inventory-comparison-table";
import { InventorySummaryCards } from "@/components/dashboard/inventory-summary";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { getBarsyLocations } from "@/lib/actions/barsy-sync";
import {
  calculateInventoryAsOfDate,
  compareInventory,
  createInventorySnapshot,
  fetchBarsySnapshot,
  getInventorySummary,
  InventoryComparison,
  InventorySummary,
} from "@/lib/actions/inventory";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Camera, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface BarsyLocation {
  id: string;
  name: string;
}

export default function InventoryPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const [locations, setLocations] = useState<BarsyLocation[]>([]);
  const [calculatedInventory, setCalculatedInventory] = useState<
    InventoryComparison[]
  >([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingBarsy, setFetchingBarsy] = useState(false);
  const [hasBarsySnapshot, setHasBarsySnapshot] = useState(false);

  // Load locations on mount
  useEffect(() => {
    async function loadLocations() {
      try {
        const result = await getBarsyLocations();
        if (result.success && result.data) {
          setLocations(
            result.data.map((loc: any) => ({ id: loc.id, name: loc.name }))
          );
          if (result.data.length === 1) {
            setSelectedLocationId(result.data[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to load locations:", error);
        toast.error("Failed to load locations");
      }
    }
    loadLocations();
  }, []);

  // Calculate inventory when date or location changes
  useEffect(() => {
    if (selectedLocationId && selectedDate) {
      handleCalculateInventory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId, selectedDate]);

  async function handleCalculateInventory() {
    if (!selectedLocationId || !selectedDate) return;

    setLoading(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Calculate inventory
      const calculatedResult = await calculateInventoryAsOfDate(
        selectedLocationId,
        dateStr
      );

      if (!calculatedResult.success || !calculatedResult.data) {
        toast.error(calculatedResult.error || "Failed to calculate inventory");
        return;
      }

      // If we have Barsy snapshot, compare; otherwise just show calculated
      if (hasBarsySnapshot) {
        const barsyResult = await fetchBarsySnapshot(
          selectedLocationId,
          dateStr
        );
        if (barsyResult.success && barsyResult.data) {
          const comparison = await compareInventory(
            calculatedResult.data,
            barsyResult.data
          );
          setCalculatedInventory(comparison);
          const summaryData = await getInventorySummary(
            calculatedResult.data,
            barsyResult.data
          );
          setSummary(summaryData);
        } else {
          // Fallback to calculated only
          const comparison = calculatedResult.data.map((item) => ({
            ...item,
            barsy_quantity: null,
            barsy_cost_price: null,
            barsy_total_value: null,
            quantity_variance: null,
            value_variance: null,
          }));
          setCalculatedInventory(comparison);
          const summaryData = await getInventorySummary(calculatedResult.data);
          setSummary(summaryData);
        }
      } else {
        // Show calculated only
        const comparison = calculatedResult.data.map((item) => ({
          ...item,
          barsy_quantity: null,
          barsy_cost_price: null,
          barsy_total_value: null,
          quantity_variance: null,
          value_variance: null,
        }));
        setCalculatedInventory(comparison);
        const summaryData = await getInventorySummary(calculatedResult.data);
        setSummary(summaryData);
      }
    } catch (error) {
      toast.error("Failed to calculate inventory");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchBarsySnapshot() {
    if (!selectedLocationId || !selectedDate) {
      toast.error("Please select a location and date");
      return;
    }

    setFetchingBarsy(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const result = await fetchBarsySnapshot(selectedLocationId, dateStr);

      if (!result.success) {
        toast.error(result.error || "Failed to fetch Barsy snapshot");
        console.error("Barsy snapshot fetch error:", result.error);
        return;
      }

      if (!result.data) {
        toast.error("No data returned from Barsy snapshot");
        return;
      }

      // Compare with calculated
      const calculatedResult = await calculateInventoryAsOfDate(
        selectedLocationId,
        dateStr
      );
      
      if (!calculatedResult.success || !calculatedResult.data) {
        toast.error(
          calculatedResult.error || "Failed to calculate inventory for comparison"
        );
        return;
      }

      const comparison = await compareInventory(
        calculatedResult.data,
        result.data
      );
      setCalculatedInventory(comparison);
      const summaryData = await getInventorySummary(
        calculatedResult.data,
        result.data
      );
      setSummary(summaryData);
      setHasBarsySnapshot(true);
      toast.success("Barsy snapshot fetched and compared");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to fetch Barsy snapshot: ${errorMessage}`);
      console.error("Error fetching Barsy snapshot:", error);
    } finally {
      setFetchingBarsy(false);
    }
  }

  async function handleCreateSnapshot() {
    if (!selectedLocationId) {
      toast.error("Please select a location");
      return;
    }

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    setLoading(true);
    try {
      const result = await createInventorySnapshot(selectedLocationId, dateStr);
      if (result.success) {
        toast.success(`Snapshot created: ${result.recordsCreated} items`);
        // Recalculate to use the new snapshot
        await handleCalculateInventory();
      } else {
        toast.error(result.error || "Failed to create snapshot");
      }
    } catch (error) {
      toast.error("Failed to create snapshot");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <p className="text-muted-foreground mt-2">
          View inventory levels and values as of any date. Compare calculated
          values with Barsy snapshots.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Select location and date to view inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={selectedLocationId || ""}
                onValueChange={setSelectedLocationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(selectedDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={handleCalculateInventory}
                disabled={loading || !selectedLocationId}
              >
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", loading && "animate-spin")}
                />
                Calculate
              </Button>
              <Button
                onClick={handleFetchBarsySnapshot}
                disabled={fetchingBarsy || !selectedLocationId}
                variant="outline"
                title={
                  format(selectedDate, "yyyy-MM-dd") !==
                  format(new Date(), "yyyy-MM-dd")
                    ? "Barsy API only supports current inventory. Use calculated inventory for historical dates."
                    : "Fetch current inventory from Barsy API"
                }
              >
                <Camera
                  className={cn(
                    "mr-2 h-4 w-4",
                    fetchingBarsy && "animate-spin"
                  )}
                />
                Fetch Barsy
                {format(selectedDate, "yyyy-MM-dd") !==
                  format(new Date(), "yyyy-MM-dd") && (
                  <span className="ml-1 text-xs opacity-70">(Today only)</span>
                )}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleCreateSnapshot}
              disabled={loading || !selectedLocationId}
              variant="outline"
              size="sm"
            >
              <Camera className="mr-2 h-4 w-4" />
              Create Snapshot from Current Inventory
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && <InventorySummaryCards summary={summary} loading={loading} />}

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Details</CardTitle>
          <CardDescription>
            {hasBarsySnapshot
              ? "Calculated inventory compared with Barsy snapshot"
              : "Calculated inventory based on baseline snapshot and movements"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InventoryComparisonTable
            data={calculatedInventory}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
