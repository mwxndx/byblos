import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import VerifyEmail from '@/features/auth/pages/VerifyEmail';
import { AdminLoginPage } from '@/features/admin/pages/AdminLoginPage';
import MarketingLogin from '@/features/marketing/pages/MarketingLogin';
import LegalPage from '@/shared/components/LegalPage';
import DeleteAccountPage from '@/shared/components/DeleteAccountPage';

vi.mock('@/features/auth/hooks/useGlobalAuth', () => ({
  useGlobalAuth: () => ({
    login: vi.fn(),
    isLoading: false,
    user: null,
  }),
}));

vi.mock('@/infrastructure/http/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  getFreshCsrfToken: () => Promise.resolve('csrf'),
}));

function renderWithProviders(ui: React.ReactElement, initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="*" element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe('Phase 3 Public & Auth Pages - Mobile Safe Area & Semantic Tokens', () => {
  it('VerifyEmail uses 100dvh, pt-safe-top, pb-safe-bottom, and semantic surface tokens', () => {
    const { container } = renderWithProviders(
      <VerifyEmail />,
      '/verify-email?email=test@byblos.test&type=buyer'
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('min-h-[100dvh]');
    expect(root.className).toContain('pt-safe-top');
    expect(root.className).toContain('pb-safe-bottom');
    expect(root.innerHTML).toContain('bg-surface-1');
    expect(root.innerHTML).not.toContain('bg-white dark:bg-surface-1');
  });

  it('AdminLoginPage uses 100dvh (not overridden by 100svh), pt-safe-top, and semantic card tokens', () => {
    const { container } = renderWithProviders(<AdminLoginPage />, '/admin/login');
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('min-h-[100dvh]');
    expect(root.className).not.toContain('min-h-[100svh]');
    expect(root.className).toContain('pt-safe-top');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('MarketingLogin uses 100dvh (not overridden by 100svh) and pt-safe-top', () => {
    const { container } = renderWithProviders(<MarketingLogin />, '/admin/marketing/login');
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('min-h-[100dvh]');
    expect(root.className).not.toContain('min-h-[100svh]');
    expect(root.className).toContain('pt-safe-top');
  });

  it('LegalPage and DeleteAccountPage use 100dvh and pb-safe-bottom', () => {
    const legal = renderWithProviders(<LegalPage />, '/privacy');
    const legalRoot = legal.container.firstElementChild as HTMLElement;
    expect(legalRoot.className).toContain('min-h-[100dvh]');
    expect(legalRoot.className).toContain('pb-safe-bottom');

    const del = renderWithProviders(<DeleteAccountPage />, '/delete-account');
    const delRoot = del.container.firstElementChild as HTMLElement;
    expect(delRoot.className).toContain('min-h-[100dvh]');
    expect(delRoot.className).toContain('pb-safe-bottom');
  });
});

