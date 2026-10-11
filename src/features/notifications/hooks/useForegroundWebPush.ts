import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { appNavigate } from '@/infrastructure/navigation/navigationService';
import { toast } from '@/shared/hooks/use-toast';
import { subscribeForegroundMessages } from '../webPush';

/**
 * Listens for FCM push notifications arriving while the web app or iOS PWA
 * is in the active foreground.
 *
 * When a foreground message is received:
 * 1. Pops an interactive toast alert banner with the notification title, body, and an optional navigation action.
 * 2. Invalidates React Query 'notifications' caches so the bell badge and in-app feed refresh immediately.
 */
export function useForegroundWebPush() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Native apps use Capacitor's pushNotificationReceived listener
    if (isNativeApp()) return;

    const unsubscribe = subscribeForegroundMessages((payload) => {
      const title = payload.notification?.title
        || (typeof payload.data?.title === 'string' ? payload.data.title : undefined)
        || 'Byblos';
      const body = payload.notification?.body
        || (typeof payload.data?.body === 'string' ? payload.data.body : undefined)
        || '';
      const rawTarget = payload.data?.path || payload.data?.url;
      const targetPath = typeof rawTarget === 'string' && rawTarget.startsWith('/') ? rawTarget : null;

      toast({
        title,
        description: body,
        duration: 7000,
        action: targetPath ? {
          label: 'View',
          onClick: () => {
            if (!appNavigate(targetPath)) {
              window.location.assign(targetPath);
            }
          },
        } : undefined,
      });

      // Refetch notifications immediately so bell badges and feeds update
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [queryClient]);
}
