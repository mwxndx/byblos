import { Dispatch, SetStateAction, useCallback, useMemo } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '@/infrastructure/http/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import {
  clearRoleSession,
  clearRoleSessionMarkers,
  enforceSingleActiveRole,
  markRoleSessionActive,
  setActiveRole,
} from '../services/authSession';
import { registerNativePushNotifications, unregisterNativePushNotifications } from '@/features/notifications/utils/mobileNotifications';
import { getDashboardPath } from '../utils/authRouting';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { storage } from '@/infrastructure/storage/storage';
import type {
  GlobalUser,
  UserProfile,
  UserRole,
} from '../types/authTypes';
import {
  useBuyerLoginMutation,
  useSellerLoginMutation,
  useAdminLoginMutation,
  useCreatorLoginMutation,
  useLogisticsLoginMutation,
  useMarketingLoginMutation,
} from './useAuthMutations';
import { useAuthRegistration } from './useAuthRegistration';
import { useAuthPasswordReset } from './useAuthPasswordReset';
import { useAuthProfile } from './useAuthProfile';
import {
  executeRoleLogin,
  getLogoutEndpointForRole,
  getProfileQueryOptionsForRole,
} from './authRoleDispatcher';
import { useAccountSwitching } from './useAccountSwitching';

interface UseAuthActionsOptions {
  navigate: NavigateFunction;
  user: GlobalUser | null;
  setUser: Dispatch<SetStateAction<GlobalUser | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  markAuthChecked: () => void;
}

export function useAuthActions({
  navigate,
  user,
  setUser,
  setIsLoading,
  markAuthChecked,
}: UseAuthActionsOptions) {
  const queryClient = useQueryClient();

  const buyerLoginMut = useBuyerLoginMutation();
  const sellerLoginMut = useSellerLoginMutation();
  const adminLoginMut = useAdminLoginMutation();
  const creatorLoginMut = useCreatorLoginMutation();
  const logisticsLoginMut = useLogisticsLoginMutation();
  const marketingLoginMut = useMarketingLoginMutation();

  const mutations = useMemo(() => ({
    buyer: buyerLoginMut.mutateAsync,
    seller: sellerLoginMut.mutateAsync,
    admin: adminLoginMut.mutateAsync,
    creator: creatorLoginMut.mutateAsync,
    logistics: logisticsLoginMut.mutateAsync,
    marketing: marketingLoginMut.mutateAsync,
  }), [
    buyerLoginMut.mutateAsync,
    sellerLoginMut.mutateAsync,
    adminLoginMut.mutateAsync,
    creatorLoginMut.mutateAsync,
    logisticsLoginMut.mutateAsync,
    marketingLoginMut.mutateAsync,
  ]);

  const { register } = useAuthRegistration({ navigate, setUser, setIsLoading, markAuthChecked });
  const { forgotPassword, resetPassword } = useAuthPasswordReset({ navigate, setIsLoading });
  const { getProfile, updateProfile } = useAuthProfile({ setUser });
  const { switchAccount, refreshRole } = useAccountSwitching({
    navigate,
    setUser,
    setIsLoading,
    markAuthChecked,
    queryClient,
  });

  const login = useCallback(async (email: string, password: string, role: UserRole, acceptTerms?: boolean) => {
    setIsLoading(true);
    try {
      const { response, profile } = await executeRoleLogin(mutations, role, { email, password, acceptTerms });

      queryClient.clear();
      await enforceSingleActiveRole(role);

      setUser({
        role,
        profile,
        isAuthenticated: true,
      });

      if (response.token) {
        await storage.set(`${role}Token`, response.token);
        const refreshToken = (response as { refreshToken?: string }).refreshToken;
        if (refreshToken) await storage.set(`${role}RefreshToken`, refreshToken);
      }
      await markRoleSessionActive(role);
      markAuthChecked();
      void registerNativePushNotifications(role);

      toast.success('Login successful', {
        id: `${role}-login-success`,
        description: 'Welcome back to Byblos.',
        duration: 2000,
      });

      handlePostLoginRedirect(navigate, role);
    } catch (error) {
      await handleLoginFailure(role);
      if (
        classified.code !== 'PENDING_VERIFICATION' &&
        classified.code !== 'EMAIL_NOT_VERIFIED' &&
        classified.code !== 'TERMS_NOT_ACCEPTED' &&
        classified.code !== 'WRONG_PORTAL'
      ) {
        toast.error('Login Failed', { id: `${role}-login-failed`, description: classified.message });
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, navigate, setIsLoading, setUser, mutations, queryClient]);

  const loginWithToken = useCallback(async (token: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const queryOpts = getProfileQueryOptionsForRole(role);
      const profileData = await queryClient.fetchQuery(queryOpts);

      setUser({
        role,
        profile: profileData as UserProfile,
        isAuthenticated: true,
      });

      await markRoleSessionActive(role);
      await setActiveRole(role);
      markAuthChecked();
      void registerNativePushNotifications(role);
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, setIsLoading, setUser, queryClient]);

  const loginAdmin = useCallback(async (email: string, password: string) => {
    return login(email, password, 'admin');
  }, [login]);

  const logout = useCallback(async () => {
    const role = user?.role;
    setUser(null);
    navigate('/', { replace: true });
    toast('Logged out', { description: 'You have been successfully logged out.' });

    try { await clearRoleSessionMarkers(); } catch { /* ignore */ }
    queryClient.clear();

    if (!role) return;

    try {
      await unregisterNativePushNotifications(role);
      const logoutUrl = getLogoutEndpointForRole(role);
      await apiClient.post(logoutUrl);
    } catch {
      // Fail silently — already logged out locally.
    }
  }, [navigate, setUser, user, queryClient]);

  return {
    login,
    loginWithToken,
    loginAdmin,
    register,
    logout,
    switchAccount,
    refreshRole,
    forgotPassword,
    resetPassword,
    getProfile,
    updateProfile,
  };
}

function handlePostLoginRedirect(navigate: NavigateFunction, role: UserRole) {
  const redirectPath = sessionStorage.getItem('redirectAfterLogin');
  if (redirectPath && typeof redirectPath === 'string') {
    sessionStorage.removeItem('redirectAfterLogin');
    navigate(redirectPath, { replace: true });
    return;
  }
  const dashboardPath = getDashboardPath(role);
  if (typeof dashboardPath === 'string') {
    navigate(dashboardPath, { replace: true });
  } else {
    console.error('[Auth] Invalid dashboard path:', dashboardPath);
    navigate('/', { replace: true });
  }
}

async function handleLoginFailure(role: UserRole) {
  try {
    await clearRoleSession(role);
    if (isNativeApp()) {
      await storage.remove(`${role}Token`);
      await storage.remove(`${role}RefreshToken`);
    }
  } catch {
    // Ignore storage cleanup errors on failed login
  }
}
