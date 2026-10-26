import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ShopHero } from '../ShopHero';
import type { ShopSeller } from '../../utils/shopPage.shared';

describe('ShopHero Component (TDD)', () => {
  it('applies theme-accent variable to avatar border and map pin instead of hardcoded yellow', () => {
    const mockSeller: ShopSeller = {
      id: '123',
      fullName: 'Jane Doe',
      shopName: 'Jane Boutique',
      phone: '0712345678',
      whatsappNumber: '0712345678',
      email: 'jane@example.com',
      theme: 'pink',
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

    // Avatar wrapper should use var(--theme-accent, #f5c518)
    const initialsElement = screen.getByText('JB');
    const avatarWrapper = initialsElement.parentElement;
    expect(avatarWrapper?.getAttribute('style')).toContain('border-color: var(--theme-accent, #f5c518)');

    // Location map link should be present and contain styled icon
    const locationLink = screen.getByRole('link', { name: /Open shop location on the map/i });
    expect(locationLink).toBeDefined();
    const svgIcon = locationLink.querySelector('svg');
    expect(svgIcon?.getAttribute('style')).toContain('color: var(--theme-accent, #f5c518)');
  });
});
