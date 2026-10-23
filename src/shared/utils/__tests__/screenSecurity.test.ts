import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  acquireScreenSecurity,
  releaseScreenSecurity,
  isScreenSecurityActive,
  getActiveSecurityLocks,
  resetScreenSecurityForTesting,
  useScreenSecurity,
  isSensitiveRoute,
  setScreenSecurityBridgeForTesting,
} from '../screenSecurity';

describe('screenSecurity utility & reference-counting', () => {
  let mockBridge: {
    enable: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
    setSecure: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resetScreenSecurityForTesting();
    mockBridge = {
      enable: vi.fn().mockResolvedValue({ secured: true }),
      disable: vi.fn().mockResolvedValue({ secured: false }),
      setSecure: vi.fn().mockResolvedValue({ secured: true }),
    };
    setScreenSecurityBridgeForTesting(mockBridge);
  });

  it('starts with screen security inactive', () => {
    expect(isScreenSecurityActive()).toBe(false);
    expect(getActiveSecurityLocks()).toEqual([]);
  });

  it('activates screen security when a lock is acquired and deactivates when released', async () => {
    const release = acquireScreenSecurity('test-lock');
    expect(isScreenSecurityActive()).toBe(true);
    expect(getActiveSecurityLocks()).toContain('test-lock');
    expect(mockBridge.setSecure).toHaveBeenCalledWith({ secure: true });

    release();
    expect(isScreenSecurityActive()).toBe(false);
    expect(getActiveSecurityLocks()).toEqual([]);
    expect(mockBridge.setSecure).toHaveBeenCalledWith({ secure: false });
  });

  it('handles multiple concurrent locks via reference counting', () => {
    const releaseCheckout = acquireScreenSecurity('checkout');
    const releaseAdmin = acquireScreenSecurity('admin');

    expect(isScreenSecurityActive()).toBe(true);
    expect(getActiveSecurityLocks()).toEqual(['checkout', 'admin']);
    expect(mockBridge.setSecure).toHaveBeenCalledTimes(1); // called once on transition 0 -> 1

    // Release one lock, but one remains
    releaseCheckout();
    expect(isScreenSecurityActive()).toBe(true);
    expect(getActiveSecurityLocks()).toEqual(['admin']);
    expect(mockBridge.setSecure).not.toHaveBeenCalledWith({ secure: false });

    // Release remaining lock
    releaseAdmin();
    expect(isScreenSecurityActive()).toBe(false);
    expect(getActiveSecurityLocks()).toEqual([]);
    expect(mockBridge.setSecure).toHaveBeenCalledWith({ secure: false });
  });

  it('manual releaseScreenSecurity works identically', () => {
    acquireScreenSecurity('manual-lock');
    expect(isScreenSecurityActive()).toBe(true);

    releaseScreenSecurity('manual-lock');
    expect(isScreenSecurityActive()).toBe(false);
  });

  it('useScreenSecurity hook automatically acquires and releases lock with lifecycle', () => {
    const { rerender, unmount } = renderHook(
      ({ active, id }: { active: boolean; id: string }) => useScreenSecurity(active, id),
      { initialProps: { active: false, id: 'modal-preview' } }
    );

    expect(isScreenSecurityActive()).toBe(false);

    // Turn active on
    rerender({ active: true, id: 'modal-preview' });
    expect(isScreenSecurityActive()).toBe(true);
    expect(getActiveSecurityLocks()).toContain('modal-preview');

    // Turn active off
    rerender({ active: false, id: 'modal-preview' });
    expect(isScreenSecurityActive()).toBe(false);

    // Turn active on again, then unmount component
    rerender({ active: true, id: 'modal-preview' });
    expect(isScreenSecurityActive()).toBe(true);
    unmount();
    expect(isScreenSecurityActive()).toBe(false);
  });

  describe('isSensitiveRoute', () => {
    it('identifies admin and checkout routes as sensitive', () => {
      expect(isSensitiveRoute('/admin')).toBe(true);
      expect(isSensitiveRoute('/admin/login')).toBe(true);
      expect(isSensitiveRoute('/admin/dashboard')).toBe(true);
      expect(isSensitiveRoute('/admin/marketing')).toBe(true);
      expect(isSensitiveRoute('/checkout')).toBe(true);
      expect(isSensitiveRoute('/payment')).toBe(true);
      expect(isSensitiveRoute('/payment/verify')).toBe(true);
    });

    it('identifies public storefront and sharing routes as non-sensitive', () => {
      expect(isSensitiveRoute('/')).toBe(false);
      expect(isSensitiveRoute('/shop/urban-kicks')).toBe(false);
      expect(isSensitiveRoute('/urban-kicks')).toBe(false);
      expect(isSensitiveRoute('/track/abc123token')).toBe(false);
      expect(isSensitiveRoute('/buyer/dashboard')).toBe(false);
      expect(isSensitiveRoute('/buyer/orders')).toBe(false);
      expect(isSensitiveRoute('/seller/dashboard')).toBe(false);
      expect(isSensitiveRoute('/creator/dashboard')).toBe(false);
    });
  });
});
