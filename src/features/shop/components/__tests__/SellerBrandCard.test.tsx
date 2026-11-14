import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SellerBrandCard from '../SellerBrandCard';
import type { ApiPublicSeller } from '../../../../shared/types/api/seller';

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

  it('renders shop name as bold with increased font size and left-aligned', () => {
    render(
      <MemoryRouter>
        <SellerBrandCard seller={mockSeller} />
      </MemoryRouter>
    );

    const heading = screen.getByRole('heading', { level: 3, name: 'Amani Styles' });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('font-bold', 'text-left');
    expect(heading).not.toHaveClass('font-normal');
    expect(heading.className).toMatch(/text-\[15px\]/);
  });

  it('renders a square card with rounded corners matching navigation (48px) and light/dark borders', () => {
    const { container } = render(
      <MemoryRouter>
        <SellerBrandCard seller={mockSeller} />
      </MemoryRouter>
    );

    // Business profile photo is housed in a square frame with rounded corners
    const businessImg = screen.getByAltText('Amani Styles business photo');
    const avatarFrame = businessImg.parentElement;
    expect(avatarFrame).toBeInTheDocument();
    expect(avatarFrame).toHaveClass('rounded-xl');
    expect(avatarFrame).not.toHaveClass('rounded-full');
    expect(avatarFrame).toHaveClass('aspect-square');

    // Root card is full-width square with navigation corner integer (48px) and distinct borders
    const card = container.firstElementChild;
    expect(card).toHaveClass('w-full', 'aspect-square', 'rounded-[48px]');
    expect(card).toHaveClass('border', 'border-slate-300', 'dark:border-white/20');
  });

  it('renders store fallback icon in square frame with rounded corners when avatar is empty', () => {
    const { container } = render(
      <MemoryRouter>
        <SellerBrandCard seller={{ ...mockSeller, avatarUrl: '' }} />
      </MemoryRouter>
    );

    const avatarFrame = container.querySelector('.rounded-xl');
    expect(avatarFrame).toBeInTheDocument();
    expect(avatarFrame).toHaveClass('aspect-square');
    expect(avatarFrame).not.toHaveClass('rounded-full');
    expect(avatarFrame?.querySelector('svg')).toBeInTheDocument();
  });
});
