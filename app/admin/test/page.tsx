"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  testBarsyConnections,
  testBarsyLocationDetailed,
} from "@/lib/actions/barsy-test";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  MapPin,
  RefreshCw,
  Server,
  Timer,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface TestResult {
  locationId: string;
  locationName: string;
  barsyUrl: string;
  success: boolean;
  responseTimeMs: number;
  error?: string;
  errorDetails?: string;
  httpStatus?: number;
  dataReceived?: {
    method: string;
    recordCount: number;
  };
}

interface DetailedTest {
  name: string;
  success: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

export default function BarsyTestPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [serverInfo, setServerInfo] = useState<{
    timestamp: string;
    ip?: string;
    region?: string;
  } | null>(null);
  const [detailedTests, setDetailedTests] = useState<Record<string, DetailedTest[]>>({});
  const [loadingDetailed, setLoadingDetailed] = useState<string | null>(null);

  const runTests = async () => {
    setLoading(true);
    setResults(null);
    setServerInfo(null);
    setDetailedTests({});

    try {
      const response = await testBarsyConnections();
      setResults(response.results);
      setServerInfo(response.serverInfo);
    } catch (error) {
      console.error("Test failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const runDetailedTest = async (locationId: string) => {
    setLoadingDetailed(locationId);
    try {
      const response = await testBarsyLocationDetailed(locationId);
      setDetailedTests((prev) => ({
        ...prev,
        [locationId]: response.tests,
      }));
    } catch (error) {
      console.error("Detailed test failed:", error);
    } finally {
      setLoadingDetailed(null);
    }
  };

  const allSuccess = results?.every((r) => r.success) ?? false;
  const anyFailed = results?.some((r) => !r.success) ?? false;

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
              <BreadcrumbPage>API Connection Test</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-2">
          <h1 className="text-2xl sm:text-3xl font-bold">Barsy API Connection Test</h1>
          <p className="text-muted-foreground mt-1">
            Test connectivity to Barsy POS API for each configured location
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>IP-Based Access Control</AlertTitle>
        <AlertDescription>
          Barsy may restrict API access based on IP address. If tests fail from Vercel
          (USA/EU servers) but work locally, the API may only allow Bulgarian IPs.
          This test will show the server&apos;s detected IP and location.
        </AlertDescription>
      </Alert>

      {/* Run Test Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Connection Test
              </CardTitle>
              <CardDescription>
                Tests API authentication and basic data retrieval for all locations
              </CardDescription>
            </div>
            <Button onClick={runTests} disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Run Tests
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {serverInfo && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Server IP:</span>
                <code className="text-sm bg-background px-2 py-0.5 rounded">
                  {serverInfo.ip || "Unknown"}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Location:</span>
                <span className="text-sm">{serverInfo.region || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Tested:</span>
                <span className="text-sm">
                  {new Date(serverInfo.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Results Summary */}
      {results && (
        <Alert variant={allSuccess ? "default" : "destructive"}>
          {allSuccess ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {allSuccess
              ? "All Connections Successful"
              : anyFailed
              ? "Some Connections Failed"
              : "Tests Complete"}
          </AlertTitle>
          <AlertDescription>
            {results.filter((r) => r.success).length} of {results.length} locations
            connected successfully.
            {anyFailed && serverInfo?.region && !serverInfo.region.includes("Bulgaria") && (
              <span className="block mt-1 font-medium">
                ⚠️ Server is in {serverInfo.region} - Barsy may be blocking non-Bulgarian IPs
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Results Grid */}
      {results && (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((result) => (
            <Card
              key={result.locationId}
              className={cn(
                "border-2",
                result.success
                  ? "border-green-200 dark:border-green-800"
                  : "border-red-200 dark:border-red-800"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <WifiOff className="h-5 w-5 text-red-600" />
                    )}
                    {result.locationName}
                  </CardTitle>
                  <Badge variant={result.success ? "default" : "destructive"}>
                    {result.success ? "Connected" : "Failed"}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <Globe className="h-3 w-3" />
                  {result.barsyUrl}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Response Time */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Response Time</span>
                  <span
                    className={cn(
                      "font-mono",
                      result.responseTimeMs < 1000
                        ? "text-green-600"
                        : result.responseTimeMs < 3000
                        ? "text-amber-600"
                        : "text-red-600"
                    )}
                  >
                    {result.responseTimeMs}ms
                  </span>
                </div>

                {/* Success Details */}
                {result.success && result.dataReceived && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Data Retrieved</span>
                    <span className="text-green-600">
                      {result.dataReceived.method}: {result.dataReceived.recordCount} records
                    </span>
                  </div>
                )}

                {/* Error Details */}
                {!result.success && (
                  <div className="space-y-2">
                    <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        {result.error}
                      </p>
                      {result.errorDetails && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {result.errorDetails}
                        </p>
                      )}
                      {result.httpStatus && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          HTTP {result.httpStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Detailed Test Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => runDetailedTest(result.locationId)}
                  disabled={loadingDetailed === result.locationId}
                >
                  {loadingDetailed === result.locationId ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Running Detailed Tests...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Run Detailed Diagnostics
                    </>
                  )}
                </Button>

                {/* Detailed Test Results */}
                {detailedTests[result.locationId] && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Detailed Test Results
                    </p>
                    {detailedTests[result.locationId].map((test, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-start justify-between p-2 rounded text-sm",
                          test.success
                            ? "bg-green-50 dark:bg-green-950"
                            : "bg-red-50 dark:bg-red-950"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {test.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-medium">{test.name}</p>
                            {test.details && (
                              <p className="text-xs text-muted-foreground">{test.details}</p>
                            )}
                            {test.error && (
                              <p className="text-xs text-red-600">{test.error}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          {test.durationMs}ms
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No results yet */}
      {!results && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wifi className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click &quot;Run Tests&quot; to check Barsy API connectivity</p>
            <p className="text-sm mt-1">
              This will test authentication and data retrieval for each location
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
