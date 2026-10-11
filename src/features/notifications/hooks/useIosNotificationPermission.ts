import { useCallback, useEffect, useState } from 'react';
import { getDevicePlatform, isAppInstalled, isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { getActiveRole } from '@/features/auth/services/authSession';
import { registerNativePushNotifications } from '../utils/mobileNotifications';
import { isWebPushSupported, registerFirebaseServiceWorker } from '../webPush';
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
  const isInstalled = isAppInstalled();

  // Notification API availability state (can update once SW initializes)
  const [hasNotificationApi, setHasNotificationApi] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window;
  });

  // Only consider it "Safari without notification" if running in a regular Safari browser tab.
  // When running inside the installed PWA on the home screen, the user is NOT in a Safari tab,
  // so they must see the active "Enable Notifications" button, never the "Add to Home Screen" instructions.
  const isSafariWithoutNotification = isIos && !hasNotificationApi && !isInstalled;

  // Browser supports web push or needs iOS Home Screen guidance, or is running installed PWA
  const isSupported = isWebPushSupported() || isSafariWithoutNotification || isInstalled;

  const [permission, setPermission] = useState<IosPushPermissionState>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return (isSafariWithoutNotification || isInstalled) ? 'default' : 'unsupported';
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

  // Sync state on mount, when service worker activates, and on window focus/visibility changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncApiAndPermission = () => {
      const available = 'Notification' in window;
      setHasNotificationApi(available);
      if (available) {
        setPermission(Notification.permission);
      }
    };

    syncApiAndPermission();

    // Listen for SW activation which exposes Notification in some iOS WebKit contexts
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        syncApiAndPermission();
      }).catch(() => {});
    }

    window.addEventListener('focus', syncApiAndPermission);
    document.addEventListener('visibilitychange', syncApiAndPermission);

    return () => {
      window.removeEventListener('focus', syncApiAndPermission);
      document.removeEventListener('visibilitychange', syncApiAndPermission);
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setIsRequesting(true);
    try {
      // Ensure the service worker is registered for push events
      if ('serviceWorker' in navigator) {
        await registerFirebaseServiceWorker().catch(() => null);
      }

      // Check Notification API support
      if (typeof window === 'undefined' || !('Notification' in window)) {
        toast({
          title: 'Notifications Not Supported',
          description: 'Web Push requires iOS 16.4 or later. Please ensure your iPhone is up to date in Settings.',
          variant: 'destructive',
        });
        return false;
      }

      // Direct synchronous user gesture required by WebKit
      const result = await Notification.requestPermission();
      setPermission(result);
      setHasNotificationApi(true);

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
          description: 'You can enable notifications anytime in iPhone Settings > Notifications > Byblos.',
          variant: 'destructive',
        });
        return false;
      }

      return false;
    } catch (err) {
      console.warn('[useIosNotificationPermission] Failed to request permission', err);
      toast({
        title: 'Error',
        description: 'Failed to request notification permission.',
        variant: 'destructive',
      });
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
