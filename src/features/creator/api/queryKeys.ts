export const creatorQueryKeys = {
  all: ['creator'] as const,
  // Omit `period` to build a period-agnostic prefix that matches (and
  // invalidates) the dashboard query no matter which period is currently
  // selected -- TanStack Query treats a shorter key as a prefix match for
  // any longer key sharing that prefix. Previously always appended a
  // period, defaulting to the literal string '30d' when none was given --
  // a value that was never an actual period (useCreatorDashboardQuery.ts
  // only ever uses 'daily'/'weekly'/'monthly'/'yearly'). Every no-argument
  // caller is an invalidateQueries() after a mutation
  // (useAcceptShopRequestMutation, useDenyShopRequestMutation,
  // useCreatorWithdrawalMutation), so that fake sentinel built
  // ['creator','dashboard','30d'], which never matched the live
  // ['creator','dashboard','monthly'] (or whichever period the dashboard
  // was actually showing) key -- a silent invalidation no-op. A creator
  // accepting/denying a shop request or requesting a withdrawal saw stale
  // dashboard numbers until an unrelated refetch happened to fire.
  dashboard: (period?: string) => (period
    ? [...creatorQueryKeys.all, 'dashboard', period] as const
    : [...creatorQueryKeys.all, 'dashboard'] as const),
  referrals: () => [...creatorQueryKeys.all, 'referrals'] as const,
  invite: (token: string) => [...creatorQueryKeys.all, 'invite', token] as const,
  profile: () => [...creatorQueryKeys.all, 'profile'] as const,
  availableShops: () => [...creatorQueryKeys.all, 'available-shops'] as const,
};


