import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SellerLogin } from '../SellerLogin';
import SellerRegistration from '../SellerRegistration';
import { VerifyEmailModalView } from '@/features/auth/components/VerifyEmailModalView';

vi.mock('@/features/auth/contexts', () => ({
  useGlobalAuth: () => ({
    login: vi.fn(),
    forgotPassword: vi.fn(),
    user: null,
  }),
}));

vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('SellerLogin and SellerRegistration UI Specifications', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('SellerLogin: does NOT render Seller program and renders white Sign In button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SellerLogin />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Text 'Seller program' is removed
    expect(screen.queryByText(/seller program/i)).toBeNull();

    // 2. Sign In button is white
    const signInBtn = screen.getByRole('button', { name: /sign in/i });
    expect(signInBtn).toBeInTheDocument();
    expect(signInBtn.className).toContain('bg-white');
    expect(signInBtn.className).toContain('text-black');

    // 3. Back button has white hover
    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.className).toContain('hover:bg-white');
  });

  it('SellerRegistration: does NOT render Seller Community, does not render whatsapp input, and has white step indicators and white buttons', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SellerRegistration />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Text 'Seller Community' and 'Join our seller community' are removed
    expect(screen.queryByText(/seller community/i)).toBeNull();
    expect(screen.queryByText(/join our seller community/i)).toBeNull();

    // 2. WhatsApp Number input is removed
    expect(screen.queryByLabelText(/whatsapp number/i)).toBeNull();

    // 3. Step indicator is white for active step
    const step1 = screen.getByText('1');
    expect(step1.className).toContain('bg-white');
    expect(step1.className).toContain('text-black');
    expect(step1.className).toContain('auth-step-active');

    // 4. Next button is white
    const nextBtn = screen.getByRole('button', { name: /next/i });
    expect(nextBtn).toBeInTheDocument();
    expect(nextBtn.className).toContain('bg-white');
    expect(nextBtn.className).toContain('text-black');
    expect(nextBtn.className).toContain('btn-white');

    // 5. Back button hover is white
    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.className).toContain('hover:bg-white');

    // 6. Header has Seller Portal with icon
    expect(screen.getByRole('heading', { level: 1, name: /seller portal/i })).toBeInTheDocument();
  });

  it('VerifyEmailModalView: uses white button and does NOT render yellow colors', () => {
    render(
      <VerifyEmailModalView
        isOpen={true}
        onClose={vi.fn()}
        email="test@byblos.test"
        role="seller"
        isResending={false}
        resendCooldown={0}
        isSuccess={false}
        onResend={vi.fn()}
      />
    );

    const resendBtn = screen.getByRole('button', { name: /resend verification email/i });
    expect(resendBtn).toBeInTheDocument();
    expect(resendBtn.className).toContain('bg-white');
    expect(resendBtn.className).toContain('text-black');
    expect(resendBtn.className).not.toContain('bg-yellow');
  });
});
