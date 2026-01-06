'use server';

/**
 * Barsy API Connection Test
 * Tests API connectivity for each configured location
 */

import { createClient } from '@/lib/supabase/server';
import { createBarsyClient } from '@/lib/services/barsy-api';

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

interface ConnectionTestResponse {
  success: boolean;
  results: TestResult[];
  serverInfo: {
    timestamp: string;
    region?: string;
    ip?: string;
  };
}

/**
 * Test Barsy API connection for all configured locations
 */
export const testBarsyConnections = async (): Promise<ConnectionTestResponse> => {
  const supabase = await createClient();
  const results: TestResult[] = [];

  // Get server info (IP detection)
  let serverIp: string | undefined;
  let serverRegion: string | undefined;

  try {
    // Try to detect our external IP using a public service
    const ipResponse = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5000),
    });
    if (ipResponse.ok) {
      const ipData = await ipResponse.json();
      serverIp = ipData.ip;
    }
  } catch {
    serverIp = 'Could not detect';
  }

  // Try to get geolocation info
  if (serverIp && serverIp !== 'Could not detect') {
    try {
      const geoResponse = await fetch(`https://ipapi.co/${serverIp}/json/`, {
        signal: AbortSignal.timeout(5000),
      });
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        serverRegion = `${geoData.city || 'Unknown'}, ${geoData.country_name || geoData.country || 'Unknown'}`;
      }
    } catch {
      serverRegion = 'Could not detect';
    }
  }

  // Get all Barsy locations
  const { data: locations, error: locError } = await supabase
    .from('barsy_locations')
    .select('*')
    .order('name');

  if (locError || !locations) {
    return {
      success: false,
      results: [],
      serverInfo: {
        timestamp: new Date().toISOString(),
        ip: serverIp,
        region: serverRegion,
      },
    };
  }

  // Test each location
  for (const location of locations) {
    const startTime = Date.now();
    const result: TestResult = {
      locationId: location.id,
      locationName: location.name,
      barsyUrl: location.barsy_url,
      success: false,
      responseTimeMs: 0,
    };

    try {
      const client = createBarsyClient({
        baseUrl: location.barsy_url,
        username: location.username,
        password: location.password_encrypted,
      });

      // Test with a simple, fast API call - get current barsy info
      const response = await client.getBarsysInfo();

      result.responseTimeMs = Date.now() - startTime;

      if (response.success && response.data) {
        result.success = true;
        const barsysList = (response.data as any).Barsys_getlist;
        result.dataReceived = {
          method: 'Barsys_getlist',
          recordCount: Array.isArray(barsysList) ? barsysList.length : 0,
        };
      } else {
        result.success = false;
        result.error = response.error || 'Unknown error';

        // Try to parse more details from error
        if (response.error?.includes('401')) {
          result.errorDetails = 'Authentication failed - check credentials';
          result.httpStatus = 401;
        } else if (response.error?.includes('403')) {
          result.errorDetails = 'Access forbidden - possibly IP blocked';
          result.httpStatus = 403;
        } else if (response.error?.includes('timeout') || response.error?.includes('ETIMEDOUT')) {
          result.errorDetails = 'Connection timed out - server unreachable or blocked';
        } else if (response.error?.includes('ECONNREFUSED')) {
          result.errorDetails = 'Connection refused - server not accepting connections';
        } else if (response.error?.includes('ENOTFOUND')) {
          result.errorDetails = 'DNS lookup failed - hostname not found';
        }
      }
    } catch (error) {
      result.responseTimeMs = Date.now() - startTime;
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';

      // Parse error type
      const errorMsg = result.error.toLowerCase();
      if (errorMsg.includes('timeout')) {
        result.errorDetails = 'Request timed out';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        result.errorDetails = 'Network error - check if URL is accessible';
      }
    }

    results.push(result);
  }

  return {
    success: results.every((r) => r.success),
    results,
    serverInfo: {
      timestamp: new Date().toISOString(),
      ip: serverIp,
      region: serverRegion,
    },
  };
};

/**
 * Test a specific Barsy location with detailed diagnostics
 */
export const testBarsyLocationDetailed = async (locationId: string): Promise<{
  success: boolean;
  tests: Array<{
    name: string;
    success: boolean;
    durationMs: number;
    details?: string;
    error?: string;
  }>;
}> => {
  const supabase = await createClient();
  const tests: Array<{
    name: string;
    success: boolean;
    durationMs: number;
    details?: string;
    error?: string;
  }> = [];

  // Get location
  const { data: location } = await supabase
    .from('barsy_locations')
    .select('*')
    .eq('id', locationId)
    .single();

  if (!location) {
    return {
      success: false,
      tests: [{ name: 'Location Lookup', success: false, durationMs: 0, error: 'Location not found' }],
    };
  }

  const client = createBarsyClient({
    baseUrl: location.barsy_url,
    username: location.username,
    password: location.password_encrypted,
  });

  // Test 1: DNS/Connectivity
  const dnsStart = Date.now();
  try {
    const url = new URL(location.barsy_url);
    const dnsResponse = await fetch(`https://${url.hostname}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    tests.push({
      name: 'DNS & Connectivity',
      success: true,
      durationMs: Date.now() - dnsStart,
      details: `Host reachable, HTTP ${dnsResponse.status}`,
    });
  } catch (error) {
    tests.push({
      name: 'DNS & Connectivity',
      success: false,
      durationMs: Date.now() - dnsStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 2: API Authentication (Barsys_getlist)
  const authStart = Date.now();
  try {
    const response = await client.getBarsysInfo();
    if (response.success) {
      const data = (response.data as any).Barsys_getlist || [];
      tests.push({
        name: 'API Authentication',
        success: true,
        durationMs: Date.now() - authStart,
        details: `Authenticated successfully, ${data.length} barsy(s) found`,
      });
    } else {
      tests.push({
        name: 'API Authentication',
        success: false,
        durationMs: Date.now() - authStart,
        error: response.error,
      });
    }
  } catch (error) {
    tests.push({
      name: 'API Authentication',
      success: false,
      durationMs: Date.now() - authStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 3: Categories (simple data fetch)
  const catStart = Date.now();
  try {
    const response = await client.getCategories(false);
    if (response.success) {
      const data = (response.data as any).Categories_getlist || [];
      tests.push({
        name: 'Data Fetch (Categories)',
        success: true,
        durationMs: Date.now() - catStart,
        details: `${data.length} categories retrieved`,
      });
    } else {
      tests.push({
        name: 'Data Fetch (Categories)',
        success: false,
        durationMs: Date.now() - catStart,
        error: response.error,
      });
    }
  } catch (error) {
    tests.push({
      name: 'Data Fetch (Categories)',
      success: false,
      durationMs: Date.now() - catStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 4: Users (another data type)
  const usersStart = Date.now();
  try {
    const response = await client.getUsers({});
    if (response.success) {
      const data = (response.data as any).Users_getlist || [];
      tests.push({
        name: 'Data Fetch (Users)',
        success: true,
        durationMs: Date.now() - usersStart,
        details: `${data.length} users retrieved`,
      });
    } else {
      tests.push({
        name: 'Data Fetch (Users)',
        success: false,
        durationMs: Date.now() - usersStart,
        error: response.error,
      });
    }
  } catch (error) {
    tests.push({
      name: 'Data Fetch (Users)',
      success: false,
      durationMs: Date.now() - usersStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 5: Batch request (reference data)
  const batchStart = Date.now();
  try {
    const response = await client.getAllReferenceData();
    if (response.success && response.data) {
      const data = response.data;
      const counts = [
        (data.Paymentmethods_getlist || []).length,
        (data.Taxgroups_getlist || []).length,
        (data.Depots_getlist || []).length,
      ];
      tests.push({
        name: 'Batch Request (Reference Data)',
        success: true,
        durationMs: Date.now() - batchStart,
        details: `Payment methods: ${counts[0]}, Tax groups: ${counts[1]}, Depots: ${counts[2]}`,
      });
    } else {
      tests.push({
        name: 'Batch Request (Reference Data)',
        success: false,
        durationMs: Date.now() - batchStart,
        error: (response as any).error || 'No data returned',
      });
    }
  } catch (error) {
    tests.push({
      name: 'Batch Request (Reference Data)',
      success: false,
      durationMs: Date.now() - batchStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return {
    success: tests.every((t) => t.success),
    tests,
  };
};
