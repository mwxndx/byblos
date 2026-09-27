import { useQuery } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';

export function useRefundHistoryQuery(enabled = true) {
  return useQuery({
    queryKey: buyerQueryKeys.refundHistory(),
    queryFn: () => buyerApi.getRefundHistory(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}
