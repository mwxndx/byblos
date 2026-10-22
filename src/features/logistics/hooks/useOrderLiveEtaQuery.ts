import { useQuery } from '@tanstack/react-query';
import { fetchOrderLiveEta, type ApiLiveEtaResponse } from '../api/eta';
import { logisticsQueryKeys } from '../api/queryKeys';

export type OrderLiveEta = ApiLiveEtaResponse;

export function useOrderLiveEtaQuery(orderId: string | undefined, isTrackingActive: boolean) {
  return useQuery<ApiLiveEtaResponse>({
    queryKey: logisticsQueryKeys.liveEta(orderId),
    queryFn: () => fetchOrderLiveEta(orderId!),
    enabled: Boolean(orderId && isTrackingActive),
    refetchInterval: isTrackingActive ? 10_000 : false,
    staleTime: 5_000,
    gcTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
