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

  it('normalizes lowercase shop name to Title Case', () => {
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

    // Should display 'Eris' instead of raw lowercase 'eris'
    expect(screen.getByRole('heading', { level: 2, name: 'Eris' })).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { level: 2, name: 'Eris Fashion Shop' })).toBeInTheDocument();
  });

  it('falls back to "Your shop" when shop name is missing', () => {
    const emptyProfile: SellerProfile = {
      ...baseProfile,
      shopName: '',
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

    expect(screen.getByRole('heading', { level: 2, name: 'Your shop' })).toBeInTheDocument();
  });
});
