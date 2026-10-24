import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BuyerLogin } from '../BuyerLogin';
import { BuyerRegister } from '../BuyerRegister';

vi.mock('@/features/auth/contexts', () => ({
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

describe('BuyerLogin and BuyerRegister UI Specifications', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('BuyerLogin: does NOT render Byblos Marketplace and renders white Sign In button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BuyerLogin />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Text 'Byblos Marketplace' is removed
    expect(screen.queryByText(/byblos marketplace/i)).toBeNull();

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

  it('BuyerRegister: does NOT render Buyer Community, does not render whatsapp input, and has white step indicators and white buttons', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BuyerRegister />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Text 'Buyer Community' and 'Join our buyer community' are removed
    expect(screen.queryByText(/buyer community/i)).toBeNull();
    expect(screen.queryByText(/join our buyer community/i)).toBeNull();

    // 2. WhatsApp Number input is removed
    expect(screen.queryByLabelText(/whatsapp number/i)).toBeNull();

    // 3. Step indicator is white for active step
    const step1 = screen.getByText('1');
    expect(step1.className).toContain('bg-white');
    expect(step1.className).toContain('text-black');

    // 4. Next button is white
    const nextBtn = screen.getByRole('button', { name: /next/i });
    expect(nextBtn).toBeInTheDocument();
    expect(nextBtn.className).toContain('bg-white');
    expect(nextBtn.className).toContain('text-black');

    // 5. Back button hover is white
    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.className).toContain('hover:bg-white');
  });
});
