import { useQuery } from '@tanstack/react-query';
import { getAvailableShops, type AvailableShop } from '../../api/marketplace';
import { creatorQueryKeys } from '../../api/queryKeys';

// See the matching comment in useLeaveInvitedBusinessMutation.ts -- imports
// the shared key factory instead of hardcoding the raw array it builds, so
// this query's cache key and the mutations that invalidate it
// (useLeavePromotedShopMutation, useRequestCollaborationMutation) can never
// drift apart.
export function useAvailableShopsQuery() {
  return useQuery<AvailableShop[]>({
    queryKey: creatorQueryKeys.availableShops(),
    queryFn: () => getAvailableShops(),
    staleTime: 60 * 1000,
  });
}
