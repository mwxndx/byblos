import { useMutation, useQueryClient } from '@tanstack/react-query';
import creatorApi from '@/features/creator/api';
import { creatorQueryKeys } from '@/features/creator/api/queryKeys';

export function useDenyShopRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string | number) => creatorApi.denyShopRequest(inviteId),
    // Toasts are owned by the caller (CreatorDashboard.handleShopRequest) so each
    // fires exactly once; this hook only refreshes the dashboard on success.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.dashboard() });
    },
  });
}


