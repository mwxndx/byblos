import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreatorAvailableShops } from '../CreatorAvailableShops';
import type { AvailableShop } from '../../api/marketplace';

const mockShops: AvailableShop[] = [
  {
    id: 1,
    shopName: 'Active Boutique',
    slug: 'active-boutique',
    creatorCommissionRate: 0.1,
    productCount: 5,
    collaborationStatus: 'active',
  },
  {
    id: 2,
    shopName: 'Pending Store',
    slug: 'pending-store',
    creatorCommissionRate: 0.05,
    productCount: 2,
    collaborationStatus: 'pending',
  },
  {
    id: 3,
    shopName: 'Declined Shop',
    slug: 'declined-shop',
    creatorCommissionRate: 0.08,
    productCount: 4,
    collaborationStatus: 'denied',
  },
  {
    id: 4,
    shopName: 'Open Brand',
    slug: 'open-brand',
    creatorCommissionRate: 0.05,
    productCount: 10,
    collaborationStatus: 'none',
  },
];

vi.mock('../../hooks/queries/useAvailableShopsQuery', () => ({
  useAvailableShopsQuery: () => ({
    data: mockShops,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/mutations/useRequestCollaborationMutation', () => ({
  useRequestCollaborationMutation: () => ({
    mutateAsync: vi.fn(),
  }),
}));

describe('CreatorAvailableShops', () => {
  it('renders status badges correctly including Declined for denied shops', () => {
    render(
      <MemoryRouter>
        <CreatorAvailableShops />
      </MemoryRouter>
    );

    expect(screen.getByText('Active Boutique')).toBeInTheDocument();
    expect(screen.getByText('Pending Store')).toBeInTheDocument();
    expect(screen.getByText('Declined Shop')).toBeInTheDocument();
    expect(screen.getByText('Open Brand')).toBeInTheDocument();

    expect(screen.getByText('Promoting')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Declined')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request/i })).toBeInTheDocument();
  });
});
