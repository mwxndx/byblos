/**
 * nativeBridge.ts
 *
 * Asynchronous native bridge setup and plugin access.
 * Loaded only by code paths that require native device capabilities.
 * Handles initialization failures safely and prevents duplicate setup.
 */

let bridgeInitialized = false;

export async function initializeNativeBridge(): Promise<boolean> {
  if (bridgeInitialized) return true;
  if (typeof window === 'undefined') return false;

  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    bridgeInitialized = true;
    return true;
  } catch (error) {
    console.warn('[NativeBridge] Failed to initialize native bridge:', error);
    return false;
  }
}

export async function getNativePlatformAsync(): Promise<string> {
  if (typeof window === 'undefined') return 'web';
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

