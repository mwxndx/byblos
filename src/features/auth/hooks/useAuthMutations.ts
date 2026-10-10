import { useMutation, useQueryClient } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import { sellerApi } from '@/features/seller/api';
import creatorApi from '@/features/creator/api';
import type { UserRole, BuyerRegistrationData, SellerRegistrationData } from '@/features/auth/types/authTypes';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';
import { sellerQueryKeys } from '@/features/seller/api/queryKeys';
import { adminQueryKeys } from '@/features/admin/api/queryKeys';
import { creatorQueryKeys } from '@/features/creator/api/queryKeys';

import apiClient from '@/infrastructure/http/apiClient';

export function useBuyerLoginMutation() {
  return useMutation({
    mutationFn: (credentials: { email: string; password: string; acceptTerms?: boolean }) =>
      buyerApi.login(credentials),
  });
}

export function useSellerLoginMutation() {
  return useMutation({
    mutationFn: (credentials: { email: string; password: string; acceptTerms?: boolean }) =>
      sellerApi.login(credentials),
  });
}

export function useAdminLoginMutation() {
  return useMutation({
    mutationFn: async (credentials: { email?: string; password?: string; pin?: string }) => {
      const payload = credentials.email && credentials.password
        ? { email: credentials.email, password: credentials.password }
        : { pin: credentials.pin };
      const response = await apiClient.post('/admin/login', payload);
      return response.data;
    },
  });
}

export function useCreatorLoginMutation() {
  return useMutation({
    mutationFn: (credentials: { email: string; password: string; acceptTerms?: boolean }) =>
      creatorApi.login(credentials),
  });
}

export function useLogisticsLoginMutation() {
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiClient.post('/logistics/login', credentials);
      return res.data?.data || res.data;
    },
  });
}

export function useMarketingLoginMutation() {
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiClient.post('/admin/marketing/login', credentials);
      return res.data?.data || res.data;
    },
  });
}

export function useRegisterMutation(role: UserRole) {
  return useMutation({
    mutationFn: (data: unknown) => {
      if (role === 'buyer') {
        return buyerApi.register(data as BuyerRegistrationData);
      } else if (role === 'seller') {
        return sellerApi.register(data as SellerRegistrationData);
      }
      throw new Error(`Register method not implemented for role: ${role}`);
    },
  });
}

export function useForgotPasswordMutation(role: UserRole) {
  return useMutation({
    mutationFn: (email: string) => {
      if (role === 'buyer') {
        return buyerApi.forgotPassword(email);
      } else if (role === 'seller') {
        return sellerApi.forgotPassword(email);
      } else if (role === 'creator') {
        return creatorApi.forgotPassword(email);
      }
      throw new Error(`ForgotPassword method not implemented for role: ${role}`);
    },
  });
}

export function useResetPasswordMutation(role: UserRole) {
  return useMutation({
    mutationFn: (args: { token: string; newPassword?: string; password?: string; email: string }) => {
      if (role === 'buyer') {
        return buyerApi.resetPassword(args.token, args.newPassword || args.password || '', args.email);
      } else if (role === 'seller') {
        return sellerApi.resetPassword(args.token, args.password || args.newPassword || '', args.email);
      } else if (role === 'creator') {
        return creatorApi.resetPassword(args.token, args.newPassword || args.password || '', args.email);
      }
      throw new Error(`ResetPassword method not implemented for role: ${role}`);
    },
  });
}

export function useUpdateProfileMutation(role: UserRole) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Record<string, unknown>) => {
      if (role === 'buyer') {
        return buyerApi.updateProfile(updates);
      } else if (role === 'seller') {
        return sellerApi.updateProfile(updates);
      } else if (role === 'creator') {
        return creatorApi.updateProfile(updates);
      }
      throw new Error(`UpdateProfile method not implemented for role: ${role}`);
    },
    onSuccess: () => {
      if (role === 'buyer') {
        queryClient.invalidateQueries({ queryKey: buyerQueryKeys.profile() });
      } else if (role === 'seller') {
        queryClient.invalidateQueries({ queryKey: sellerQueryKeys.profile() });
        queryClient.invalidateQueries({ queryKey: sellerQueryKeys.dashboard() });
        queryClient.invalidateQueries({ queryKey: sellerQueryKeys.summary() });
      } else if (role === 'creator') {
        queryClient.invalidateQueries({ queryKey: creatorQueryKeys.profile() });
      } else if (role === 'admin') {
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.profile() });
      }
    },
  });
}


