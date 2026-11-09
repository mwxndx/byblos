import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ShopPage from '../ShopPage';
import { GlobalAuthContext } from '@/features/auth/contexts/authContextObjects';
import type { GlobalAuthContextType } from '@/features/auth/types/authTypes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const mockAuthValue: GlobalAuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  refreshUser: vi.fn(),
};

// Mock useShopPage hook to supply ready-state shop data
vi.mock('../useShopPage', () => ({
  useShopPage: () => ({
    sellerInfo: {
      id: 'seller-1',
      fullName: 'Boutique Owner',
      shopName: 'Test Boutique',
      phone: '0712345678',
      whatsappNumber: '0712345678',
      email: 'owner@test.com',
      bio: 'Premium apparel & accessories',
      avatarUrl: '',
      latitude: -1.286389,
      longitude: 36.817223,
      createdAt: new Date().toISOString(),
      isCreatorMarketplaceEnabled: true,
      hasPhysicalShop: true,
      physicalAddress: 'Kimathi Street, Nairobi',
    },
    creatorModeNotice: null,
    hasDigitalProducts: false,
    filteredProducts: [],
    searchQuery: '',
    setSearchQuery: vi.fn(),
    setAvatarLoadFailed: vi.fn(),
    sellerInitials: 'TB',
    showSellerAvatar: false,
    isLoading: false,
    error: null,
  }),
}));

describe('ShopPage Header UI', () => {
  it('renders the Byblos header matching the buyer header style with Byblos text centered', () => {
    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <GlobalAuthContext.Provider value={mockAuthValue}>
            <MemoryRouter initialEntries={['/test-boutique']}>
              <Routes>
                <Route path="/:shopName" element={<ShopPage />} />
              </Routes>
            </MemoryRouter>
          </GlobalAuthContext.Provider>
        </QueryClientProvider>
      </HelmetProvider>
    );

    // Verify Byblos text exists at the center of the header
    const byblosBrand = screen.getByText('Byblos');
    expect(byblosBrand).toBeDefined();
    expect(byblosBrand.className).toContain('font-bold');

    // Verify header tag has the sticky, border-b, and shadow-none styling
    const header = byblosBrand.closest('header');
    expect(header).not.toBeNull();
    expect(header?.className).toContain('sticky');
    expect(header?.className).toContain('top-0');
    expect(header?.className).toContain('shadow-none');
    expect(header?.className).toContain('border-b');
  });
});

