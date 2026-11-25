import React, { useEffect } from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthCoreProvider } from '../contexts/AuthCoreContext';
import { AppProtectedRoute } from '@/app/router/AppProtectedRoute';
import { storage, BYBLOS_AUTH_KEYS } from '@/infrastructure/storage/storage';
import apiClient from '@/infrastructure/http/apiClient';

describe('Android native cold-start session restoration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNative: true,
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    };
  });

  afterEach(() => {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  test('does not flash the landing page (/) while restoring an active native session on cold launch', async () => {
    let landingRendered = false;

    const LandingSpy = () => {
      useEffect(() => {
        landingRendered = true;
      }, []);
      return <div>Landing Page</div>;
    };

    const store: Record<string, string> = {
      [BYBLOS_AUTH_KEYS.ACTIVE_ROLE]: 'seller',
      sellerSessionActive: 'true',
      sellerToken: 'jwt-seller-token',
      byblos_last_native_path: '/seller/dashboard',
    };

    vi.spyOn(storage, 'get').mockImplementation(async (key: string) => {
      await new Promise((r) => setTimeout(r, 20));
      return store[key] ?? null;
    });
    vi.spyOn(storage, 'set').mockImplementation(async (key: string, value: string) => {
      store[key] = value;
    });

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/sellers/profile')) {
        return {
          data: {
            status: 'success',
            data: { id: 2, email: 'seller@test.com', shopName: 'Byblos Shop', is_verified: true },
          },
        };
      }
      if (url.includes('/auth/my-accounts')) {
        return { data: { status: 'success', data: { accounts: { seller: true } } } };
      }
      return { data: {} };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <AuthCoreProvider>
            <Routes>
              <Route path="/" element={<LandingSpy />} />
              <Route
                path="/seller/dashboard"
                element={
                  <AppProtectedRoute allowedRoles={['seller']}>
                    <div>Seller Dashboard Restored</div>
                  </AppProtectedRoute>
                }
              />
            </Routes>
          </AuthCoreProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Seller Dashboard Restored')).toBeTruthy();
    }, { timeout: 4000 });

    expect(landingRendered).toBe(false);
  });

  test('ungates and renders the landing page on native cold launch when no session exists', async () => {
    vi.spyOn(storage, 'get').mockResolvedValue(null);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <AuthCoreProvider>
            <Routes>
              <Route path="/" element={<div>Landing Page</div>} />
            </Routes>
          </AuthCoreProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Landing Page')).toBeTruthy();
    }, { timeout: 4000 });
  });
});

