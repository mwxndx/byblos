import apiClient from '@/infrastructure/http/apiClient';

// The backend's CREATOR_ANALYSIS_PERIODS (creator.service.js) has always
// supported 'yearly' alongside daily/weekly/monthly; this signature just
// didn't declare it, which is what forced the `as 'daily'|'weekly'|'monthly'`
// cast at the one call site (useCreatorDashboardQuery.ts) -- silently
// hiding that a real, valid value ('yearly', sent whenever the analytics
// "Yearly" tab is selected) didn't type-check against this function.
// <unknown> instead of no type parameter at all (which defaults to axios's
// own `any`) -- see the fuller comment on sellerOrdersApi.getOrders in
// seller/api/ordersApi.ts for why. Doesn't add full runtime schema
// validation of the dashboard payload's shape (shops/shopRequests/
// clearance/etc.) -- that's a larger, separate change; this narrows the
// unwrap boundary only.
export const getDashboard = async (period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly'): Promise<unknown> => {
  const response = await apiClient.get<unknown>('/creators/dashboard', {
    params: { period }
  });
  const body = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;
  return body.data;
};


