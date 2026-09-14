import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/features/seller/api';
import { sellerQueryKeys } from '@/features/seller/api/queryKeys';

export function useSellerWithdrawalsQuery(enabled = true) {
  return useQuery({
    queryKey: sellerQueryKeys.withdrawals(),
    queryFn: sellerApi.getWithdrawalRequests,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export function useRequestWithdrawalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    // idempotencyKey is required here (matching sellerApi.requestWithdrawal's
    // real, required idempotencyKey: string) rather than the previous
    // optional `?: string`, which forced an `as unknown as
    // Parameters<...>` double-cast to bridge the two. That cast currently
    // didn't misbehave -- requestWithdrawal has its own runtime guard
    // (`if (!data.idempotencyKey) throw`) -- but gave zero compile-time
    // protection: a future refactor of this hook's caller that dropped the
    // key would compile clean and only fail at runtime. Types now match
    // exactly, so no cast is needed at all.
    mutationFn: (args: { amount: number; mpesaNumber: string; mpesaName: string; idempotencyKey: string }) =>
      sellerApi.requestWithdrawal(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.withdrawals() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.analytics() });
    },
  });
}


