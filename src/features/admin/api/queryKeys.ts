export const adminQueryKeys = {
  all: ['admin'] as const,
  profile: () => [...adminQueryKeys.all, 'profile'] as const,
  logistics: (status?: string, sort?: string) => [...adminQueryKeys.all, 'logistics', status || 'all', sort || 'priority'] as const,
  users: () => [...adminQueryKeys.all, 'users'] as const,
  // Each paginated list has a base/prefix key (no page or search) for
  // invalidating every cached page+search variant at once -- e.g. after a
  // delete, the admin doesn't know which page/search combos are cached, so
  // invalidateQueries needs to match all of them, not just page 1 with no
  // search. TanStack Query's default partial-match invalidation matches any
  // query key that starts with the array passed in, so invalidating the
  // base key covers every paginated variant below it.
  withdrawalsAll: () => [...adminQueryKeys.all, 'withdrawals'] as const,
  withdrawals: (page = 1, search = '') => [...adminQueryKeys.withdrawalsAll(), page, search] as const,
  analytics: () => [...adminQueryKeys.all, 'analytics'] as const,
  sellersAll: () => [...adminQueryKeys.all, 'sellers'] as const,
  sellers: (page = 1, search = '') => [...adminQueryKeys.sellersAll(), page, search] as const,
  creatorsAll: () => [...adminQueryKeys.all, 'creators'] as const,
  creators: (page = 1, search = '') => [...adminQueryKeys.creatorsAll(), page, search] as const,
  buyersAll: () => [...adminQueryKeys.all, 'buyers'] as const,
  buyers: (page = 1, search = '') => [...adminQueryKeys.buyersAll(), page, search] as const,
  financials: () => [...adminQueryKeys.all, 'financials'] as const,
  balances: () => [...adminQueryKeys.all, 'balances'] as const,
  dashboardStats: () => [...adminQueryKeys.all, 'dashboardStats'] as const,
  monthlyMetrics: () => [...adminQueryKeys.all, 'monthlyMetrics'] as const,
  monthlyFinancialData: () => [...adminQueryKeys.all, 'monthlyFinancialData'] as const,
  refunds: (status?: string) => [...adminQueryKeys.all, 'refunds', status || 'all'] as const,
  flaggedEarnings: () => [...adminQueryKeys.all, 'flaggedEarnings'] as const,
};


