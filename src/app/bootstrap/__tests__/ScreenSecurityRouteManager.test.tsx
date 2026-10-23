import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScreenSecurityRouteManager } from '../ScreenSecurityRouteManager';
import {
  isScreenSecurityActive,
  getActiveSecurityLocks,
  resetScreenSecurityForTesting,
  setScreenSecurityBridgeForTesting,
} from '@/shared/utils/screenSecurity';

describe('ScreenSecurityRouteManager', () => {
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

  it('does not engage security on public storefront routes', () => {
    render(
      <MemoryRouter initialEntries={['/shop/test-store']}>
        <ScreenSecurityRouteManager />
      </MemoryRouter>
    );

    expect(isScreenSecurityActive()).toBe(false);
    expect(getActiveSecurityLocks()).toEqual([]);
  });

  it('engages security on admin routes', () => {
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <ScreenSecurityRouteManager />
      </MemoryRouter>
    );

    expect(isScreenSecurityActive()).toBe(true);
    expect(getActiveSecurityLocks()).toContain('route:/admin/dashboard');
    expect(mockBridge.setSecure).toHaveBeenCalledWith({ secure: true });
  });

  it('engages security on logistics and mzigo routes', () => {
    render(
      <MemoryRouter initialEntries={['/logistics/dashboard']}>
        <ScreenSecurityRouteManager />
      </MemoryRouter>
    );

    expect(isScreenSecurityActive()).toBe(true);
    expect(getActiveSecurityLocks()).toContain('route:/logistics/dashboard');
  });

  it('engages security on checkout and payment routes', () => {
    render(
      <MemoryRouter initialEntries={['/payment']}>
        <ScreenSecurityRouteManager />
      </MemoryRouter>
    );

    expect(isScreenSecurityActive()).toBe(true);
    expect(getActiveSecurityLocks()).toContain('route:/payment');
  });
});
