import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatorLinkedShops } from '../CreatorLinkedShops';
import type { LinkedShop } from '@/features/creator/utils/creatorDashboardUtils';

describe('CreatorLinkedShops', () => {
  const mockOnCopy = vi.fn();
  const mockOnLeave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const activeShop: LinkedShop = {
    id: 1,
    seller_id: 101,
    shop_name: 'Glam Boutique',
    slug: 'glam-boutique',
    code: 'GLAM123',
    commission_rate: 0.1,
    sales_count: 5,
    click_count: 50,
    earnings: 2500,
    sellerCreatorModeOff: false,
    status: 'active'
  };

  const pausedShop: LinkedShop = {
    id: 2,
    seller_id: 102,
    shop_name: 'Urban Sneakers',
    slug: 'urban-sneakers',
    code: undefined,
    commission_rate: 0.05,
    sales_count: 2,
    click_count: 20,
    earnings: 800,
    sellerCreatorModeOff: true,
    status: 'paused'
  };

  it('renders active shop with active copy link button and read-only preview', () => {
    render(
      <CreatorLinkedShops
        shops={[activeShop]}
        onCopy={mockOnCopy}
        onLeave={mockOnLeave}
        leavingSellerId={null}
        maxPromotions={3}
      />
    );

    expect(screen.getByText('Glam Boutique')).toBeInTheDocument();
    expect(screen.getByText(/10% cut/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.queryByText(/creator mode paused/i)).not.toBeInTheDocument();

    const copyBtn = screen.getByRole('button', { name: /copy link/i });
    fireEvent.click(copyBtn);
    expect(mockOnCopy).toHaveBeenCalled();
  });

  it('renders paused shop with "Creator Mode Paused" badge and disabled copy button', () => {
    render(
      <CreatorLinkedShops
        shops={[pausedShop]}
        onCopy={mockOnCopy}
        onLeave={mockOnLeave}
        leavingSellerId={null}
        maxPromotions={3}
      />
    );

    expect(screen.getByText('Urban Sneakers')).toBeInTheDocument();
    expect(screen.getByText('Creator Mode Paused')).toBeInTheDocument();
    expect(
      screen.getByText(/This seller has switched off creator mode. Collaboration link is paused until the seller re-enables it./i)
    ).toBeInTheDocument();

    // The copy button is disabled and labelled "Link paused"
    const pausedBtn = screen.getByRole('button', { name: /link paused/i });
    expect(pausedBtn).toBeInTheDocument();
    expect(pausedBtn).toBeDisabled();

    // Copy callback should not fire
    fireEvent.click(pausedBtn);
    expect(mockOnCopy).not.toHaveBeenCalled();
  });

  it('allows creator to leave a shop even when paused', () => {
    render(
      <CreatorLinkedShops
        shops={[pausedShop]}
        onCopy={mockOnCopy}
        onLeave={mockOnLeave}
        leavingSellerId={null}
        maxPromotions={3}
      />
    );

    const leaveBtn = screen.getByRole('button', { name: /leave/i });
    expect(leaveBtn).toBeInTheDocument();
    expect(leaveBtn).not.toBeDisabled();

    fireEvent.click(leaveBtn);
    expect(mockOnLeave).toHaveBeenCalledWith(102);
  });
});
