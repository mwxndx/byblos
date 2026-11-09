import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ShopHero } from '../ShopHero';
import type { ShopSeller } from '../../utils/shopPage.shared';

describe('ShopHero Component (TDD)', () => {
  it('renders business profile photo without circular border or theme-accent styles', () => {
    const mockSeller: ShopSeller = {
      id: '123',
      fullName: 'Jane Doe',
      shopName: 'Jane Boutique',
      phone: '0712345678',
      whatsappNumber: '0712345678',
      email: 'jane@example.com',
      bio: 'Quality goods',
      avatarUrl: '',
      latitude: -1.286389,
      longitude: 36.817223,
      createdAt: new Date().toISOString(),
      isCreatorMarketplaceEnabled: true,
      hasPhysicalShop: false,
    };

    render(
      <MemoryRouter>
        <ShopHero
          sellerInfo={mockSeller}
          showSellerAvatar={false}
          setAvatarLoadFailed={vi.fn()}
          sellerInitials="JB"
        />
      </MemoryRouter>
    );

    // Avatar wrapper should not have circular border or theme-accent border style
    const initialsElement = screen.getByText('JB');
    const avatarWrapper = initialsElement.parentElement;
    expect(avatarWrapper?.className).not.toContain('border-4');
    expect(avatarWrapper?.getAttribute('style')).toBeNull();

    // Location map link should be present without theme-accent inline style
    const locationLink = screen.getByRole('link', { name: /Open shop location on the map/i });
    expect(locationLink).toBeDefined();
    const svgIcon = locationLink.querySelector('svg');
    expect(svgIcon?.getAttribute('style')).toBeNull();
  });

  it('renders business avatar image when showSellerAvatar is true', () => {
    const mockSeller: ShopSeller = {
      id: '123',
      fullName: 'Jane Doe',
      shopName: 'Jane Boutique',
      phone: '0712345678',
      whatsappNumber: '0712345678',
      email: 'jane@example.com',
      bio: 'Quality goods',
      avatarUrl: 'https://images.unsplash.com/photo-avatar.jpg',
      latitude: -1.286389,
      longitude: 36.817223,
      createdAt: new Date().toISOString(),
      isCreatorMarketplaceEnabled: true,
      hasPhysicalShop: false,
    };

    render(
      <MemoryRouter>
        <ShopHero
          sellerInfo={mockSeller}
          showSellerAvatar={true}
          setAvatarLoadFailed={vi.fn()}
          sellerInitials="JB"
        />
      </MemoryRouter>
    );

    const avatarImg = screen.getByAltText('Jane Boutique avatar');
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', 'https://images.unsplash.com/photo-avatar.jpg');
  });
});
