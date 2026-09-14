import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leavePromotedShop } from '../../api/marketplace';
import { creatorQueryKeys } from '../../api/queryKeys';

// See the matching comment in useLeaveInvitedBusinessMutation.ts -- imports
// the shared key factory instead of hardcoding the raw arrays it builds.
export function useLeavePromotedShopMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sellerId: number) => leavePromotedShop(sellerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.availableShops() });
    },
  });
}
