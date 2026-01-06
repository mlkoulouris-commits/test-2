/**
 * Barsy Sync Types and Configuration
 * Defines the sync categories, types, and their relationships
 */

// Sync categories for UI organization
export type SyncCategory =
  | 'reference'    // Static reference data (payment methods, taxes, etc.)
  | 'catalog'      // Master catalog data (articles, categories, suppliers)
  | 'production'   // Production-related data (recipes, staff)
  | 'inventory'    // Inventory operations (store loads, outs, levels)
  | 'sales';       // Sales operations (orders, accounts, payments)

// Individual sync types
export type SyncType =
  // Reference Data
  | 'payment_methods'
  | 'tax_groups'
  | 'currencies'
  | 'depots'
  | 'poses'
  | 'places'
  // Catalog/Master Data
  | 'categories'
  | 'articles'
  | 'suppliers'
  | 'clients'
  // Production Data
  | 'recipes'
  | 'users'
  // Inventory Operations
  | 'store_loads'
  | 'store_outs'
  | 'store_amounts'
  // Sales Operations
  | 'orders'
  | 'accounts'
  | 'payments'
  | 'transactions';

export interface SyncTypeConfig {
  id: SyncType;
  label: string;
  description: string;
  category: SyncCategory;
  requiresDateRange: boolean;
  estimatedDuration: 'fast' | 'medium' | 'slow';
  dependencies?: SyncType[];
  canRunInParallel?: boolean;
  icon?: string;
}

export interface SyncCategoryConfig {
  id: SyncCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  order: number;
}

// Category configurations
export const SYNC_CATEGORIES: Record<SyncCategory, SyncCategoryConfig> = {
  reference: {
    id: 'reference',
    label: 'Reference Data',
    description: 'Static configuration data that rarely changes',
    icon: '⚙️',
    color: 'slate',
    order: 1,
  },
  catalog: {
    id: 'catalog',
    label: 'Catalog & Master Data',
    description: 'Products, categories, and business partners',
    icon: '📦',
    color: 'blue',
    order: 2,
  },
  production: {
    id: 'production',
    label: 'Production & Staff',
    description: 'Recipes, BOM, and staff information',
    icon: '👨‍🍳',
    color: 'purple',
    order: 3,
  },
  inventory: {
    id: 'inventory',
    label: 'Inventory Operations',
    description: 'Stock movements, purchases, and current levels',
    icon: '📊',
    color: 'green',
    order: 4,
  },
  sales: {
    id: 'sales',
    label: 'Sales & Transactions',
    description: 'Orders, bills, payments, and transaction processing',
    icon: '💰',
    color: 'amber',
    order: 5,
  },
};

// Individual sync type configurations
export const SYNC_TYPES: Record<SyncType, SyncTypeConfig> = {
  // Reference Data - can all run in parallel, no date range needed
  payment_methods: {
    id: 'payment_methods',
    label: 'Payment Methods',
    description: 'Cash, card, and other payment types',
    category: 'reference',
    requiresDateRange: false,
    estimatedDuration: 'fast',
    canRunInParallel: true,
  },
  tax_groups: {
    id: 'tax_groups',
    label: 'Tax Groups',
    description: 'VAT and tax rate configurations',
    category: 'reference',
    requiresDateRange: false,
    estimatedDuration: 'fast',
    canRunInParallel: true,
  },
  currencies: {
    id: 'currencies',
    label: 'Currencies',
    description: 'Currency definitions and exchange rates',
    category: 'reference',
    requiresDateRange: false,
    estimatedDuration: 'fast',
    canRunInParallel: true,
  },
  depots: {
    id: 'depots',
    label: 'Depots/Warehouses',
    description: 'Storage locations and warehouses',
    category: 'reference',
    requiresDateRange: false,
    estimatedDuration: 'fast',
    canRunInParallel: true,
  },
  poses: {
    id: 'poses',
    label: 'POS/Registers',
    description: 'Point of sale terminals and cash registers',
    category: 'reference',
    requiresDateRange: false,
    estimatedDuration: 'fast',
    canRunInParallel: true,
  },
  places: {
    id: 'places',
    label: 'Places/Tables',
    description: 'Tables, areas, and service locations',
    category: 'reference',
    requiresDateRange: false,
    estimatedDuration: 'fast',
    canRunInParallel: true,
  },

  // Catalog/Master Data
  categories: {
    id: 'categories',
    label: 'Categories',
    description: 'Product category hierarchy',
    category: 'catalog',
    requiresDateRange: false,
    estimatedDuration: 'fast',
    canRunInParallel: true,
  },
  articles: {
    id: 'articles',
    label: 'Articles/Products',
    description: 'Product catalog with prices and attributes',
    category: 'catalog',
    requiresDateRange: false,
    estimatedDuration: 'medium',
    dependencies: ['categories'],
    canRunInParallel: false,
  },
  suppliers: {
    id: 'suppliers',
    label: 'Suppliers',
    description: 'Vendor and supplier information',
    category: 'catalog',
    requiresDateRange: false,
    estimatedDuration: 'fast',
    canRunInParallel: true,
  },
  clients: {
    id: 'clients',
    label: 'Clients/Customers',
    description: 'Customer database with loyalty info',
    category: 'catalog',
    requiresDateRange: false,
    estimatedDuration: 'medium',
    canRunInParallel: true,
  },

  // Production Data
  users: {
    id: 'users',
    label: 'Users/Staff',
    description: 'Staff members and their roles',
    category: 'production',
    requiresDateRange: false,
    estimatedDuration: 'fast',
    canRunInParallel: true,
  },
  recipes: {
    id: 'recipes',
    label: 'Recipes/BOM',
    description: 'Product recipes and bill of materials',
    category: 'production',
    requiresDateRange: false,
    estimatedDuration: 'slow',
    dependencies: ['articles'],
    canRunInParallel: false,
  },

  // Inventory Operations
  store_loads: {
    id: 'store_loads',
    label: 'Store Loads (Purchases)',
    description: 'Supplier deliveries and purchase invoices',
    category: 'inventory',
    requiresDateRange: true,
    estimatedDuration: 'medium',
    dependencies: ['suppliers', 'articles'],
    canRunInParallel: true,
  },
  store_outs: {
    id: 'store_outs',
    label: 'Store Outs (Write-offs)',
    description: 'Inventory write-offs and wastage',
    category: 'inventory',
    requiresDateRange: true,
    estimatedDuration: 'medium',
    dependencies: ['articles'],
    canRunInParallel: true,
  },
  store_amounts: {
    id: 'store_amounts',
    label: 'Current Stock Levels',
    description: 'Current inventory quantities by depot',
    category: 'inventory',
    requiresDateRange: false,
    estimatedDuration: 'medium',
    dependencies: ['articles', 'depots'],
    canRunInParallel: true,
  },

  // Sales Operations
  orders: {
    id: 'orders',
    label: 'Orders',
    description: 'Individual order line items',
    category: 'sales',
    requiresDateRange: true,
    estimatedDuration: 'slow',
    dependencies: ['articles', 'users'],
    canRunInParallel: true,
  },
  accounts: {
    id: 'accounts',
    label: 'Accounts (Bills)',
    description: 'Customer bills and tabs',
    category: 'sales',
    requiresDateRange: true,
    estimatedDuration: 'medium',
    dependencies: ['clients', 'users'],
    canRunInParallel: true,
  },
  payments: {
    id: 'payments',
    label: 'Payments',
    description: 'Payment transactions',
    category: 'sales',
    requiresDateRange: true,
    estimatedDuration: 'medium',
    dependencies: ['payment_methods', 'accounts'],
    canRunInParallel: true,
  },
  transactions: {
    id: 'transactions',
    label: 'Create Transactions',
    description: 'Transform orders to Memento transactions',
    category: 'sales',
    requiresDateRange: true,
    estimatedDuration: 'medium',
    dependencies: ['orders', 'recipes', 'store_amounts'],
    canRunInParallel: false,
  },
};

// Get sync types by category
export const getSyncTypesByCategory = (category: SyncCategory): SyncTypeConfig[] => {
  return Object.values(SYNC_TYPES).filter((type) => type.category === category);
};

// Get all categories in order
export const getOrderedCategories = (): SyncCategoryConfig[] => {
  return Object.values(SYNC_CATEGORIES).sort((a, b) => a.order - b.order);
};

// Sync result interface
export interface SyncResult {
  success: boolean;
  syncType: SyncType;
  recordsSynced?: number;
  error?: string;
  durationMs?: number;
}

// Batch sync configuration
export interface BatchSyncConfig {
  syncTypes: SyncType[];
  dateFrom?: string;
  dateTo?: string;
  parallel?: boolean;
}

// Sync progress tracking
export interface SyncProgress {
  totalSteps: number;
  currentStep: number;
  currentSyncType: SyncType | null;
  completedTypes: SyncType[];
  failedTypes: SyncType[];
  results: SyncResult[];
  startTime: number;
  isRunning: boolean;
}

// Pre-defined sync profiles for common use cases
export const SYNC_PROFILES = {
  // Quick sync: Just reference data (fast, runs in parallel)
  quick: {
    name: 'Quick Sync',
    description: 'Reference data only (fast)',
    syncTypes: [
      'payment_methods',
      'tax_groups',
      'currencies',
      'depots',
      'poses',
      'places',
    ] as SyncType[],
    requiresDateRange: false,
  },

  // Master data: Catalog and reference data
  masterData: {
    name: 'Master Data',
    description: 'All catalog and reference data',
    syncTypes: [
      'payment_methods',
      'tax_groups',
      'currencies',
      'depots',
      'poses',
      'places',
      'categories',
      'articles',
      'suppliers',
      'clients',
      'users',
    ] as SyncType[],
    requiresDateRange: false,
  },

  // Full catalog: Master data + recipes
  fullCatalog: {
    name: 'Full Catalog',
    description: 'All catalog data including recipes',
    syncTypes: [
      'categories',
      'articles',
      'suppliers',
      'clients',
      'users',
      'recipes',
    ] as SyncType[],
    requiresDateRange: false,
  },

  // Daily sales: Orders, accounts, payments for a date range
  dailySales: {
    name: 'Daily Sales',
    description: 'Orders, accounts, and payments',
    syncTypes: ['orders', 'accounts', 'payments'] as SyncType[],
    requiresDateRange: true,
  },

  // Inventory: Store loads, outs, and current levels
  inventory: {
    name: 'Inventory Sync',
    description: 'Purchases, write-offs, and stock levels',
    syncTypes: ['store_loads', 'store_outs', 'store_amounts'] as SyncType[],
    requiresDateRange: true,
  },

  // Complete: Everything in proper order
  complete: {
    name: 'Complete Sync',
    description: 'Full sync of all data (recommended order)',
    syncTypes: [
      // Phase 1: Reference (parallel)
      'payment_methods',
      'tax_groups',
      'currencies',
      'depots',
      'poses',
      'places',
      // Phase 2: Catalog (categories first, then rest parallel)
      'categories',
      'articles',
      'suppliers',
      'clients',
      'users',
      // Phase 3: Recipes (depends on articles)
      'recipes',
      // Phase 4: Inventory (parallel, date-based)
      'store_loads',
      'store_outs',
      'store_amounts',
      // Phase 5: Sales (parallel, date-based)
      'orders',
      'accounts',
      'payments',
      // Phase 6: Post-processing
      'transactions',
    ] as SyncType[],
    requiresDateRange: true,
  },
} as const;

export type SyncProfile = keyof typeof SYNC_PROFILES;
