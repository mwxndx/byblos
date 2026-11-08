import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SellerProfileHero } from '../SellerProfileHero';
import type { SellerProfile } from '../../../auth/types/authTypes';

describe('SellerProfileHero', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const baseProfile: SellerProfile = {
    id: 123,
    is_verified: true,
    createdAt: '2026-01-01',
    shopName: 'eris',
    fullName: 'Roy Miller',
    email: 'roy@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
    bio: 'Quality goods for everyone',
    phone: '0712345678',
    whatsappNumber: '0712345678',
    city: 'Nairobi',
    location: 'CBD',
  };

  it('normalizes lowercase shop name to Title Case in avatar alt text', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
        />
      </QueryClientProvider>
    );

    // Should display 'Eris' in avatar alt text
    expect(screen.getByAltText('Eris')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shop link/i })).toBeInTheDocument();
  });

  it('normalizes shop name with underscores by replacing them with spaces and capitalizing each word', () => {
    const profileWithUnderscores: SellerProfile = {
      ...baseProfile,
      shopName: 'eris_fashion_shop',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={profileWithUnderscores}
          shopUsername="eris_fashion_shop"
          onCopyShopLink={vi.fn()}
          canEdit={true}
        />
      </QueryClientProvider>
    );

    expect(screen.getByAltText('Eris Fashion Shop')).toBeInTheDocument();
  });

  it('falls back to "Your shop" initial when shop name and avatar are missing', () => {
    const emptyProfile: SellerProfile = {
      ...baseProfile,
      shopName: '',
      avatarUrl: '',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={emptyProfile}
          shopUsername=""
          onCopyShopLink={vi.fn()}
          canEdit={false}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Y')).toBeInTheDocument();
  });

  it('renders children alongside the profile photo and shop link button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
        >
          <div data-testid="metrics-container">Extra Content</div>
        </SellerProfileHero>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('metrics-container')).toBeInTheDocument();
    expect(screen.getByAltText('Eris')).toBeInTheDocument();
  });

  it('renders balance, revenue, and sales stats with figures on top and text below, without cards', () => {
    const handleSelectTab = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
          balance={1500}
          revenue={1200}
          totalSales={2000}
          onSelectTab={handleSelectTab}
        />
      </QueryClientProvider>
    );

    // Figures
    expect(screen.getByText(/KSh 1,500/i)).toBeInTheDocument();
    expect(screen.getByText(/KSh 1,200/i)).toBeInTheDocument();
    expect(screen.getByText(/KSh 2,000/i)).toBeInTheDocument();

    // Labels below figures
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();

    // Withdraw button next to balance
    expect(screen.getByRole('button', { name: /Withdraw/i })).toBeInTheDocument();

    // Popover description buttons for Revenue and Sales
    expect(screen.getByRole('button', { name: /Revenue description/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sales description/i })).toBeInTheDocument();
  });

  it('matches photo width and height with shop link button width and has no border', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
        />
      </QueryClientProvider>
    );

    const photoWrapper = container.querySelector('.rounded-full.overflow-hidden');
    expect(photoWrapper).toHaveClass('h-24', 'w-24');
    expect(photoWrapper).not.toHaveStyle({ border: '3px solid' });

    const shopLinkButton = screen.getByRole('button', { name: /Shop link/i });
    expect(shopLinkButton).toHaveClass('w-24');
  });
});
