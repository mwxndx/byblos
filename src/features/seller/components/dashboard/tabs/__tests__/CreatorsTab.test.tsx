import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatorsTab } from '../CreatorsTab';

const mockMutateAsync = vi.fn();
const mockRefetch = vi.fn();

const mockDashboardData = {
  isCreatorMarketplaceEnabled: false,
  creatorCommissionRate: 0.05,
  incomingRequests: [],
  activeCreators: [],
  manualInvites: [],
};

vi.mock('@/features/seller/hooks/useSellerCreators', () => ({
  useSellerCreatorsQuery: () => ({
    data: mockDashboardData,
    isLoading: false,
    refetch: mockRefetch,
  }),
  useUpdateCreatorListingMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useRespondToCreatorRequestMutation: () => ({
    mutateAsync: vi.fn(),
  }),
  useRemoveSellerCreatorMutation: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('@/features/seller/hooks/useSellerProfile', () => ({
  useInviteCreatorMutation: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CreatorsTab - Marketplace Listing Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ isCreatorMarketplaceEnabled: true });
  });

  it('toggles marketplace without coupling to creatorCommissionRate', async () => {
    render(<CreatorsTab />);

    const toggleButton = screen.getByRole('switch', { name: /list shop for creator requests/i });
    expect(toggleButton).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    // CRITICAL: toggling marketplace switch MUST NOT send creatorCommissionRate
    expect(mockMutateAsync).toHaveBeenCalledWith({
      isCreatorMarketplaceEnabled: true,
    });
  });

  it('renders switch with high-contrast visible track and white thumb when off', () => {
    render(<CreatorsTab />);

    const toggleButton = screen.getByRole('switch', { name: /list shop for creator requests/i });
    expect(toggleButton.className).toContain('shrink-0');

    const thumb = toggleButton.querySelector('span');
    // In dark mode, an off switch MUST have a visible white thumb, NOT bg-black
    expect(thumb?.className).toContain('bg-white');
  });

  it('renders a prominent "List Shop in Marketplace" button when not listed', async () => {
    render(<CreatorsTab />);

    const actionButton = screen.getByRole('button', { name: /list shop in marketplace/i });
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      isCreatorMarketplaceEnabled: true,
    });
  });
});
