/**
 * platformDetection.ts
 *
 * Synchronous platform and device capability detection.
 * Safe to import from ordinary UI components.
 * Pure DOM / user-agent checks — DOES NOT initialize native bridge or plugins.
 */

export const isNativeApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' ||
    Boolean((window as unknown as { Capacitor?: { isNative?: boolean; isNativePlatform?: () => boolean } }).Capacitor?.isNative) ||
    Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())
  );
};

export const getDevicePlatform = (): 'android' | 'ios' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const hasMSStream = Boolean((window as unknown as { MSStream?: unknown }).MSStream);
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) && !hasMSStream) return 'ios';
  // iPadOS 13+ Safari requests the desktop site by default and sends a
  // "Macintosh" user-agent, so the check above misses real iPads.
  if (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
    return 'ios';
  }
  return 'desktop';
};

// Whether the app is running as an installed PWA (home-screen / standalone),
// rather than a normal browser tab. Used to decide whether to show the install
// banner at all, and (on iOS) whether web push can work.
export const isAppInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const displayModeStandalone = typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches;
  return iosStandalone || displayModeStandalone;
};

export const APP_DOWNLOAD_URL = 'https://play.google.com/store/apps/details?id=space.bybloshq.app';

export const getStableDeviceId = (): string => {
  const storageKey = 'byblosNativeDeviceId';
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;

    const generated = globalThis.crypto?.randomUUID?.()
      || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

// Android Intent link to launch the installed app directly or fallback to Play Store
export const getAndroidDeepLink = (orderNumber?: string | null): string => {
  const path = orderNumber ? `buyer/orders?order=${encodeURIComponent(orderNumber)}` : 'buyer/orders';
  return `intent://byblos.app/${path}#Intent;scheme=byblos;package=space.bybloshq.app;S.browser_fallback_url=${encodeURIComponent(APP_DOWNLOAD_URL)};end;`;
};

