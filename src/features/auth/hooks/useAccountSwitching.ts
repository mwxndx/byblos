import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { storage } from '@/infrastructure/storage/storage';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { registerNativePushNotifications } from '@/features/notifications/utils/mobileNotifications';
import { switchAccountRequest, type SwitchableRole } from '@/features/auth/api/account';
import { enforceSingleActiveRole, markRoleSessionActive, setActiveRole } from '../services/authSession';
import { getDashboardPath } from '../utils/authRouting';
import type { GlobalUser, UserProfile, UserRole } from '../types/authTypes';
import { getProfileQueryOptionsForRole } from './authRoleDispatcher';

interface UseAccountSwitchingProps {
  navigate: NavigateFunction;
  setUser: Dispatch<SetStateAction<GlobalUser | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  markAuthChecked: () => void;
  queryClient: QueryClient;
}

export function useAccountSwitching({
  navigate,
  setUser,
  setIsLoading,
  markAuthChecked,
  queryClient,
}: UseAccountSwitchingProps) {
  const switchAccount = useCallback(async (role: SwitchableRole) => {
    setIsLoading(true);
    try {
      const { token, refreshToken } = await switchAccountRequest(role);

      queryClient.clear();
      await enforceSingleActiveRole(role);
      if (isNativeApp() && token) {
        await storage.set(`${role}Token`, token);
        if (refreshToken) await storage.set(`${role}RefreshToken`, refreshToken);
      }

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

      const dashboardPath = getDashboardPath(role);
      navigate(typeof dashboardPath === 'string' ? dashboardPath : '/', { replace: true });

      toast.success('Account switched', {
        description: `You are now using your ${role} account.`,
        duration: 2000,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Could not switch account';
      toast.error('Switch failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, navigate, setIsLoading, setUser, queryClient]);

  const refreshRole = useCallback(async (newRole: UserRole) => {
    setIsLoading(true);
    try {
      const queryOpts = getProfileQueryOptionsForRole(newRole);
      const profileData = await queryClient.fetchQuery(queryOpts);

      if (!profileData) throw new Error('Failed to fetch profile');

      setUser({
        role: newRole,
        profile: profileData as UserProfile,
        isAuthenticated: true,
      });

      await markRoleSessionActive(newRole);
      await setActiveRole(newRole);
      markAuthChecked();
      void registerNativePushNotifications(newRole);

      toast.success('Role Switched', {
        description: `Switched to ${newRole} dashboard`,
        duration: 2000,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || 'Failed to switch role';
      toast.error('Role Switch Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, setIsLoading, setUser, queryClient]);

  return { switchAccount, refreshRole };
}
