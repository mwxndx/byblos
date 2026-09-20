import type { WithdrawalStatus } from '@/shared/types/api/withdrawal';

// Matches the shape the backend's pagination.utils.js (buildPaginationMeta)
// already returns for every paginated admin list endpoint, and the same
// PaginationMeta shape src/features/shop/api/types.ts uses for the public
// catalog -- kept as its own copy here rather than importing across feature
// slices.
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginatedList<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface DashboardAnalytics {
  totalRevenue?: number;
  totalProducts?: number;
  totalSellers?: number;
  totalCreators?: number;
  totalBuyers?: number;
  monthlyGrowth?: {
    revenue?: number;
    products?: number;
    sellers?: number;
    buyers?: number;
    wishlists?: number;
  };
  totalWishlists?: number;
  activeOrders?: number;
  lowStockProducts?: number;
  pendingWithdrawals?: number;
  pendingWithdrawalAmount?: number;
  pendingCreatorRequests?: number;
  totalCreatorEarnings?: number;
  totalCreatorSales?: number;
  totalCreatorLinkClicks?: number;
  userGrowth?: Array<{ name: string; buyers: number; sellers: number }>;
  revenueTrends?: Array<{ name: string; revenue: number; orders: number }>;
  salesTrends?: Array<{ name: string; sales: number }>;
  productStatus?: Array<{ name: string; value: number }>;
  geoDistribution?: Array<{ name: string; value: number }>;
}

// ... (existing interfaces)

// ... (existing interfaces)


export interface MonthlyMetricsData {
  month: string;
  sellerCount: number;
  productCount: number;
  buyerCount: number;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  mpesaNumber: string;
  mpesaName: string;
  // The real backend statuses (WithdrawalStatus) plus 'pending', which the admin
  // list uses as a display default when a row has no status yet. NOT `| string`:
  // that collapsed the whole union to `string` and removed all compile-time
  // protection against the status-mismatch class that already broke this table.
  status: WithdrawalStatus | 'pending';
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  providerReference?: string | null;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface FinancialMetrics {
  totalSales: number;
  totalOrders: number;
  totalCommission: number;
  totalRefunds: number;
  totalRefundRequests: number;
  pendingRefunds: number;
  netRevenue: number;
}

export interface MonthlyFinancialData {
  month: string;
  sales: number;
  commission: number;
  refunds: number;
}

export interface DashboardState {
  analytics: DashboardAnalytics;
  sellers: Array<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    status: string;
    phone?: string;
    city: string;
    location: string;
    createdAt: string;
  }>;
  creators: Array<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    mpesaNumber: string;
    whatsappNumber: string;
    instagramLink: string;
    tiktokLink: string;
    balance: number;
    totalSales: number;
    totalEarnings: number;
    totalReferralEarnings: number;
    totalIncome: number;
    linkedShops: number;
    linkClicks: number;
    pendingRequests: number;
    status: string;
    createdAt: string;
  }>;
  buyers: Array<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    phone?: string;
    status: string;
    city: string;
    location: string;
    createdAt: string;
  }>;
  withdrawalRequests: WithdrawalRequest[];
  monthlyMetrics: MonthlyMetricsData[];
  financialMetrics: FinancialMetrics;
  monthlyFinancialData: MonthlyFinancialData[];
  topShops: unknown[];
  providerHealth: unknown;
}

// One pagination meta per paginated admin list -- these 4 endpoints (buyers,
// sellers, creators, withdrawal requests) are the ones that moved from
// "fetch the whole table" to real page/limit/search pagination.
export interface DashboardPaginationState {
  sellers: PaginationMeta;
  creators: PaginationMeta;
  buyers: PaginationMeta;
  withdrawalRequests: PaginationMeta;
}

export const EMPTY_PAGINATION: PaginationMeta = { total: 0, page: 1, pageSize: 25, hasMore: false };

export type AdminSeller = DashboardState['sellers'][number];
export type AdminCreator = DashboardState['creators'][number];
export type AdminBuyer = DashboardState['buyers'][number];
