import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BuyerDashboard from '../BuyerDashboard';

const mockNavigate = vi.fn();
let mockActiveSection: 'shop' | 'notifications' | 'wishlist' | 'orders' | 'profile' | 'refunds' = 'shop';
let mockGlobalUser: Record<string, unknown> | null = null;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/features/auth/contexts', () => ({
  useGlobalAuth: () => ({
    user: mockGlobalUser,
    logout: vi.fn(),
    isAuthenticated: Boolean(mockGlobalUser),
  }),
}));

vi.mock('@/features/shop/wishlist/useWishlist', () => ({
  useWishlist: () => ({ wishlist: [{ id: 1 }, { id: 2 }] }),
}));

vi.mock('@/features/buyer/components/dashboard/hooks/useBuyerActiveSection', () => ({
  useBuyerActiveSection: () => ({ activeSection: mockActiveSection }),
}));

vi.mock('@/features/buyer/components/dashboard/hooks/useBuyerProfileForm', () => ({
  useBuyerProfileForm: () => ({
    isEditingProfile: false,
    setIsEditingProfile: vi.fn(),
    mobilePayment: '',
    setMobilePayment: vi.fn(),
    area: '',
    setArea: vi.fn(),
    isSavingProfile: false,
    handleSaveProfile: vi.fn(),
  }),
}));

vi.mock('@/features/buyer/components/dashboard/hooks/useBuyerOrdersNotification', () => ({
  useBuyerOrdersNotification: () => ({ hasUnreadOrders: false, markOrdersViewed: vi.fn() }),
}));

vi.mock('@/features/notifications/hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));

vi.mock('@/shared/hooks/useAppTheme', () => ({
  useThemeScope: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

vi.mock('@/shared/hooks/useSwipeTabs', () => ({
  useSwipeTabs: () => ({
    onTouchStart: vi.fn(),
    onTouchEnd: vi.fn(),
    onTouchCancel: vi.fn(),
  }),
}));

vi.mock('@/features/shop/components/SellersGrid', () => ({
  default: () => <div data-testid="sellers-grid">SellersGrid</div>,
}));

vi.mock('@/features/buyer/components/dashboard/BuyerDashboardHeader', () => ({
  BuyerDashboardHeader: () => <header data-testid="buyer-header">Header</header>,
}));

vi.mock('@/features/buyer/components/dashboard/BuyerBottomNav', () => ({
  BuyerBottomNav: () => <nav data-testid="buyer-nav">Nav</nav>,
}));

vi.mock('@/features/buyer/components/dashboard/BuyerProfileSheet', () => ({
  BuyerProfileSheet: () => null,
}));

vi.mock('@/features/buyer/components/WishlistSection', () => ({
  default: () => <div data-testid="wishlist-section">WishlistSection</div>,
}));

vi.mock('@/features/buyer/components/BuyerRefundsTab', () => ({
  BuyerRefundsTab: ({ refundAmount }: { refundAmount: number }) => (
    <div data-testid="buyer-refunds-tab">Refunds: {refundAmount}</div>
  ),
}));

vi.mock('@/features/notifications/components/NotificationList', () => ({
  NotificationList: () => <div data-testid="notification-list">Notifications</div>,
}));

describe('BuyerDashboard Clean Rewrite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveSection = 'shop';
    mockGlobalUser = null;
  });

  it('uses 100dvh, semantic text-label, and a <main> content landmark', () => {
    const { container } = render(<BuyerDashboard />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('h-[100dvh]');
    expect(root.className).toContain('text-label');
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByTestId('sellers-grid')).toBeInTheDocument();
  });

  it('renders shared guest sign-in prompt on notifications and refunds when logged out', () => {
    mockActiveSection = 'notifications';
    const { rerender } = render(<BuyerDashboard />);
    expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/buyer/login');

    mockActiveSection = 'refunds';
    rerender(<BuyerDashboard />);
    expect(screen.getByText('Refunds')).toBeInTheDocument();
  });

  it('renders BuyerRefundsTab with parsed refund balance when authenticated', () => {
    mockActiveSection = 'refunds';
    mockGlobalUser = {
      role: 'buyer',
      profile: { id: 1, refunds: '450.5' },
    };
    render(<BuyerDashboard />);
    expect(screen.getByTestId('buyer-refunds-tab')).toHaveTextContent('Refunds: 450.5');
  });

  it('renders WishlistSection with item count when activeSection is wishlist', () => {
    mockActiveSection = 'wishlist';
    render(<BuyerDashboard />);
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByTestId('wishlist-section')).toBeInTheDocument();
  });
});

