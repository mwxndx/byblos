import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelCollaborationRequest } from '../../api/marketplace';
import { creatorQueryKeys } from '../../api/queryKeys';

/**
 * Cancels a creator's pending collaboration request to a brand/shop and
 * refreshes the available shops & creator dashboard caches.
 */
export function useCancelCollaborationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sellerId: number) => cancelCollaborationRequest(sellerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.availableShops() });
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.dashboard() });
    },
  });
}

