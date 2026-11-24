import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthCoreProvider } from '../contexts/AuthCoreContext';
import { AppProtectedRoute } from '@/app/router/AppProtectedRoute';
import { BuyerLogin } from '@/features/buyer/pages/BuyerLogin';
import { SellerLogin } from '@/features/seller/pages/SellerLogin';
import CreatorLogin from '@/features/creator/pages/CreatorLogin';
import apiClient from '@/infrastructure/http/apiClient';

vi.mock('@/features/notifications/utils/mobileNotifications', () => ({
  registerNativePushNotifications: vi.fn().mockResolvedValue(undefined),
  unregisterNativePushNotifications: vi.fn().mockResolvedValue(undefined),
}));

describe('Android native login flow', () => {
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

  const setupApiMocks = () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/csrf-token')) return { data: { csrfToken: 'test-csrf' } };
      if (url.includes('/buyers/profile')) {
        return { data: { status: 'success', data: { id: 1, email: 'buyer@test.com', name: 'Buyer', is_verified: true } } };
      }
      if (url.includes('/sellers/profile')) {
        return { data: { status: 'success', data: { id: 2, email: 'seller@test.com', shopName: 'Shop', is_verified: true } } };
      }
      if (url.includes('/creators/profile')) {
        return { data: { status: 'success', data: { id: 3, email: 'creator@test.com', name: 'Creator', is_verified: true } } };
      }
      if (url.includes('/auth/my-accounts')) {
        return { data: { status: 'success', data: { accounts: { buyer: true, seller: true, creator: true } } } };
      }
      return { data: {} };
    });

    vi.spyOn(apiClient, 'post').mockImplementation(async (url: string) => {
      if (url.includes('/buyers/login')) {
        return {
          data: {
            status: 'success',
            data: {
              buyer: { id: 1, email: 'buyer@test.com', name: 'Buyer', is_verified: true },
              token: 'jwt-buyer-token',
              refreshToken: 'jwt-buyer-refresh',
            },
          },
        };
      }
      if (url.includes('/sellers/login')) {
        return {
          data: {
            status: 'success',
            data: {
              seller: { id: 2, email: 'seller@test.com', shopName: 'Shop', is_verified: true },
              token: 'jwt-seller-token',
              refreshToken: 'jwt-seller-refresh',
            },
          },
        };
      }
      if (url.includes('/creators/login')) {
        return {
          data: {
            status: 'success',
            data: {
              creator: { id: 3, email: 'creator@test.com', name: 'Creator', is_verified: true },
              token: 'jwt-creator-token',
              refreshToken: 'jwt-creator-refresh',
            },
          },
        };
      }
      return { data: { status: 'success' } };
    });
  };

  test.each([
    {
      role: 'buyer' as const,
      loginPath: '/buyer/login',
      dashboardPath: '/buyer/dashboard',
      dashboardText: 'Buyer Dashboard Loaded',
      email: 'buyer@test.com',
      Component: BuyerLogin,
    },
    {
      role: 'seller' as const,
      loginPath: '/seller/login',
      dashboardPath: '/seller/dashboard',
      dashboardText: 'Seller Dashboard Loaded',
      email: 'seller@test.com',
      Component: SellerLogin,
    },
    {
      role: 'creator' as const,
      loginPath: '/creator/login',
      dashboardPath: '/creator/dashboard',
      dashboardText: 'Creator Dashboard Loaded',
      email: 'creator@test.com',
      Component: CreatorLogin,
    },
  ])('$role login on native Android completes and renders dashboard without hanging', async ({
    role,
    loginPath,
    dashboardPath,
    dashboardText,
    email,
    Component,
  }) => {
    setupApiMocks();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[loginPath]}>
          <AuthCoreProvider>
            <Routes>
              <Route path={loginPath} element={<Component />} />
              <Route
                path={dashboardPath}
                element={
                  <AppProtectedRoute allowedRoles={[role]}>
                    <div>{dashboardText}</div>
                  </AppProtectedRoute>
                }
              />
            </Routes>
          </AuthCoreProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const emailInput = await screen.findByPlaceholderText(/email|@|you@/i);
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: email } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });

    const submitBtn = screen.getByRole('button', { name: /sign in|log in|login/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(dashboardText)).toBeTruthy();
    }, { timeout: 4000 });
  });
});
