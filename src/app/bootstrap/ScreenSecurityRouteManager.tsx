import { useLocation } from 'react-router-dom';
import { useScreenSecurity, isSensitiveRoute } from '@/shared/utils/screenSecurity';

/**
 * Automatically synchronizes Android native FLAG_SECURE window state with the active route.
 * Admin panels, logistics dispatch, and checkout/payment routes are dynamically protected,
 * while allowing screenshots across public storefronts, order tracking, and member cards.
 */
export function ScreenSecurityRouteManager(): null {
  const location = useLocation();
  const isSecure = isSensitiveRoute(location.pathname);

  useScreenSecurity(isSecure, `route:${location.pathname}`);

  return null;
}
