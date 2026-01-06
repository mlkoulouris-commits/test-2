"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SyncCategoryCard } from "@/components/admin/barsy-sync/sync-category-card";
import { SyncProfilesDropdown } from "@/components/admin/barsy-sync/sync-profiles-dropdown";
import { getBarsyLocations, getSyncHistory } from "@/lib/actions/barsy-sync";
import {
  executeSyncType,
  executeBatchSync,
  syncAllReferenceDataBatched,
  syncCategoriesAndUsersBatched,
} from "@/lib/actions/barsy-unified-sync";
import {
  SyncType,
  SyncCategory,
  SyncResult,
  getOrderedCategories,
  getSyncTypesByCategory,
  SYNC_TYPES,
} from "@/lib/types/barsy-sync";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CalendarIcon,
  Clock,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Location {
  id: string;
  name: string;
  barsy_url: string;
  is_active: boolean;
  memento_location_id: number;
}

interface SyncLog {
  id: string;
  sync_type: string;
  date_from: string | null;
  date_to: string | null;
  records_synced: number;
  status: string;
  error_message: string | null;
  completed_at: string | null;
  created_at: string;
}

interface SyncStatus {
  isRunning: boolean;
  lastResult?: SyncResult;
}

export default function BarsySyncPage() {
  const today = new Date();
  const oneWeekAgo = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 7
  );

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<Record<string, SyncStatus>>(
    {}
  );
  const [globalLoading, setGlobalLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(oneWeekAgo);
  const [dateTo, setDateTo] = useState<Date | undefined>(today);
  const [activeTab, setActiveTab] = useState("sync");

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      loadSyncHistory(selectedLocation);
    }
  }, [selectedLocation]);

  const loadLocations = async () => {
    const result = await getBarsyLocations();
    if (result.success && result.data) {
      setLocations(result.data);
      if (result.data.length > 0 && !selectedLocation) {
        setSelectedLocation(result.data[0].id);
      }
    }
  };

  const loadSyncHistory = async (locationId: string) => {
    const result = await getSyncHistory(locationId, 1, 20);
    if (result.success && result.data) {
      setSyncHistory(result.data);
    }
  };

  const hasDateRange = Boolean(dateFrom && dateTo);
  const categories = getOrderedCategories();

  // Update sync status for a specific type
  const updateSyncStatus = useCallback(
    (syncType: SyncType, status: Partial<SyncStatus>) => {
      setSyncStatuses((prev) => ({
        ...prev,
        [syncType]: {
          ...prev[syncType],
          ...status,
        },
      }));
    },
    []
  );

  // Handle individual sync type
  const handleSyncType = useCallback(
    async (syncType: SyncType) => {
      if (!selectedLocation) return;

      updateSyncStatus(syncType, { isRunning: true });
      setMessage(null);

      try {
        const dateFromStr = dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined;
        const dateToStr = dateTo ? format(dateTo, "yyyy-MM-dd") : undefined;

        const result = await executeSyncType(
          syncType,
          selectedLocation,
          dateFromStr,
          dateToStr
        );

        updateSyncStatus(syncType, {
          isRunning: false,
          lastResult: result,
        });

        if (result.success) {
          setMessage({
            type: "success",
            text: `${SYNC_TYPES[syncType].label}: Synced ${result.recordsSynced?.toLocaleString() || 0} records`,
          });
        } else {
          setMessage({
            type: "error",
            text: `${SYNC_TYPES[syncType].label}: ${result.error}`,
          });
        }

        loadSyncHistory(selectedLocation);
      } catch (error) {
        updateSyncStatus(syncType, {
          isRunning: false,
          lastResult: {
            success: false,
            syncType,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    },
    [selectedLocation, dateFrom, dateTo, updateSyncStatus]
  );

  // Handle category sync (all types in category)
  const handleSyncCategory = useCallback(
    async (category: SyncCategory) => {
      if (!selectedLocation) return;

      const syncTypes = getSyncTypesByCategory(category);
      setGlobalLoading(true);
      setMessage(null);
      setLoadingMessage(`Syncing ${category}...`);

      // Use optimized batched sync for reference data
      if (category === "reference") {
        try {
          syncTypes.forEach((t) =>
            updateSyncStatus(t.id, { isRunning: true })
          );

          const results = await syncAllReferenceDataBatched(selectedLocation);

          results.forEach((result) => {
            updateSyncStatus(result.syncType, {
              isRunning: false,
              lastResult: result,
            });
          });

          const totalRecords = results.reduce(
            (sum, r) => sum + (r.recordsSynced || 0),
            0
          );
          const allSuccess = results.every((r) => r.success);

          setMessage({
            type: allSuccess ? "success" : "error",
            text: allSuccess
              ? `Reference data: Synced ${totalRecords.toLocaleString()} records (batched)`
              : "Some reference data syncs failed",
          });
        } catch (error) {
          setMessage({
            type: "error",
            text: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } else {
        // Use standard batch sync for other categories
        const dateFromStr = dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined;
        const dateToStr = dateTo ? format(dateTo, "yyyy-MM-dd") : undefined;

        try {
          syncTypes.forEach((t) =>
            updateSyncStatus(t.id, { isRunning: true })
          );

          const results = await executeBatchSync(
            {
              syncTypes: syncTypes.map((t) => t.id),
              dateFrom: dateFromStr,
              dateTo: dateToStr,
              parallel: true,
            },
            selectedLocation
          );

          results.forEach((result) => {
            updateSyncStatus(result.syncType, {
              isRunning: false,
              lastResult: result,
            });
          });

          const totalRecords = results.reduce(
            (sum, r) => sum + (r.recordsSynced || 0),
            0
          );
          const allSuccess = results.every((r) => r.success);

          setMessage({
            type: allSuccess ? "success" : "error",
            text: allSuccess
              ? `${category}: Synced ${totalRecords.toLocaleString()} records`
              : `Some ${category} syncs failed`,
          });
        } catch (error) {
          setMessage({
            type: "error",
            text: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      setGlobalLoading(false);
      setLoadingMessage("");
      loadSyncHistory(selectedLocation);
    },
    [selectedLocation, dateFrom, dateTo, updateSyncStatus]
  );

  // Handle sync profile
  const handleSyncProfile = useCallback(
    async (syncTypes: SyncType[], requiresDateRange: boolean) => {
      if (!selectedLocation) return;
      if (requiresDateRange && !hasDateRange) {
        setMessage({
          type: "error",
          text: "This profile requires a date range",
        });
        return;
      }

      setGlobalLoading(true);
      setMessage(null);
      setLoadingMessage(`Running sync profile (${syncTypes.length} types)...`);

      const dateFromStr = dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined;
      const dateToStr = dateTo ? format(dateTo, "yyyy-MM-dd") : undefined;

      try {
        syncTypes.forEach((t) => updateSyncStatus(t, { isRunning: true }));

        const results = await executeBatchSync(
          {
            syncTypes,
            dateFrom: dateFromStr,
            dateTo: dateToStr,
            parallel: true,
          },
          selectedLocation
        );

        results.forEach((result) => {
          updateSyncStatus(result.syncType, {
            isRunning: false,
            lastResult: result,
          });
        });

        const totalRecords = results.reduce(
          (sum, r) => sum + (r.recordsSynced || 0),
          0
        );
        const successCount = results.filter((r) => r.success).length;
        const failedCount = results.filter((r) => !r.success).length;

        setMessage({
          type: failedCount === 0 ? "success" : "error",
          text:
            failedCount === 0
              ? `Profile complete: ${totalRecords.toLocaleString()} records synced`
              : `Profile complete: ${successCount} succeeded, ${failedCount} failed`,
        });
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Unknown error",
        });
      }

      setGlobalLoading(false);
      setLoadingMessage("");
      loadSyncHistory(selectedLocation);
    },
    [selectedLocation, dateFrom, dateTo, hasDateRange, updateSyncStatus]
  );

  // Count running syncs
  const runningCount = Object.values(syncStatuses).filter(
    (s) => s.isRunning
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/admin">Admin</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Barsy Sync</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Barsy Data Sync</h1>
            <p className="text-muted-foreground mt-1">
              Sync sales, inventory, and catalog data from Barsy POS
            </p>
          </div>
          {runningCount > 0 && (
            <Badge variant="secondary" className="gap-2 text-sm py-1 px-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              {runningCount} sync{runningCount > 1 ? "s" : ""} running
            </Badge>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {loadingMessage && (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingMessage}
          </AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          <AlertDescription className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync Configuration</CardTitle>
              <CardDescription>
                Select location and date range for syncing
              </CardDescription>
            </div>
            <SyncProfilesDropdown
              onSelectProfile={handleSyncProfile}
              disabled={globalLoading || !selectedLocation}
              hasDateRange={hasDateRange}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Location Selection */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Location</label>
              <Select
                value={selectedLocation || ""}
                onValueChange={setSelectedLocation}
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

            {/* Date Range */}
            <div className="flex gap-2">
              <div>
                <label className="text-sm font-medium mb-2 block">From</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[140px] justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "MMM d") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">To</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[140px] justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "MMM d") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Quick Date Buttons */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  setDateFrom(today);
                  setDateTo(today);
                }}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today);
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  setDateFrom(weekAgo);
                  setDateTo(today);
                }}
              >
                Last 7 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const monthAgo = new Date(today);
                  monthAgo.setMonth(monthAgo.getMonth() - 1);
                  setDateFrom(monthAgo);
                  setDateTo(today);
                }}
              >
                Last 30 days
              </Button>
            </div>
          </div>

          {!hasDateRange && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Select a date range to enable inventory and sales syncs
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs for Sync and History */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sync" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync Actions
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-4 mt-4">
          {selectedLocation ? (
            <>
              {/* Sync Categories */}
              {categories.map((category) => (
                <SyncCategoryCard
                  key={category.id}
                  category={category}
                  syncStatuses={syncStatuses}
                  onSyncType={(syncType) => handleSyncType(syncType as SyncType)}
                  onSyncCategory={handleSyncCategory}
                  disabled={globalLoading}
                  dateRangeRequired={hasDateRange}
                />
              ))}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Select a location to view sync options
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Recent sync operations</CardDescription>
            </CardHeader>
            <CardContent>
              {syncHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No sync history yet
                </p>
              ) : (
                <div className="space-y-2">
                  {syncHistory.map((log, index) => (
                    <div
                      key={log.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        index % 2 === 0 ? "bg-muted/30" : ""
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground min-w-[100px]">
                          {format(new Date(log.created_at), "MMM d, HH:mm")}
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {log.sync_type}
                          </div>
                          {log.date_from && log.date_to && (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(log.date_from), "MMM d")} -{" "}
                              {format(new Date(log.date_to), "MMM d")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {log.records_synced.toLocaleString()}
                        </span>
                        <Badge
                          variant={
                            log.status === "success"
                              ? "default"
                              : log.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                          className={cn(
                            log.status === "success" && "bg-green-600"
                          )}
                        >
                          {log.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
