import apiClient from '@/infrastructure/http/apiClient';

// <unknown> instead of no type parameter (defaults to axios's own `any`) --
// see the matching comment in profile.ts.
export const getInvite = async (token: string) => {
  const response = await apiClient.get<unknown>(`/creators/invites/${token}`);
  const body = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;
  const data = (body.data && typeof body.data === 'object' ? body.data : undefined) as Record<string, unknown> | undefined;
  return data?.invite;
};


