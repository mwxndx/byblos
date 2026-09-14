import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminApi } from '@/features/admin/api';
import { adminQueryKeys } from '@/features/admin/api/queryKeys';

export interface PaginatedQueryParams {
  page: number;
  search?: string;
}

export function useAdminAnalyticsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.analytics(),
    queryFn: adminApi.getAnalytics,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminSellersQuery({ page, search }: PaginatedQueryParams, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.sellers(page, search),
    queryFn: () => adminApi.getSellers({ page, search }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    // Keeps the previous page's rows on screen while the next page loads,
    // instead of the table flashing empty/loading on every page click or
    // search keystroke.
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdminCreatorsQuery({ page, search }: PaginatedQueryParams, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.creators(page, search),
    queryFn: () => adminApi.getCreators({ page, search }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdminBuyersQuery({ page, search }: PaginatedQueryParams, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.buyers(page, search),
    queryFn: () => adminApi.getBuyers({ page, search }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdminWithdrawalsQuery({ page, search }: PaginatedQueryParams, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.withdrawals(page, search),
    queryFn: () => adminApi.getWithdrawalRequests({ page, search }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdminMonthlyMetricsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.monthlyMetrics(),
    queryFn: adminApi.getMonthlyMetrics,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminFinancialsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.financials(),
    queryFn: adminApi.getFinancialMetrics,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminMonthlyFinancialDataQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.monthlyFinancialData(),
    queryFn: adminApi.getMonthlyFinancialData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminDashboardStatsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.dashboardStats(),
    queryFn: adminApi.getDashboardStats,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminClientsQuery({ page, search }: PaginatedQueryParams, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.clients(page, search),
    queryFn: () => adminApi.getClients({ page, search }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdminBalancesQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.balances(),
    queryFn: adminApi.getPaymentProviderBalances,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}


