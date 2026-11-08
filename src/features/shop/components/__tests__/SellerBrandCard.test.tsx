import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SellerBrandCard from '../SellerBrandCard';
import type { ApiPublicSeller } from '@/shared/types/api/seller';

vi.mock('@/features/shop/hooks/useShopQueries', () => ({
  useKnockSellerMutation: () => ({ mutate: vi.fn() }),
}));

describe('SellerBrandCard — Clean Unified Card & Bold Shop Name', () => {
  const mockSeller: ApiPublicSeller = {
    id: 'seller-1',
    shopName: 'Amani Styles',
    fullName: 'Amani Seller',
    status: 'active',
    is_active: true,
    avatarUrl: 'https://images.unsplash.com/photo-business-logo.jpg',
    theme: 'default',
  };

  it('renders shop name as bold with increased font size (+3px: 15px/17px)', () => {
    render(
      <MemoryRouter>
        <SellerBrandCard seller={mockSeller} />
      </MemoryRouter>
    );

    const heading = screen.getByRole('heading', { level: 3, name: 'Amani Styles' });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('font-bold');
    expect(heading).not.toHaveClass('font-normal');
    expect(heading.className).toMatch(/text-\[15px\]/);
  });

  it('renders a square frame for business profile photo on the top half of the card', () => {
    const { container } = render(
      <MemoryRouter>
        <SellerBrandCard seller={mockSeller} />
      </MemoryRouter>
    );

    // Business profile photo is housed in the top-half frame
    const businessImg = screen.getByAltText('Amani Styles business photo');
    const squareFrame = businessImg.parentElement;
    expect(squareFrame).toBeInTheDocument();
    expect(squareFrame?.className).toContain('h-[52%]');
    expect(squareFrame).not.toHaveClass('rounded-full');
  });

  it('renders store fallback icon in top-half square frame when avatar is empty', () => {
    const { container } = render(
      <MemoryRouter>
        <SellerBrandCard seller={{ ...mockSeller, avatarUrl: '' }} />
      </MemoryRouter>
    );

    const squareFrame = container.querySelector('.h-\\[52\\%\\]');
    expect(squareFrame).toBeInTheDocument();
    expect(squareFrame).not.toHaveClass('rounded-full');
    expect(squareFrame?.querySelector('svg')).toBeInTheDocument();
  });
});
