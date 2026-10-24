import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreatorLogin from '../CreatorLogin';
import CreatorRegister from '../CreatorRegister';
import CreatorForgotPassword from '../CreatorForgotPassword';
import CreatorResetPassword from '../CreatorResetPassword';

vi.mock('@/features/auth/contexts', () => ({
  useGlobalAuth: () => ({
    login: vi.fn(),
    user: null,
  }),
}));

vi.mock('@/features/auth/hooks/useGlobalAuth', () => ({
  useGlobalAuth: () => ({
    login: vi.fn(),
    user: null,
  }),
}));

vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('Creator Authentication Pages UI Specifications', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('CreatorLogin: does NOT render Creator program, renders Sparkles icon and white Sign In button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreatorLogin />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Text 'Creator program' is removed
    expect(screen.queryByText(/creator program/i)).toBeNull();

    // 2. Header has Creator Portal
    expect(screen.getByRole('heading', { level: 1, name: /creator portal/i })).toBeInTheDocument();

    // 3. Back button has white hover
    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.className).toContain('hover:bg-white');

    // 4. Sign In button is white
    const signInBtn = screen.getByRole('button', { name: /sign in/i });
    expect(signInBtn).toBeInTheDocument();
    expect(signInBtn.className).toContain('btn-white');
    expect(signInBtn.className).toContain('bg-white');
    expect(signInBtn.className).toContain('text-black');
  });

  it('CreatorRegister: does NOT render eyebrow text, renders Sparkles icon and white Create Account button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreatorRegister />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Eyebrow text 'Byblos creators' is removed
    expect(screen.queryByText(/^byblos creators$/i)).toBeNull();

    // 2. Header has Creator Portal
    expect(screen.getByRole('heading', { level: 1, name: /creator portal/i })).toBeInTheDocument();

    // 3. Back button has white hover
    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.className).toContain('hover:bg-white');

    // 4. Submit button is white
    const createBtn = screen.getByRole('button', { name: /create creator account/i });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn.className).toContain('btn-white');
    expect(createBtn.className).toContain('bg-white');
    expect(createBtn.className).toContain('text-black');
  });

  it('CreatorForgotPassword: renders white Send Reset Link button and Sparkles icon', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreatorForgotPassword />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Eyebrow text 'Creator program' is removed
    expect(screen.queryByText(/creator program/i)).toBeNull();

    // 2. Header has Creator Portal
    expect(screen.getByRole('heading', { level: 1, name: /creator portal/i })).toBeInTheDocument();

    // 3. Send reset link button is white
    const submitBtn = screen.getByRole('button', { name: /send reset link/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn.className).toContain('btn-white');
    expect(submitBtn.className).toContain('bg-white');
    expect(submitBtn.className).toContain('text-black');
  });

  it('CreatorResetPassword: renders white Update Password button and Sparkles icon', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreatorResetPassword />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Header has Creator Portal
    expect(screen.getByRole('heading', { level: 1, name: /creator portal/i })).toBeInTheDocument();

    // 2. Update password button is white
    const submitBtn = screen.getByRole('button', { name: /update password/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn.className).toContain('btn-white');
    expect(submitBtn.className).toContain('bg-white');
    expect(submitBtn.className).toContain('text-black');
  });
});
