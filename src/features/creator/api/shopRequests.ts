import apiClient from '@/infrastructure/http/apiClient';

// <unknown> instead of no type parameter (defaults to axios's own `any`) --
// see the matching comment in profile.ts.
export const acceptShopRequest = async (inviteId: number | string) => {
  const response = await apiClient.post<unknown>(`/creators/shop-requests/${inviteId}/accept`);
  const body = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;
  return body.data;
};

export const denyShopRequest = async (inviteId: number | string) => {
  const response = await apiClient.post<unknown>(`/creators/shop-requests/${inviteId}/deny`);
  const body = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;
  return body.data;
};


