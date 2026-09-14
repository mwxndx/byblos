import apiClient from '@/infrastructure/http/apiClient';

export interface CreatorRegistrationPayload {
  token: string;
  firstName: string;
  lastName: string;
  email: string;
  mpesaNumber: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export const register = async (payload: CreatorRegistrationPayload) => {
  const response = await apiClient.post('/creators/register', payload);
  return response.data;
};

export const login = async (emailOrCredentials: string | { email: string; password: string; acceptTerms?: boolean }, maybePassword?: string) => {
  const credentials = typeof emailOrCredentials === 'string'
    ? { email: emailOrCredentials, password: maybePassword }
    : emailOrCredentials;

  const response = await apiClient.post<unknown>('/creators/login', credentials);
  let responseBody: Record<string, unknown> | unknown = response?.data !== undefined ? response.data : response;
  if (typeof responseBody === 'string' && responseBody.trim()) {
    try {
      responseBody = JSON.parse(responseBody);
    } catch {
      /* ignore -- leaves responseBody as the raw string; the optional
         chains below then resolve everything to undefined rather than
         throwing, and the caller sees a login that silently has no
         creator/token instead of a clear parse-failure message. Tracked
         separately (creator TS review finding #5); out of scope for the
         precedence fix below. */
    }
  }

  const body = (responseBody ?? {}) as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;
  const rawCreator = data.creator ?? data.user ?? body.creator ?? body.user;
  const token = data.token ?? data.accessToken ?? body.token ?? body.accessToken;
  const refreshToken = data.refreshToken ?? body.refreshToken;

  // Previously spread `...responseBody` AFTER these resolved fields, so any
  // own top-level `creator`/`token`/`refreshToken` key on the raw response
  // body would silently win over the value resolved above -- a
  // precedence bug with no compiler signal (the whole function was typed
  // `any`). The real backend response nests these under `data` (see
  // creator.controller.js login), so this never fired in practice, but
  // nothing protected against it. No caller reads anything from the raw
  // body beyond these three fields (see useAuthActions.ts), so the spread
  // added risk without adding value -- dropped rather than just reordered.
  return {
    creator: rawCreator,
    token,
    refreshToken
  };
};

export const logout = async () => {
  const response = await apiClient.post('/creators/logout');
  return response.data;
};

export const forgotPassword = async (email: string): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/creators/forgot-password', {
    email: email.trim().toLowerCase(),
  });
  return response.data ?? { message: 'Password reset email sent.' };
};

export const resetPassword = async (
  token: string,
  newPassword: string,
  email: string,
): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/creators/reset-password', {
    token,
    newPassword,
    email,
  });
  return response.data ?? { message: 'Password has been reset.' };
};

export const verifyEmail = async (token: string, email: string) => {
  const response = await apiClient.get('/creators/verify-email', {
    params: { token, email }
  });
  return response.data;
};

export const resendVerification = async (email: string) => {
  const response = await apiClient.post('/creators/resend-verification', { email });
  return response.data;
};


