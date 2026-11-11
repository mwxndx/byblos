import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatorProfileSheet } from '../CreatorProfileSheet';

vi.mock('@/features/auth/hooks/useGlobalAuth', () => ({
  useGlobalAuth: () => ({
    user: null,
    logout: vi.fn(),
    switchAccount: vi.fn(),
    accounts: [],
    isAuthenticated: false,
  }),
}));

describe('CreatorProfileSheet', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockCreator = {
    id: 1,
    fullName: 'Test Creator',
    email: 'creator@example.com',
    phone: '0712345678',
    whatsappNumber: '0712345678',
  };

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

  it('renders DashboardProfilePanel with bottomInset="0px" and creator-surface styling', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreatorProfileSheet
            open={true}
            onOpenChange={vi.fn()}
            creator={mockCreator as unknown as Parameters<typeof CreatorProfileSheet>[0]['creator']}
            onLogout={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const panelHost = screen.getByTestId('dashboard-profile-panel');
    expect(panelHost).toBeInTheDocument();
    // Ensures full-height coverage down to bottom (0px), matching seller and buyer profile UX
    expect(panelHost).toHaveStyle({ bottom: '0px' });

    const aside = screen.getByRole('complementary', { name: 'Profile' });
    expect(aside).toHaveClass('creator-surface');
  });
});
