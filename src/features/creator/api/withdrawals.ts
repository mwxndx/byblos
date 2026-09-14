import apiClient from '@/infrastructure/http/apiClient';

// <unknown> instead of no type parameter (defaults to axios's own `any`) --
// see the matching comment in profile.ts.
export const requestWithdrawal = async (amount: number | string) => {
  const idempotencyKey = `creator-withdrawal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await apiClient.post<unknown>(
    '/creators/withdrawals',
    { amount, idempotencyKey },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  const body = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;
  const data = (body.data && typeof body.data === 'object' ? body.data : undefined) as Record<string, unknown> | undefined;
  return data?.withdrawal;
};


