import apiClient from '@/infrastructure/http/apiClient';

// Both functions below previously called apiClient.get/patch with no type
// parameter, which defaults to axios's own `any` -- every property access
// on the unwrap chain was completely unchecked. <unknown> + explicit
// Record<string, unknown> narrowing instead (same pattern applied across
// the seller/buyer/admin API layers earlier this session); doesn't add
// full runtime schema validation of the creator profile shape, just
// removes the blanket any.
function unwrapCreator(resBody: Record<string, unknown>): unknown {
  const resData = (resBody.data && typeof resBody.data === 'object' ? resBody.data : undefined) as Record<string, unknown> | undefined;
  return resData?.creator ?? resData?.user ?? resBody.creator ?? resBody.user ?? (resData?.id ? resData : null);
}

export const getProfile = async () => {
  const response = await apiClient.get<unknown>('/creators/profile');
  const resBody = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;
  return unwrapCreator(resBody);
};

export interface UpdateCreatorProfilePayload {
  instagramLink?: string | null;
  tiktokLink?: string | null;
  whatsappNumber?: string | null;
  mpesaNumber?: string | null;
}

export const updateProfile = async (payload: UpdateCreatorProfilePayload) => {
  const response = await apiClient.patch<unknown>('/creators/profile', payload);
  const resBody = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;
  return unwrapCreator(resBody);
};
