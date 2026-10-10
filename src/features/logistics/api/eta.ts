import apiClient from '@/infrastructure/http/apiClient';

export interface ApiLiveEtaResponse {
  orderId: string;
  legId: string | null;
  trackingStatus: 'preparing' | 'waiting_for_location' | 'in_transit' | 'arriving' | 'delivered' | string;
  etaMinutes: number | null;
  estimatedArrival: string | null;
  routeProgress: number;
  lastUpdatedAt: string | null;
  isStale: boolean;
}


export async function fetchOrderLiveEta(orderId: string): Promise<ApiLiveEtaResponse> {
  const response = await apiClient.get<{ status: string; data: ApiLiveEtaResponse }>(`/orders/${orderId}/live-eta`);
  return response.data;
}

