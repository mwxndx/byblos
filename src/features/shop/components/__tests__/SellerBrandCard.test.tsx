import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SellerBrandCard from '../SellerBrandCard';
import type { ApiPublicSeller } from '@/shared/types/api/seller';

vi.mock('@/features/shop/hooks/useShopQueries', () => ({
  useKnockSellerMutation: () => ({ mutate: vi.fn() }),
}));

describe('SellerBrandCard — Business Profile Photo Circular Frame', () => {
  const mockSeller: ApiPublicSeller = {
    id: 'seller-1',
    shopName: 'Amani Styles',
    fullName: 'Amani Seller',
    status: 'active',
    is_active: true,
    avatarUrl: 'https://images.unsplash.com/photo-business-logo.jpg',
    theme: 'default',
  };

  it('renders business profile photo inside a circular frame with rounded-full and overflow-hidden', () => {
    render(
      <MemoryRouter>
        <SellerBrandCard seller={mockSeller} />
      </MemoryRouter>
    );

    const businessImg = screen.getByAltText('Amani Styles business photo');
    expect(businessImg).toBeInTheDocument();

    // The image parent must be a circular frame
    const circularFrame = businessImg.parentElement;
    expect(circularFrame).toBeInTheDocument();
    expect(circularFrame).toHaveClass('rounded-full');
    expect(circularFrame).toHaveClass('overflow-hidden');
    expect(circularFrame).toHaveClass('aspect-square');
  });

  it('renders store fallback icon inside a circular frame when no avatar exists', () => {
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

  it('does not render blurred ambient image in the background and uses clean card color', () => {
    const { container } = render(
      <MemoryRouter>
        <SellerBrandCard seller={mockSeller} />
      </MemoryRouter>
    );

    // No blurred ambient background img element
    const blurredImgs = container.querySelectorAll('.blur-sm, .blur-md');
    expect(blurredImgs.length).toBe(0);

    // Top section uses clean card color
    const topSection = container.querySelector('.h-\\[66\\%\\]');
    expect(topSection).toHaveClass('bg-zinc-900/60');
  });
});
