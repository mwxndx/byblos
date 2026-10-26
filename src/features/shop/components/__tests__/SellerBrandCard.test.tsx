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

  it('removes extra background shape so the card is a single unified shape without top section background split', () => {
    const { container } = render(
      <MemoryRouter>
        <SellerBrandCard seller={mockSeller} />
      </MemoryRouter>
    );

    // No extra split background container dividing the card
    expect(container.querySelector('.bg-zinc-900\\/60')).not.toBeInTheDocument();
    expect(container.querySelector('.h-\\[66\\%\\]')).not.toBeInTheDocument();

    // The business profile photo is still housed in a circular frame
    const businessImg = screen.getByAltText('Amani Styles business photo');
    const circularFrame = businessImg.parentElement;
    expect(circularFrame).toHaveClass('rounded-full');
    expect(circularFrame).toHaveClass('aspect-square');
  });

  it('renders store fallback icon in circular frame when avatar is empty', () => {
    const { container } = render(
      <MemoryRouter>
        <SellerBrandCard seller={{ ...mockSeller, avatarUrl: '' }} />
      </MemoryRouter>
    );

    const circularFrame = container.querySelector('.rounded-full');
    expect(circularFrame).toBeInTheDocument();
    expect(circularFrame).toHaveClass('aspect-square');
    expect(circularFrame?.querySelector('svg')).toBeInTheDocument();
  });
});
