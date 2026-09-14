import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestCollaboration } from '../../api/marketplace';
import { creatorQueryKeys } from '../../api/queryKeys';

// See the matching comment in useLeaveInvitedBusinessMutation.ts -- imports
// the shared key factory instead of hardcoding the raw arrays it builds.
export function useRequestCollaborationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sellerId, message }: { sellerId: number; message?: string }) =>
      requestCollaboration(sellerId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.availableShops() });
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.dashboard() });
    },
  });
}
