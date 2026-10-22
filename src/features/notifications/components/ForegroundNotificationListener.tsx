import { useGlobalAuth } from '@/features/auth/contexts';
import { useForegroundWebPush } from '../hooks/useForegroundWebPush';

/**
 * Invisible component mounted at the provider root that activates
 * foreground FCM push notifications for iOS PWA and web sessions.
 * Only activates when a user is actively authenticated.
 */
export function ForegroundNotificationListener() {
  let isAuth = false;
  let hasUser = false;

  try {
    const auth = useGlobalAuth();
    isAuth = Boolean(auth.isAuthenticated);
    hasUser = Boolean(auth.user);
  } catch {
    // Graceful fallback when rendered in isolated environments without GlobalAuthProvider
    return null;
  }

  if (!isAuth || !hasUser) {
    return null;
  }

  return <ForegroundWebPushRunner />;
}

function ForegroundWebPushRunner() {
  useForegroundWebPush();
  return null;
}
