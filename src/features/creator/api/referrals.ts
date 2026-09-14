import apiClient from '@/infrastructure/http/apiClient';

// <unknown> instead of no type parameter (defaults to axios's own `any`) --
// see the matching comment in profile.ts.
export const getReferralDashboard = async () => {
  const response = await apiClient.get<unknown>('/creators/referral/dashboard');
  const body = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;
  return body.data;
};

export const generateReferralCode = async () => {
  const response = await apiClient.post<unknown>('/creators/referral/generate-code');
  const body = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;
  const data = (body.data && typeof body.data === 'object' ? body.data : undefined) as Record<string, unknown> | undefined;
  return data?.referralCode;
};

export const trackLinkClick = async (code: string) => {
  const response = await apiClient.post<unknown>(`/creators/links/${encodeURIComponent(code)}/click`);
  return response.data;
};


