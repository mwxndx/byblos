import { useMutation, useQueryClient } from '@tanstack/react-query';
import creatorApi from '@/features/creator/api';
import { creatorQueryKeys } from '@/features/creator/api/queryKeys';

export function useCreatorWithdrawalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => creatorApi.requestWithdrawal(amount),
    // Success/error toasts are owned by the caller (CreatorWithdrawalPanel) so
    // each fires exactly once — this hook toasting too produced two (sometimes
    // conflicting) messages per withdrawal. Here we only refresh the dashboard.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.dashboard() });
    },
  });
}


