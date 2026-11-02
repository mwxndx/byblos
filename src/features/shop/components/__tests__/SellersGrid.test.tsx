import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SellersGrid from '../SellersGrid';
import type { ApiPublicSeller } from '@/shared/types/api/seller';

vi.mock('@/features/shop/hooks/useShopQueries', () => ({
  usePublicSellersQuery: vi.fn(),
  useKnockSellerMutation: () => ({ mutate: vi.fn() })
}));

import { usePublicSellersQuery } from '@/features/shop/hooks/useShopQueries';

describe('SellersGrid defense-in-depth', () => {
  it('renders active shops and excludes deleted-shop tombstone cards even if present in query cache', () => {
    const mockSellers: Partial<ApiPublicSeller>[] = [
      {
        id: '5',
        shopName: 'Toto',
        fullName: 'Toto Seller',
        status: 'active',
        is_active: true,
      },
      {
        id: '16',
        shopName: 'deleted-shop-16_1792971474434',
        fullName: 'Deleted user',
        status: 'deleted',
        is_active: false,
      },
      {
        id: '1',
        shopName: 'eris',
        fullName: 'Eris Store',
        status: 'active',
        is_active: true,
      }
    ];

    vi.mocked(usePublicSellersQuery).mockReturnValue({
      data: {
        sellers: mockSellers as ApiPublicSeller[],
        pagination: { page: 1, pageSize: 24, total: 3, hasMore: false }
      },
      isLoading: false,
    } as unknown as ReturnType<typeof usePublicSellersQuery>);

    render(
      <MemoryRouter>
        <SellersGrid filterCity="" filterArea="" searchQuery="" isBuyer={true} />
      </MemoryRouter>
    );

    // Active shops must be in the document
    expect(screen.getByText('Toto')).toBeInTheDocument();
    expect(screen.getByText('eris')).toBeInTheDocument();

    // Tombstoned shop must NOT be rendered
    expect(screen.queryByText(/deleted-shop-16/i)).not.toBeInTheDocument();
  });

  it('prioritizes shops with business profile photo, instagram, and tiktok first in the buyer dashboard', () => {
    const mockSellers: Partial<ApiPublicSeller>[] = [
      {
        id: '1',
        shopName: 'Incomplete Shop',
        fullName: 'Seller Incomplete',
        status: 'active',
        is_active: true,
      },
      {
        id: '2',
        shopName: 'Complete Shop',
        fullName: 'Seller Complete',
        avatarUrl: 'https://example.com/avatar.jpg',
        instagramLink: 'completeshop',
        tiktokLink: 'completeshop',
        status: 'active',
        is_active: true,
      },
      {
        id: '3',
        shopName: 'Photo Only Shop',
        fullName: 'Seller Photo',
        avatarUrl: 'https://example.com/photo.jpg',
        status: 'active',
        is_active: true,
      }
    ];

    vi.mocked(usePublicSellersQuery).mockReturnValue({
      data: {
        sellers: mockSellers as ApiPublicSeller[],
        pagination: { page: 1, pageSize: 24, total: 3, hasMore: false }
      },
      isLoading: false,
    } as unknown as ReturnType<typeof usePublicSellersQuery>);

    const { container } = render(
      <MemoryRouter>
        <SellersGrid filterCity="" filterArea="" searchQuery="" isBuyer={true} />
      </MemoryRouter>
    );

    const renderedText = container.textContent || '';
    const completeIndex = renderedText.indexOf('Complete Shop');
    const photoOnlyIndex = renderedText.indexOf('Photo Only Shop');
    const incompleteIndex = renderedText.indexOf('Incomplete Shop');

    expect(completeIndex).toBeGreaterThanOrEqual(0);
    expect(completeIndex).toBeLessThan(photoOnlyIndex);
    expect(photoOnlyIndex).toBeLessThan(incompleteIndex);
  });
});
