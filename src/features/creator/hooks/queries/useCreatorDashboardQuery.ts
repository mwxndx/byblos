import { useQuery } from '@tanstack/react-query';
import creatorApi from '@/features/creator/api';
import { creatorQueryKeys } from '@/features/creator/api/queryKeys';
import type { AnalysisPeriod } from '@/features/creator/utils/creatorDashboardUtils';

// Default was '30d' -- never a valid period (getDashboard only accepts
// daily/weekly/monthly/yearly) and never what any real caller passes
// (CreatorDashboard.tsx always supplies an explicit AnalysisPeriod). Calling
// this hook with no argument sent an invalid `period` value to the API.
export function useCreatorDashboardQuery(period: AnalysisPeriod = 'monthly', enabled = true) {
  return useQuery({
    queryKey: creatorQueryKeys.dashboard(period),
    // `period` is now genuinely typed AnalysisPeriod (matching what
    // getDashboard accepts), so no cast is needed -- previously `as
    // 'daily'|'weekly'|'monthly'` silently dropped 'yearly' from the type,
    // even though the analytics "Yearly" tab sends exactly that value and
    // the backend has always supported it (see the comment in dashboard.ts).
    queryFn: () => creatorApi.getDashboard(period),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}


