import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SellerBrandCard from '../SellerBrandCard';
import type { ApiPublicSeller } from '@/shared/types/api/seller';

vi.mock('@/features/shop/hooks/useShopQueries', () => ({
  useKnockSellerMutation: () => ({ mutate: vi.fn() }),
}));

describe('SellerBrandCard — Business Profile Photo Fitting', () => {
  const mockSeller: ApiPublicSeller = {
    id: 'seller-1',
    shopName: 'Amani Styles',
    fullName: 'Amani Seller',
    status: 'active',
    is_active: true,
    avatarUrl: 'https://images.unsplash.com/photo-business-logo.jpg',
    theme: 'default',
  };

  it('renders business profile photo with object-contain to avoid image clipping from being rendered too big', () => {
    render(
      <MemoryRouter>
        <SellerBrandCard seller={mockSeller} />
      </MemoryRouter>
    );

    const businessImg = screen.getByAltText('Amani Styles business photo');
    expect(businessImg).toBeInTheDocument();

    // Must use object-contain (not object-cover) so full business profile photo fits without edge cropping
    expect(businessImg).toHaveClass('object-contain');
    expect(businessImg).not.toHaveClass('object-cover');
  });
});
