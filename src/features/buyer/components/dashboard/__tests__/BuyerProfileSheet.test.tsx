import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerProfileSheet } from '../BuyerProfileSheet';

vi.mock('@/features/auth/hooks/useGlobalAuth', () => ({
  useGlobalAuth: () => ({
    user: null,
    logout: vi.fn(),
    switchAccount: vi.fn(),
    accounts: [],
    isAuthenticated: false,
  }),
}));

describe('BuyerProfileSheet', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders DashboardProfilePanel with bottomInset="0px" and buyer-surface styling matching seller profile UX', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BuyerProfileSheet
            open={true}
            onOpenChange={vi.fn()}
            isEditingProfile={false}
            isSavingProfile={false}
            mobilePayment=""
            area=""
            user={null}
            onLogout={vi.fn()}
            onMobilePaymentChange={vi.fn()}
            onAreaChange={vi.fn()}
            onSaveProfile={vi.fn()}
            onToggleEdit={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const panelHost = screen.getByTestId('dashboard-profile-panel');
    expect(panelHost).toBeInTheDocument();
    // Ensures full-height coverage down to bottom (0px), eliminating the bottom gap / cutoff
    expect(panelHost).toHaveStyle({ bottom: '0px' });

    const aside = screen.getByRole('complementary', { name: 'Profile' });
    expect(aside).toHaveClass('buyer-surface');
  });
});
