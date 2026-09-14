import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveInvitedBusiness } from '../../api/marketplace';
import { creatorQueryKeys } from '../../api/queryKeys';

// Previously hardcoded ['creator', 'dashboard'] / ['creator', 'referrals']
// instead of importing the shared key factory -- these happened to still
// match today only because they're a shorter prefix than
// creatorQueryKeys.dashboard()'s period-suffixed key, but that's
// incidental: a future reshape of the factory's key structure would silently
// stop applying here since this file never imports it, reintroducing the
// exact stale-cache class of bug the factory's dashboard() fix (see
// queryKeys.ts) addressed.
export function useLeaveInvitedBusinessMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sellerId: number) => leaveInvitedBusiness(sellerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.referrals() });
    },
  });
}
