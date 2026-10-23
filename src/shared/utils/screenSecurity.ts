import { useEffect } from 'react';
import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';

export interface ScreenSecurityPluginInterface {
  enable(): Promise<{ secured: boolean }>;
  disable(): Promise<{ secured: boolean }>;
  setSecure(options: { secure: boolean }): Promise<{ secured: boolean }>;
}

let nativePlugin: ScreenSecurityPluginInterface | null = null;

function getNativePlugin(): ScreenSecurityPluginInterface | null {
  if (nativePlugin) return nativePlugin;
  try {
    nativePlugin = registerPlugin<ScreenSecurityPluginInterface>('ScreenSecurity');
    return nativePlugin;
  } catch {
    return null;
  }
}

/** Active screen security lock identifiers (reference-counted) */
const activeLocks = new Set<string>();

/**
 * Test override bridge to mock native calls in tests.
 */
let testBridge: ScreenSecurityPluginInterface | null = null;

export function setScreenSecurityBridgeForTesting(bridge: ScreenSecurityPluginInterface | null): void {
  testBridge = bridge;
}

export function resetScreenSecurityForTesting(): void {
  activeLocks.clear();
  testBridge = null;
}

/**
 * Returns whether screen security is currently demanded by any active lock.
 */
export function isScreenSecurityActive(): boolean {
  return activeLocks.size > 0;
}

/**
 * Returns a list of active security lock identifiers.
 */
export function getActiveSecurityLocks(): string[] {
  return Array.from(activeLocks);
}

/**
 * Dispatches the security state to the native Android window via Capacitor.
 */
async function syncNativeScreenSecurity(secure: boolean): Promise<void> {
  const bridge = testBridge || (isNativeApp() ? getNativePlugin() : null);
  if (!bridge) return;

  try {
    if (typeof bridge.setSecure === 'function') {
      await bridge.setSecure({ secure });
    } else if (secure && typeof bridge.enable === 'function') {
      await bridge.enable();
    } else if (!secure && typeof bridge.disable === 'function') {
      await bridge.disable();
    }
  } catch (error) {
    // Fail safe; don't break UI on older webviews or platforms
    if (process.env.NODE_ENV === 'development') {
      console.warn('[ScreenSecurity] Failed to sync native security state:', error);
    }
  }
}

/**
 * Acquires a screen security lock for a specific identifier.
 * Returns an unregister/release function to be called on teardown.
 */
export function acquireScreenSecurity(lockId: string): () => void {
  const wasActive = activeLocks.size > 0;
  activeLocks.add(lockId);

  if (!wasActive) {
    syncNativeScreenSecurity(true);
  }

  return () => {
    releaseScreenSecurity(lockId);
  };
}

/**
 * Releases a screen security lock for a specific identifier.
 */
export function releaseScreenSecurity(lockId: string): void {
  const existed = activeLocks.delete(lockId);
  if (existed && activeLocks.size === 0) {
    syncNativeScreenSecurity(false);
  }
}

/**
 * React hook to acquire a screen security lock while `active` is true.
 * Automatically releases the lock when the component unmounts or `active` becomes false.
 */
export function useScreenSecurity(active: boolean, lockId: string): void {
  useEffect(() => {
    if (!active) return;
    const release = acquireScreenSecurity(lockId);
    return () => {
      release();
    };
  }, [active, lockId]);
}

/**
 * Determines whether a URL pathname is considered a sensitive view
 * (e.g., admin operations, payment & checkout flows).
 */
export function isSensitiveRoute(pathname: string): boolean {
  if (!pathname) return false;
  const normalized = pathname.toLowerCase();

  // Admin routes
  if (
    normalized === '/admin' ||
    normalized.startsWith('/admin/') ||
    normalized === '/logistics' ||
    normalized.startsWith('/logistics/') ||
    normalized === '/mzigo' ||
    normalized.startsWith('/mzigo/')
  ) {
    return true;
  }

  // Checkout and payment routes
  if (
    normalized === '/checkout' ||
    normalized.startsWith('/checkout/') ||
    normalized === '/payment' ||
    normalized.startsWith('/payment/')
  ) {
    return true;
  }

  return false;
}
