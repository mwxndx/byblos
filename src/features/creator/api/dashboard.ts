import apiClient from '@/infrastructure/http/apiClient';

// The backend's CREATOR_ANALYSIS_PERIODS (creator.service.js) has always
// supported 'yearly' alongside daily/weekly/monthly; this signature just
// didn't declare it, which is what forced the `as 'daily'|'weekly'|'monthly'`
// cast at the one call site (useCreatorDashboardQuery.ts) -- silently
// hiding that a real, valid value ('yearly', sent whenever the analytics
// "Yearly" tab is selected) didn't type-check against this function.
export const getDashboard = async (period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly') => {
  const response = await apiClient.get('/creators/dashboard', {
    params: { period }
  });
  return response.data?.data;
};


