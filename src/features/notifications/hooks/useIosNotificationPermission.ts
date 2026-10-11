import { useCallback, useEffect, useState } from 'react';
import { getDevicePlatform, isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { getActiveRole } from '@/features/auth/services/authSession';
import { registerNativePushNotifications } from '../utils/mobileNotifications';
import { isWebPushConfigured, isWebPushSupported } from '../webPush';
import { toast } from '@/shared/hooks/use-toast';
import type { UserRole } from '@/shared/types';

const SNOOZE_SESSION_KEY = 'byblos_ios_push_banner_dismissed';

export type IosPushPermissionState = NotificationPermission | 'unsupported';

/**
 * Manages iOS PWA / WebKit push notification permission state.
 *
 * WebKit on iOS strictly requires `Notification.requestPermission()` to be
 * triggered synchronously by an explicit user gesture (button tap). Calling it
 * inside an unprompted lifecycle effect causes WebKit to reject or ignore it.
 *
 * This hook isolates iOS-specific eligibility, permission state, and provides
 * a gesture-compliant request action.
 */
export interface UseIosNotificationPermissionOptions {
  allowAllWeb?: boolean;
}

export function useIosNotificationPermission(defaultRole?: UserRole, options?: UseIosNotificationPermissionOptions) {
  const allowAllWeb = options?.allowAllWeb ?? false;
  const isNative = isNativeApp();
  const platform = typeof window !== 'undefined' ? getDevicePlatform() : 'desktop';
  const isIos = platform === 'ios' && !isNative;
  const isEligibleWeb = !isNative && (isIos || allowAllWeb);

  // In iOS Safari tabs, 'Notification' in window is undefined until added to Home Screen.
  // In iOS standalone PWA or standard desktop/Android browsers, Notification is in window.
  const hasNotificationApi = typeof window !== 'undefined' && 'Notification' in window;
  const isSafariWithoutNotification = isIos && !hasNotificationApi;

  // Browser supports web push or needs iOS Home Screen guidance
  const isSupported = isWebPushSupported() || isSafariWithoutNotification;

  const [permission, setPermission] = useState<IosPushPermissionState>(() => {
    if (!hasNotificationApi) return isSafariWithoutNotification ? 'default' : 'unsupported';
    return Notification.permission;
  });

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(SNOOZE_SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  // Sync state if permissions change
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;

    setIsRequesting(true);
    try {
      // Must be invoked directly in response to the user's tap
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        const activeRole = defaultRole || (await getActiveRole()) || 'buyer';
        await registerNativePushNotifications(activeRole);
        toast({
          title: 'Notifications Enabled',
          description: 'You will receive real-time order and delivery updates on this device.',
        });
        return true;
      }

      if (result === 'denied') {
        toast({
          title: 'Notifications Blocked',
          description: 'You can enable notifications anytime in browser / device settings.',
          variant: 'destructive',
        });
        return false;
      }

      return false;
    } catch (err) {
      console.warn('[useIosNotificationPermission] Failed to request permission', err);
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, [defaultRole]);

  const dismissPrompt = useCallback(() => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(SNOOZE_SESSION_KEY, 'true');
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const shouldShowPrompt = isEligibleWeb && isSupported && permission === 'default' && !isDismissed;

  return {
    isIos,
    isSafariWithoutNotification,
    isSupported,
    permission,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    isRequesting,
    shouldShowPrompt,
    requestPermission,
    dismissPrompt,
  };
}
