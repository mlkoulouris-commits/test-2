/**
 * Barsy API Client
 * Multi-location support with proper authentication and data fetching
 */

interface BarsyConfig {
  baseUrl: string;
  username: string;
  password: string;
}

interface BarsyResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type BarsyReportsActionType = "content" | "values";

export class BarsyApiClient {
  private config: BarsyConfig;

  constructor(config: BarsyConfig) {
    this.config = config;
  }

  /**
   * Make authenticated request to Barsy API
   */
  private async request<T>(
    payload: Record<string, unknown>
  ): Promise<BarsyResponse<T>> {
    try {
      const auth = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString("base64");

      const response = await fetch(`${this.config.baseUrl}/endpoints/json/`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.text();
          if (errorData) {
            errorMessage += ` - ${errorData}`;
          }
        } catch {
          // Ignore error parsing error response
        }
        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Make a batched multi-method request to Barsy API
   * Combines multiple API methods into a single HTTP request for efficiency
   * Barsy API supports: { Method1: {...}, Method2: {...} } in one request
   */
  async batchRequest<T extends Record<string, unknown>>(
    methods: Record<string, Record<string, unknown>>
  ): Promise<BarsyResponse<T>> {
    return this.request<T>(methods);
  }

  /**
   * Fetch all reference data in a single batched request
   * Returns: payment methods, tax groups, depots, places, suppliers, currencies
   */
  async getAllReferenceData(): Promise<BarsyResponse<{
    Paymentmethods_getlist?: unknown[];
    Taxgroups_getlist?: unknown[];
    Depots_getlist?: unknown[];
    Places_getlist?: unknown[];
    Suppliers_getlist?: unknown[];
    Currencies_getlist?: unknown[];
    Poses_getlist?: unknown[];
  }>> {
    return this.batchRequest({
      Paymentmethods_getlist: {},
      Taxgroups_getlist: {},
      Depots_getlist: { filters: {} },
      Places_getlist: { filters: {} },
      Suppliers_getlist: { filters: {} },
      Currencies_getlist: {},
      Poses_getlist: { filters: {} },
    });
  }

  /**
   * Fetch categories and users in a single batched request (non-paginated data)
   */
  async getCategoriesAndUsers(): Promise<BarsyResponse<{
    Categories_getlist?: unknown[];
    Users_getlist?: unknown[];
  }>> {
    return this.batchRequest({
      Categories_getlist: {},
      Users_getlist: { filters: {} },
    });
  }

  /**
   * Fetch orders/sales for a date range with pagination
   * Barsy API has limits, so we fetch in chunks
   */
  async getOrders(
    dateFrom: string,
    dateTo: string,
    limit?: number,
    offset?: number
  ) {
    const payload: any = {
      Orders_getlist: {
        filters: {
          ref_date: [dateFrom, dateTo],
        },
        extra_properties: {
          account_data: true,
          client_data: true,
        },
      },
    };

    // Add pagination if specified
    if (limit !== undefined) {
      payload.Orders_getlist.length = limit;
    }
    if (offset !== undefined) {
      payload.Orders_getlist.offset = offset;
    }

    return this.request(payload);
  }

  /**
   * Fetch ALL orders for a date range (handles pagination automatically)
   */
  async getAllOrders(dateFrom: string, dateTo: string) {
    const allOrders: any[] = [];
    const batchSize = 10000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getOrders(
        dateFrom,
        dateTo,
        batchSize,
        offset
      );

      if (!response.success || !response.data) {
        return response;
      }

      const orders = (response.data as any).Orders_getlist || [];

      if (orders.length === 0) {
        hasMore = false;
      } else {
        allOrders.push(...orders);
        offset += batchSize;

        // If we got fewer than batchSize, we've reached the end
        if (orders.length < batchSize) {
          hasMore = false;
        }
      }
    }

    return {
      success: true,
      data: { Orders_getlist: allOrders },
    };
  }

  /**
   * Fetch articles with pagination (limit: 1000 per request)
   * Supports incremental sync with last_update filter
   */
  async getArticles(
    filters?: any,
    offset?: number,
    length?: number,
    extraProperties?: string[]
  ) {
    const payload: any = {
      Articles_getlist: {
        filters: filters || {},
        extra_properties: extraProperties || [],
      },
    };

    if (offset !== undefined) {
      payload.Articles_getlist.offset = offset;
    }
    if (length !== undefined) {
      payload.Articles_getlist.length = length;
    }

    return this.request(payload);
  }

  /**
   * Fetch articles changed since a specific timestamp
   * Uses Barsy's last_update filter for efficient incremental sync
   */
  async getArticlesChangedSince(lastSyncTimestamp: string, offset?: number, length?: number) {
    return this.getArticles(
      { last_update: `>${lastSyncTimestamp}` },
      offset,
      length,
      ["article_details"]
    );
  }

  /**
   * Fetch ALL articles (handles pagination automatically)
   * Note: Articles have 1000 record limit per request
   * Includes recipe_description to identify articles with recipes
   */
  async getAllArticles(filters?: any) {
    const allArticles: any[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Request article_details to get recipe_description
      const response = await this.getArticles(
        filters,
        offset,
        batchSize,
        ["article_details"]
      );

      if (!response.success || !response.data) {
        return response;
      }

      const articles = (response.data as any).Articles_getlist || [];

      if (articles.length === 0) {
        hasMore = false;
      } else {
        allArticles.push(...articles);
        offset += batchSize;

        if (articles.length < batchSize) {
          hasMore = false;
        }
      }
    }

    return {
      success: true,
      data: { Articles_getlist: allArticles },
    };
  }

  /**
   * Fetch categories (tree structure available)
   */
  async getCategories(treeFormat = false) {
    const method = treeFormat ? "Categories_gettree" : "Categories_getlist";
    return this.request({
      [method]: {},
    });
  }

  /**
   * Fetch all users/staff
   */
  async getUsers(filters?: any) {
    return this.request({
      Users_getlist: {
        filters: filters || {},
      },
    });
  }

  /**
   * Fetch clients/customers with pagination
   */
  async getClients(filters?: any, offset?: number, length?: number) {
    const payload: any = {
      Clients_getlist: {
        filters: filters || {},
      },
    };

    if (offset !== undefined) {
      payload.Clients_getlist.offset = offset;
    }
    if (length !== undefined) {
      payload.Clients_getlist.length = length;
    }

    return this.request(payload);
  }

  /**
   * Fetch accounts (bills/tabs) with pagination
   */
  async getAccounts(filters?: any, offset?: number, length?: number) {
    const payload: any = {
      Accounts_getlist: {
        filters: filters || {},
      },
    };

    if (offset !== undefined) {
      payload.Accounts_getlist.offset = offset;
    }
    if (length !== undefined) {
      payload.Accounts_getlist.length = length;
    }

    return this.request(payload);
  }

  /**
   * Fetch payments with filters
   */
  async getPayments(filters?: any, offset?: number, length?: number) {
    const payload: any = {
      Payments_getlist: {
        filters: filters || {},
      },
    };

    if (offset !== undefined) {
      payload.Payments_getlist.offset = offset;
    }
    if (length !== undefined) {
      payload.Payments_getlist.length = length;
    }

    return this.request(payload);
  }

  /**
   * Fetch specific article by ID
   */
  async getArticle(articleId: number) {
    return this.request({
      Articles_get: {
        article_id: articleId.toString(),
      },
    });
  }

  /**
   * Fetch recipe ingredients for an article
   */
  async getArticleRecipe(articleId: number) {
    return this.request({
      Articles_getrecipearticles: {
        article_id: articleId.toString(),
      },
    });
  }

  /**
   * Fetch current store amounts (inventory levels)
   * Store_amounts is a Report-type endpoint that returns page structure
   * We try multiple approaches to get raw data
   */
  async getStoreAmounts(depotId?: number) {
    // Try with data_type and return_type to get raw data instead of page structure
    const payload: any = {
      Store_amounts: {
        return_type: "data",
        data_type: "json",
      },
    };

    if (depotId) {
      payload.Store_amounts.filters = { depot_id: depotId };
    }

    return this.request(payload);
  }

  /**
   * Fetch store amounts with action_values parameter
   * This approach requests just the values/data portion
   */
  async getStoreAmountsValues(depotId?: number) {
    const payload: any = {
      Store_amounts: {
        action: "values",
      },
    };

    if (depotId) {
      payload.Store_amounts.filters = { depot_id: depotId };
    }

    return this.request(payload);
  }

  /**
   * Fetch current store amounts using getlist format (alternative)
   * This format is more consistent with other endpoints
   */
  async getStoreAmountsGetlist(depotId?: number) {
    const payload: any = {
      Store_amounts_getlist: {
        filters: {},
      },
    };

    if (depotId) {
      payload.Store_amounts_getlist.filters = { depot_id: depotId };
    }

    return this.request(payload);
  }

  /**
   * Try fetching store amounts data directly with values action
   * This requests the actual inventory data instead of page structure
   * Barsy uses page_num for pagination (1-based), not offset
   */
  async getStoreAmountsData(
    depotId?: number,
    pageNum: number = 1,
    rowNum: number = 500
  ) {
    const payload: any = {
      store_amounts: {
        action_type: "values",
        active_struct_id: "eStructList_1",
        page_num: pageNum,
        rowNum: rowNum,
      },
    };

    if (depotId) {
      payload.store_amounts.filters = { depot_id: depotId };
    }

    return this.request(payload);
  }

  /**
   * Fetch all store amounts with pagination
   * Returns all inventory items across all pages
   * Barsy uses page_num (1-based) for pagination
   */
  async getAllStoreAmounts(depotId?: number): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    const allItems: any[] = [];
    let pageNum = 1;
    const rowsPerPage = 500;
    let hasMore = true;
    let totalRecords = 0;
    let totalPages = 0;

    while (hasMore) {
      const response = await this.getStoreAmountsData(
        depotId,
        pageNum,
        rowsPerPage
      );

      if (!response.success || !response.data) {
        if (allItems.length > 0) {
          return { success: true, data: allItems };
        }
        return {
          success: false,
          error: response.error || "Failed to fetch store amounts",
        };
      }

      const storeAmountsData = (response.data as any).store_amounts;
      const rows = storeAmountsData?.rows || [];
      // 'records' = total row count, 'total' = total pages
      totalRecords = storeAmountsData?.records || totalRecords || 0;
      totalPages = storeAmountsData?.total || totalPages || 0;
      const currentPage = storeAmountsData?.page_num || pageNum;

      if (rows.length === 0) {
        hasMore = false;
      } else {
        allItems.push(...rows);
        pageNum++;

        // Continue if there are more pages
        hasMore = currentPage < totalPages && allItems.length < totalRecords;

        console.log(
          `Fetched ${allItems.length} of ${totalRecords} store amounts (page ${currentPage}/${totalPages})...`
        );
      }
    }

    console.log(`✅ Total fetched: ${allItems.length} store amounts`);
    return { success: true, data: allItems };
  }

  /**
   * Fetch store amounts by specific date
   */
  async getStoreAmountsByDate(date: string, depotId?: number) {
    const payload: any = {
      Store_amounts_by_date: {
        date,
      },
    };

    if (depotId) {
      payload.Store_amounts_by_date.filters = { depot_id: depotId };
    }

    return this.request(payload);
  }

  /**
   * Fetch store outs (inventory write-offs) with pagination
   * Include details with cost prices (avg_delivery_price) for COGS calculation
   */
  async getStoreOuts(filters?: any, offset?: number, length?: number) {
    const payload: any = {
      Storeouts_getlist: {
        filters: filters || {},
        // Request details with cost data - includes avg_delivery_price
        extra_properties: ["details"],
      },
    };

    if (offset !== undefined) {
      payload.Storeouts_getlist.offset = offset;
    }
    if (length !== undefined) {
      payload.Storeouts_getlist.length = length;
    }

    return this.request(payload);
  }

  /**
   * Fetch ALL store outs for a date range with pagination
   */
  async getAllStoreOuts(dateFrom: string, dateTo: string) {
    const allStoreOuts: any[] = [];
    const batchSize = 10000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getStoreOuts(
        { ref_date: [dateFrom, dateTo] },
        offset,
        batchSize
      );

      if (!response.success || !response.data) {
        return response;
      }

      const storeOuts = (response.data as any).Storeouts_getlist || [];

      if (storeOuts.length === 0) {
        hasMore = false;
      } else {
        allStoreOuts.push(...storeOuts);
        offset += batchSize;

        if (storeOuts.length < batchSize) {
          hasMore = false;
        }
      }
    }

    return {
      success: true,
      data: { Storeouts_getlist: allStoreOuts },
    };
  }

  /**
   * Fetch store-out movements (detail rows with costs) for a specific store-out
   * Returns StoreOutDetailData with avg_delivery_price for COGS calculation
   */
  async getStoreOutMovements(
    storeOutId: number,
    offset?: number,
    length?: number
  ) {
    const payload: any = {
      Storeouts_movements: {
        filters: {
          store_out_id: storeOutId,
        },
      },
    };

    if (offset !== undefined) {
      payload.Storeouts_movements.offset = offset;
    }
    if (length !== undefined) {
      payload.Storeouts_movements.length = length;
    }

    return this.request(payload);
  }

  /**
   * Fetch ALL store-out movements for multiple store-outs
   * Optimized to batch fetch movements for efficiency
   */
  async getAllStoreOutMovements(storeOutIds: number[]) {
    const allMovements: any[] = [];
    const batchSize = 1000;

    // Process store-outs in batches
    for (let i = 0; i < storeOutIds.length; i += 50) {
      const batch = storeOutIds.slice(i, i + 50);

      // Fetch movements for this batch of store-outs in parallel
      const promises = batch.map(async (storeOutId) => {
        let offset = 0;
        let hasMore = true;
        const movements: any[] = [];

        while (hasMore) {
          const response = await this.getStoreOutMovements(
            storeOutId,
            offset,
            batchSize
          );

          if (!response.success || !response.data) {
            break;
          }

          const data = (response.data as any).Storeouts_movements || [];
          if (data.length === 0) {
            hasMore = false;
          } else {
            movements.push(
              ...data.map((m: any) => ({ ...m, store_out_id: storeOutId }))
            );
            offset += batchSize;
            if (data.length < batchSize) {
              hasMore = false;
            }
          }
        }

        return movements;
      });

      const results = await Promise.all(promises);
      results.forEach((movements) => allMovements.push(...movements));
    }

    return {
      success: true,
      data: { Storeouts_movements: allMovements },
    };
  }

  /**
   * Fetch ALL accounts (bills/tabs) for a date range with pagination
   * Fetches using both create_date and ref_date filters to capture all accounts
   */
  async getAllAccounts(dateFrom: string, dateTo: string) {
    const accountMap = new Map<number, any>(); // Use account_id as key for deduplication
    const batchSize = 10000;

    // Helper function to fetch with a specific filter
    const fetchWithFilter = async (filterName: string, filterValue: any) => {
      let offset = 0;
      let hasMore = true;
      let fetchedCount = 0;

      console.log(
        `📋 Fetching accounts with ${filterName} filter: ${dateFrom} to ${dateTo}`
      );

      while (hasMore) {
        const response = await this.getAccounts(
          { [filterName]: filterValue },
          offset,
          batchSize
        );

        if (!response.success || !response.data) {
          console.log(`⚠️ ${filterName} filter failed or returned no data`);
          return;
        }

        const accounts = (response.data as any).Accounts_getlist || [];

        if (accounts.length === 0) {
          hasMore = false;
        } else {
          for (const acc of accounts) {
            const accountId = acc.account_id || acc.id;
            if (!accountMap.has(accountId)) {
              accountMap.set(accountId, acc);
              fetchedCount++;
            }
          }
          offset += batchSize;
          if (accounts.length < batchSize) {
            hasMore = false;
          }
        }
      }
      console.log(
        `✅ ${filterName} filter: fetched ${fetchedCount} unique accounts`
      );
    };

    // Fetch using multiple strategies to capture all accounts:
    // 1. create_date - accounts created/opened in the date range
    // 2. ref_date - accounts closed (with document date) in the date range
    // 3. list_opened with create_date - explicitly get open accounts created in range
    await fetchWithFilter("create_date", [dateFrom, dateTo]);
    await fetchWithFilter("ref_date", [dateFrom, dateTo]);

    // Also fetch open accounts in the date range (accounts without close_date yet)
    console.log(
      `📋 Fetching open accounts with create_date filter: ${dateFrom} to ${dateTo}`
    );
    let offset = 0;
    let hasMore = true;
    let openAccountsFetched = 0;

    while (hasMore) {
      const response = await this.getAccounts(
        {
          create_date: [dateFrom, dateTo],
          list_opened: "1", // Include open/unclosed accounts
        },
        offset,
        batchSize
      );

      if (!response.success || !response.data) {
        console.log(`⚠️ list_opened filter failed or returned no data`);
        break;
      }

      const accounts = (response.data as any).Accounts_getlist || [];

      if (accounts.length === 0) {
        hasMore = false;
      } else {
        for (const acc of accounts) {
          const accountId = acc.account_id || acc.id;
          if (!accountMap.has(accountId)) {
            accountMap.set(accountId, acc);
            openAccountsFetched++;
          }
        }
        offset += batchSize;
        if (accounts.length < batchSize) {
          hasMore = false;
        }
      }
    }
    console.log(
      `✅ list_opened filter: fetched ${openAccountsFetched} unique open accounts`
    );

    const allAccounts = Array.from(accountMap.values());
    console.log(`📋 Total unique accounts fetched: ${allAccounts.length}`);

    return {
      success: true,
      data: { Accounts_getlist: allAccounts },
    };
  }

  /**
   * Fetch ALL payments for a date range with pagination
   */
  async getAllPayments(dateFrom: string, dateTo: string) {
    const allPayments: any[] = [];
    const batchSize = 10000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getPayments(
        { ref_date: [dateFrom, dateTo] },
        offset,
        batchSize
      );

      if (!response.success || !response.data) {
        return response;
      }

      const payments = (response.data as any).Payments_getlist || [];

      if (payments.length === 0) {
        hasMore = false;
      } else {
        allPayments.push(...payments);
        offset += batchSize;

        if (payments.length < batchSize) {
          hasMore = false;
        }
      }
    }

    return {
      success: true,
      data: { Payments_getlist: allPayments },
    };
  }

  /**
   * Fetch store loads (supplier purchases/invoices)
   */
  async getStoreLoads(filters?: any, offset?: number, length?: number) {
    const payload: any = {
      Storeloads_getlist: {
        filters: filters || {},
        extra_properties: ["all", "details"],
      },
    };

    if (offset !== undefined) {
      payload.Storeloads_getlist.offset = offset;
    }
    if (length !== undefined) {
      payload.Storeloads_getlist.length = length;
    }

    return this.request(payload);
  }

  /**
   * Fetch ALL store loads for a date range
   */
  async getAllStoreLoads(dateFrom: string, dateTo: string) {
    const allStoreLoads: any[] = [];
    const batchSize = 10000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getStoreLoads(
        { doc_date: [dateFrom, dateTo] },
        offset,
        batchSize
      );

      if (!response.success || !response.data) {
        return response;
      }

      const storeLoads = (response.data as any).Storeloads_getlist || [];

      if (storeLoads.length === 0) {
        hasMore = false;
      } else {
        allStoreLoads.push(...storeLoads);
        offset += batchSize;

        if (storeLoads.length < batchSize) {
          hasMore = false;
        }
      }
    }

    return {
      success: true,
      data: { Storeloads_getlist: allStoreLoads },
    };
  }

  /**
   * Fetch store loads details report rows (net + gross prices) for a date range.
   * Uses Reports_storeloads_details which exposes both без ДДС and с ДДС totals.
   */
  async getAllStoreLoadsDetailsRows(
    dateFrom: string,
    dateTo: string,
    options?: {
      statuses?: Array<0 | 1>;
      rowsPerPage?: number;
      columns?: string[];
    }
  ): Promise<BarsyResponse<{ rows: unknown[] }>> {
    const statuses = options?.statuses ?? [0, 1];
    const rowsPerPage = options?.rowsPerPage ?? 1000;
    const columns = options?.columns ?? [
      "store_load_id",
      "article_id",
      "article_name",
      "amount",
      "current_price",
      "current_price_total",
      "current_price_tax",
      "current_price_tax_total",
    ];

    const allRows: unknown[] = [];

    for (const status of statuses) {
      let pageNum = 1;

      while (true) {
        const payload: Record<string, unknown> = {
          Reports_storeloads_details: {
            action_type: "values" satisfies BarsyReportsActionType,
            filters: {
              ref_date: [dateFrom, dateTo],
              status: String(status),
            },
            columns,
            page_num: pageNum,
            rows: rowsPerPage,
          },
        };

        const response = await this.request<Record<string, unknown>>(payload);

        if (!response.success || !response.data) {
          return response as BarsyResponse<{ rows: unknown[] }>;
        }

        const report = response.data["Reports_storeloads_details"];
        if (!report || typeof report !== "object") {
          // Unexpected response shape: stop gracefully.
          break;
        }

        const reportObj = report as Record<string, unknown>;
        const rows = Array.isArray(reportObj.rows) ? reportObj.rows : [];
        allRows.push(...rows);

        const totalPagesRaw = reportObj.total;
        const totalPages =
          typeof totalPagesRaw === "number"
            ? totalPagesRaw
            : typeof totalPagesRaw === "string"
            ? Number.parseInt(totalPagesRaw, 10)
            : Number.NaN;

        // Prefer total page count if present; otherwise stop when the page is not full.
        if (Number.isFinite(totalPages) && totalPages > 0) {
          if (pageNum >= totalPages) break;
        } else if (rows.length < rowsPerPage) {
          break;
        }

        pageNum += 1;
      }
    }

    return {
      success: true,
      data: { rows: allRows },
    };
  }

  /**
   * Fetch suppliers
   */
  async getSuppliers(filters?: any) {
    return this.request({
      Suppliers_getlist: {
        filters: filters || {},
      },
    });
  }

  /**
   * Fetch depots/warehouses
   */
  async getDepots(filters?: any) {
    return this.request({
      Depots_getlist: {
        filters: filters || {},
      },
    });
  }

  /**
   * Fetch places (tables/areas)
   */
  async getPlaces(filters?: any) {
    return this.request({
      Places_getlist: {
        filters: filters || {},
      },
    });
  }

  /**
   * Fetch POS/cash registers
   */
  async getPoses(filters?: any) {
    return this.request({
      Poses_getlist: {
        filters: filters || {},
      },
    });
  }

  /**
   * Fetch payment methods
   */
  async getPaymentMethods() {
    return this.request({
      Paymentmethods_getlist: {},
    });
  }

  /**
   * Fetch tax groups
   */
  async getTaxGroups() {
    return this.request({
      Taxgroups_getlist: {},
    });
  }

  /**
   * Fetch currencies
   */
  async getCurrencies() {
    return this.request({
      Currencies_getlist: {},
    });
  }

  /**
   * Fetch store moves (internal transfers)
   */
  async getStoreMoves(filters?: any, offset?: number, length?: number) {
    const payload: any = {
      Storemoves_getlist: {
        filters: filters || {},
        extra_properties: ["all", "details"],
      },
    };

    if (offset !== undefined) {
      payload.Storemoves_getlist.offset = offset;
    }
    if (length !== undefined) {
      payload.Storemoves_getlist.length = length;
    }

    return this.request(payload);
  }

  /**
   * Fetch store productions
   */
  async getStoreProductions(filters?: any, offset?: number, length?: number) {
    const payload: any = {
      Storeproductions_getlist: {
        filters: filters || {},
        extra_properties: ["all", "details"],
      },
    };

    if (offset !== undefined) {
      payload.Storeproductions_getlist.offset = offset;
    }
    if (length !== undefined) {
      payload.Storeproductions_getlist.length = length;
    }

    return this.request(payload);
  }

  /**
   * Fetch store revisions (inventory audits)
   */
  async getStoreRevisions(filters?: any, offset?: number, length?: number) {
    const payload: any = {
      Revisions_getlist: {
        filters: filters || {},
        extra_properties: ["all", "details"],
      },
    };

    if (offset !== undefined) {
      payload.Revisions_getlist.offset = offset;
    }
    if (length !== undefined) {
      payload.Revisions_getlist.length = length;
    }

    return this.request(payload);
  }

  /**
   * Fetch barsy location details
   */
  async getBarsysInfo() {
    return this.request({
      Barsys_getlist: {},
    });
  }
}

/**
 * Factory to create Barsy clients for different locations
 */
export function createBarsyClient(
  location: "vitosha" | "ndk" | BarsyConfig
): BarsyApiClient {
  if (typeof location === "object") {
    return new BarsyApiClient(location);
  }

  const configs: Record<string, BarsyConfig> = {
    vitosha: {
      baseUrl: "https://memento4.barsy.bg",
      username: "Menelaos",
      password: "Menelaos123#",
    },
    ndk: {
      baseUrl: "https://memento3.barsy.bg",
      username: "Menelaos",
      password: "Menelaos123#",
    },
  };

  return new BarsyApiClient(configs[location]);
}
