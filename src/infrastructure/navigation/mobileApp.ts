/**
 * mobileApp.ts
 *
 * Facade module re-exporting synchronous platform detection
 * and asynchronous native bridge capabilities.
 */

import { Capacitor } from '@capacitor/core';

export * from './platformDetection';
export * from './nativeBridge';

// Synchronous platform getter for legacy callers
export const getNativePlatform = () => {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
};
