import { useForegroundWebPush } from '../hooks/useForegroundWebPush';

/**
 * Invisible component mounted at the provider root that activates
 * foreground FCM push notifications for iOS PWA and web sessions.
 */
export function ForegroundNotificationListener() {
  useForegroundWebPush();
  return null;
}
