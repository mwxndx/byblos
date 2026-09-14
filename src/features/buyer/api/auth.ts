import apiClient, { getFreshCsrfToken } from '@/infrastructure/http/apiClient';
import { buyerApiInstance, ApiError } from './instance';
import { Buyer, transformBuyer } from './profile';

interface LoginApiResponse {
  status: string;
  message?: string;
  data: {
    buyer: Buyer;
    token?: string;
    refreshToken?: string;
  };
}

export interface LoginResponse {
  buyer?: Buyer;
  token?: string;
  refreshToken?: string;
  status?: string;
  message?: string;
}

interface RegisterResponse {
  status: string;
  message?: string;
  data: {
    buyer?: Buyer;
    email?: string;
    emailVerificationRequired?: boolean;
    emailVerificationSent?: boolean;
  };
}

export interface RegisterData {
  fullName: string;
  email: string;
  mobilePayment: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
  city: string;
  location: string;
}

// <unknown> + explicit narrowing instead of the previous <any> -- <any>
// meant every property read below (responseBody.status, responseData?.buyer,
// etc.) was completely unchecked, so the eventual Promise<LoginResponse>
// return type was pure assertion, trusted on nothing. A payload contract
// drift (e.g. the backend renaming `buyer` to `user` only, or moving `token`
// under a different key not covered by the existing fallback chain) would
// compile clean and only surface at runtime as a generic "unable to load
// buyer account details" error with no signal about what actually changed.
export async function login(credentials: { email: string; password: string; acceptTerms?: boolean }): Promise<LoginResponse> {
  const response = await apiClient.post<unknown>('/buyers/login', credentials);
  let responseBody: unknown = response?.data !== undefined ? response.data : response;
  if (typeof responseBody === 'string' && responseBody.trim()) {
    try {
      responseBody = JSON.parse(responseBody);
    } catch {
      /* ignore json parse error */
    }
  }

  if (!responseBody || typeof responseBody !== 'object') {
    throw new Error('Unable to connect to server. Please try again.');
  }

  const body = responseBody as Record<string, unknown>;

  if (body.status === 'error' || body.status === 'fail') {
    throw new Error(String(body.message || body.error || 'Login failed'));
  }

  const responseData = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>;
  const rawBuyer = responseData.buyer ?? responseData.user ?? body.buyer ?? body.user ?? (responseData.id ? responseData : null);
  const token = (responseData.token ?? responseData.accessToken ?? body.token ?? body.accessToken) as string | undefined;
  const refreshToken = (responseData.refreshToken ?? body.refreshToken) as string | undefined;

  if (!rawBuyer) {
    throw new Error(String(body.message || 'Unable to load buyer account details. Please try again.'));
  }

  return { buyer: transformBuyer(rawBuyer), token, refreshToken };
}

export async function register(data: RegisterData): Promise<LoginResponse> {
  const payload = {
    fullName: data.fullName,
    email: data.email,
    mobile_payment: data.mobilePayment,
    whatsapp_number: data.whatsappNumber,
    password: data.password,
    confirmPassword: data.confirmPassword,
    city: data.city,
    location: data.location,
    termsAccepted: (data as unknown as Record<string, unknown>).termsAccepted === true
  };

  const response = await buyerApiInstance.post<RegisterResponse>('/buyers/register', payload);
  const responseBody = response.data;
  const responseData = responseBody?.data;

  if (!responseBody || typeof responseBody !== 'object') {
    const httpStatus = response?.status;
    if (httpStatus && httpStatus >= 500) {
      throw new Error(`Server temporarily unavailable (HTTP ${httpStatus}). Please try again later.`);
    }
    throw new Error('Malformed server response payload. Please try again.');
  }

  if (responseBody.status === 'success' && responseData?.emailVerificationRequired) {
    return {
      status: 'pending_verification',
      message: responseBody.message
    };
  }

  const { buyer } = responseData || {};

  if (!buyer) {
    throw new Error('Registration response incomplete: missing buyer profile details.');
  }

  await getFreshCsrfToken();

  return { buyer: transformBuyer(buyer) };
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  try {
    const response = await buyerApiInstance.post<{ message: string }>(
      '/buyers/resend-verification',
      { email: email.trim().toLowerCase() }
    );
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    throw new Error(err.response?.data?.message || 'Failed to resend verification email');
  }
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.post<{ message: string }>(
      `/buyers/forgot-password`,
      { email: email.trim().toLowerCase() }
    );

    if (!response.data || typeof response.data.message !== 'string') {
      return { message: 'Password reset email sent successfully' };
    }

    return response.data;
  } catch (error) {
    const err = error as ApiError;
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw error;
  }
}

export async function resetPassword(token: string, newPassword: string, email: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.post<{ message: string }>(
      `/buyers/reset-password`,
      { token, newPassword, email }
    );

    if (!response.data || typeof response.data.message !== 'string') {
      return { message: 'Password has been reset successfully' };
    }

    return response.data;
  } catch (error) {
    const err = error as ApiError;
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    } else if (err.response?.data?.error) {
      throw new Error(err.response.data.error);
    } else if (err.message) {
      throw new Error(err.message);
    }
    throw new Error('An unknown error occurred while resetting your password.');
  }
}

export async function checkBuyerByPhone(phone: string): Promise<{
  exists: boolean;
  buyer?: Buyer;
  token?: string;
}> {
  try {
    const response = await apiClient.post<{
      status: string;
      data: {
        exists: boolean;
        buyer?: Buyer;
        token?: string;
      }
    }>(
      `/buyers/check-phone`,
      { phone }
    );

    if (!response.data || response.data.status !== 'success') {
      throw new Error('Failed to check buyer information');
    }
    return response.data.data;
  } catch (error) {
    const err = error as ApiError;
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw new Error('Failed to check buyer information. Please try again.');
  }
}

export async function saveBuyerInfo(buyerInfo: {
  fullName: string;
  email: string;
  mobilePayment: string;
  whatsappNumber: string;
  city?: string;
  location?: string;
  password?: string;
}): Promise<{ buyer?: Buyer; token?: string; message?: string; requiresLogin?: boolean; exists?: boolean }> {
  try {
    const response = await apiClient.post<{ status: string; data: { buyer?: Buyer; token?: string; message?: string } }>(
      `/buyers/save-info`,
      {
        ...buyerInfo,
        phone: buyerInfo.mobilePayment || buyerInfo.whatsappNumber
      }
    );

    if (!response.data || response.data.status !== 'success') {
      throw new Error(response.data?.data?.message || 'Failed to save buyer information');
    }

    return response.data.data;
  } catch (error) {
    const err = error as ApiError;
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }

    throw new Error('Failed to save buyer information. Please try again.');
  }
}

export async function verifyEmail(email: string, token: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiClient.get(`/buyers/verify-email`, {
      params: { email, token }
    });
    return {
      success: true,
      message: response.data.message || 'Email verified successfully'
    };
  } catch (error) {
    const err = error as ApiError;
    throw new Error(err.response?.data?.message || 'Email verification failed');
  }
}

export async function autoLogin(autoLoginToken: string): Promise<unknown> {
  const response = await apiClient.post('/buyers/auto-login', { autoLoginToken });
  return response.data;
}


