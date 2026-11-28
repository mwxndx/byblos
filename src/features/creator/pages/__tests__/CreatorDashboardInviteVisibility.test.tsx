import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreatorDashboard from '../CreatorDashboard';

let mockCreator: Record<string, unknown> = {
  id: 1,
  first_name: 'Jane',
  last_name: 'Creator',
  username: 'janecreator',
  username_confirmed: true,
  invited_via_email: false,
  balance: 0,
};

vi.mock('@/features/creator/hooks/queries/useCreatorDashboardQuery', () => ({
  useCreatorDashboardQuery: () => ({
    isLoading: false,
    data: {
      creator: mockCreator,
      shops: [],
      shopRequests: [],
      withdrawals: [],
      clearance: { availableBalance: 0, pendingBalance: 0, reservedBalance: 0 },
      analysis: { totals: {}, series: [] },
    },
  }),
}));

vi.mock('@/features/creator/hooks/queries/useCreatorReferralDashboardQuery', () => ({
  useCreatorReferralDashboardQuery: () => ({
    isLoading: false,
    data: {
      referralCode: 'REF123',
      invitedBusinesses: [],
      businessEarnings: [],
      totalReferralEarnings: 0,
    },
  }),
}));

vi.mock('@/features/notifications/hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));

vi.mock('@/features/creator/hooks/mutations/useCreatorAuthMutations', () => ({
  useCreatorLogoutMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/features/creator/hooks/mutations/useAcceptShopRequestMutation', () => ({
  useAcceptShopRequestMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/features/creator/hooks/mutations/useDenyShopRequestMutation', () => ({
  useDenyShopRequestMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/features/creator/hooks/mutations/useLeavePromotedShopMutation', () => ({
  useLeavePromotedShopMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/features/creator/hooks/mutations/useLeaveInvitedBusinessMutation', () => ({
  useLeaveInvitedBusinessMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/features/creator/components/CreatorAvailableShops', () => ({
  CreatorAvailableShops: () => <div data-testid="creator-available-shops">Explore available shops</div>,
}));
vi.mock('@/features/creator/components/CreatorLinkedShops', () => ({
  CreatorLinkedShops: () => <div data-testid="creator-linked-shops">Linked shops</div>,
}));
vi.mock('@/features/creator/components/CreatorEarningsHero', () => ({
  CreatorEarningsHero: () => null,
}));
vi.mock('@/features/creator/components/CreatorAnalysisCharts', () => ({
  CreatorAnalysisCharts: () => null,
}));
vi.mock('@/features/creator/components/CreatorProfileSheet', () => ({
  CreatorProfileSheet: () => null,
}));
vi.mock('@/features/creator/components/RequiredCreatorUsernameModal', () => ({
  RequiredCreatorUsernameModal: () => null,
}));
vi.mock('@/features/creator/components/CreatorWithdrawalPanel', () => ({
  CreatorWithdrawalPanel: () => null,
}));
vi.mock('@/features/creator/components/CreatorDashboardTabs', () => ({
  CreatorDashboardTabs: () => null,
}));
vi.mock('@/shared/ui/AppHeader', () => ({
  AppHeader: () => null,
}));

describe('CreatorDashboard - invited_via_email brand visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides CreatorAvailableShops when creator.invited_via_email is true', () => {
    mockCreator = {
      ...mockCreator,
      invited_via_email: true,
    };

    render(
      <MemoryRouter>
        <CreatorDashboard />
      </MemoryRouter>
    );

    expect(screen.getByTestId('creator-linked-shops')).toBeInTheDocument();
    expect(screen.queryByTestId('creator-available-shops')).not.toBeInTheDocument();
  });

  it('shows CreatorAvailableShops for organic creators (invited_via_email is false)', () => {
    mockCreator = {
      ...mockCreator,
      invited_via_email: false,
    };

    render(
      <MemoryRouter>
        <CreatorDashboard />
      </MemoryRouter>
    );

    expect(screen.getByTestId('creator-linked-shops')).toBeInTheDocument();
    expect(screen.getByTestId('creator-available-shops')).toBeInTheDocument();
  });

  it('uses 100dvh, semantic text-label, a <main> content landmark, and semantic search input tokens', () => {
    const { container } = render(
      <MemoryRouter>
        <CreatorDashboard />
      </MemoryRouter>
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('h-[100dvh]');
    expect(root.className).toContain('text-label');

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();

    const searchInput = screen.getByRole('searchbox', { name: /search shops/i });
    expect(searchInput.className).toContain('bg-surface-1');
    expect(searchInput.className).toContain('border-separator');
    expect(searchInput.className).not.toContain('bg-white dark:bg-surface-1');
  });
});

