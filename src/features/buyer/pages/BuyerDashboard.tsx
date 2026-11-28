import { useMemo, useState, Suspense, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, WalletCards, Store, ShoppingBag, Bell } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import { OrdersLoadingState } from '@/shared/ui/OrdersLoadingState';
import { safeLazy } from '@/shared/utils/safeLazy';
import { useThemeScope } from '@/shared/hooks/useAppTheme';
import { useSwipeTabs } from '@/shared/hooks/useSwipeTabs';
import { useModalBackDismiss } from '@/shared/hooks/useModalBackDismiss';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { BuyerProfile } from '@/features/auth/types/authTypes';
import { useWishlist } from '@/features/shop/wishlist/useWishlist';
import SellersGrid from '@/features/shop/components/SellersGrid';
import { NotificationList } from '@/features/notifications/components/NotificationList';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import WishlistSection from '../components/WishlistSection';
import { BuyerRefundsTab } from '../components/BuyerRefundsTab';
import { BuyerBottomNav, type BuyerSection } from '../components/dashboard/BuyerBottomNav';
import { BuyerDashboardHeader } from '../components/dashboard/BuyerDashboardHeader';
import { BuyerProfileSheet } from '../components/dashboard/BuyerProfileSheet';
import { useBuyerActiveSection } from '../components/dashboard/hooks/useBuyerActiveSection';
import { useBuyerProfileForm } from '../components/dashboard/hooks/useBuyerProfileForm';
import { useBuyerOrdersNotification } from '../components/dashboard/hooks/useBuyerOrdersNotification';

const OrdersSection = safeLazy(() => import('@/features/orders/components/OrdersSectionContainer'));

const SWIPE_SECTIONS = ['shop', 'wishlist', 'orders', 'notifications'] as const;

const SECTION_PATHS: Record<BuyerSection, string> = {
  shop: 'dashboard',
  notifications: 'notifications',
  orders: 'orders',
  wishlist: 'wishlist',
  profile: 'profile',
  refunds: 'refunds',
};

function parseRefundBalance(profile: BuyerProfile | null): number {
  if (!profile || !('refunds' in profile)) return 0;
  const raw = (profile as BuyerProfile & { refunds?: string | number }).refunds;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

interface BuyerGuestPromptCardProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onSignIn: () => void;
}

function BuyerGuestPromptCard({
  icon: Icon,
  title,
  description,
  onSignIn,
}: Readonly<BuyerGuestPromptCardProps>) {
  return (
    <div className="rounded-card border border-separator bg-surface-1 p-6 text-center space-y-3">
      <Icon className="mx-auto h-8 w-8 text-yellow-400" />
      <h3 className="text-base font-semibold text-label">{title}</h3>
      <p className="text-xs text-label-2 max-w-sm mx-auto leading-relaxed">{description}</p>
      <Button
        type="button"
        onClick={onSignIn}
        className="h-10 px-6 rounded-full bg-[#F5C518] text-black font-semibold hover:bg-yellow-300"
      >
        Sign In
      </Button>
    </div>
  );
}

/**
 * Buyer Dashboard shell: manages section routing, swipe navigation across core tabs,
 * header search, profile sheet, and bottom navigation across Desktop, Android, and iOS PWA.
 */
function BuyerDashboard() {
  useThemeScope('buyer');
  const navigate = useNavigate();
  const { user: globalUser, logout } = useGlobalAuth();
  const user = globalUser?.role === 'buyer' ? (globalUser.profile as BuyerProfile) : null;

  const { wishlist } = useWishlist();
  const { activeSection } = useBuyerActiveSection();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const {
    isEditingProfile,
    setIsEditingProfile,
    mobilePayment,
    setMobilePayment,
    area,
    setArea,
    isSavingProfile,
    handleSaveProfile,
  } = useBuyerProfileForm();

  const { hasUnreadOrders, markOrdersViewed } = useBuyerOrdersNotification(Boolean(user));
  const { unreadCount: unreadNotificationsCount } = useNotifications('default', Boolean(user), 'buyer');

  useModalBackDismiss(isProfileOpen, () => setIsProfileOpen(false));
  useModalBackDismiss(isSearchOpen && !isProfileOpen, () => setIsSearchOpen(false));

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const refundAmount = parseRefundBalance(user);

  const navItems = useMemo(
    () =>
      [
        { key: 'shop', label: 'Shops', Icon: Store, path: '/buyer/dashboard' },
        { key: 'wishlist', label: 'Wishlist', Icon: Heart, path: '/buyer/wishlist' },
        { key: 'orders', label: 'Orders', Icon: ShoppingBag, path: '/buyer/orders', badge: hasUnreadOrders },
        { key: 'refunds', label: 'Refunds', Icon: WalletCards, path: '/buyer/refunds' },
        {
          key: 'notifications',
          label: 'Alerts',
          Icon: Bell,
          path: '/buyer/notifications',
          badge: unreadNotificationsCount > 0,
          count: unreadNotificationsCount,
        },
      ] as const,
    [hasUnreadOrders, unreadNotificationsCount]
  );

  const setActiveTab = (key: BuyerSection) => {
    if (key !== 'profile') {
      setIsEditingProfile(false);
    }
    navigate(`/buyer/${SECTION_PATHS[key]}`);
    if (key === 'orders') {
      markOrdersViewed();
    }
  };

  const {
    onTouchStart: handleDashboardTouchStart,
    onTouchEnd: handleDashboardTouchEnd,
    onTouchCancel: handleDashboardTouchCancel,
  } = useSwipeTabs({
    tabs: SWIPE_SECTIONS,
    activeTab: activeSection === 'refunds' || activeSection === 'profile' ? 'shop' : activeSection,
    onChange: setActiveTab,
    disabled: activeSection === 'profile' || activeSection === 'refunds',
  });

  return (
    <div className="page-enter dashboard-layout buyer-surface flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--bg,#000000)] text-label transition-colors duration-200">
      <BuyerDashboardHeader
        onOpenProfile={() => setIsProfileOpen(true)}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none scroll-smooth p-[clamp(10px,4vw,18px)] pb-[calc(4.75rem+var(--sab,env(safe-area-inset-bottom,0px)))]"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onTouchStart={handleDashboardTouchStart}
          onTouchEnd={handleDashboardTouchEnd}
          onTouchCancel={handleDashboardTouchCancel}
        >
          <div className={activeSection === 'shop' ? 'block' : 'hidden'} aria-hidden={activeSection !== 'shop'}>
            <SellersGrid filterCity="" filterArea="" searchQuery={searchQuery} isBuyer={true} />
          </div>

          {activeSection === 'notifications' && (
            <div className="mx-auto w-full max-w-[760px]">
              {user ? (
                <NotificationList
                  variant="default"
                  role="buyer"
                  scrollClassName=""
                  className="overflow-hidden rounded-card border border-transparent bg-surface-1"
                />
              ) : (
                <BuyerGuestPromptCard
                  icon={Bell}
                  title="Alerts & Notifications"
                  description="Sign in to your Byblos account to receive instant order tracking updates, delivery notifications, and messages."
                  onSignIn={() => navigate('/buyer/login')}
                />
              )}
            </div>
          )}

          {activeSection === 'wishlist' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-label">Wishlist</span>
                <span className="text-xs font-medium text-label-3">{wishlist.length} items</span>
              </div>
              <WishlistSection />
            </div>
          )}

          {activeSection === 'orders' && (
            <div className="space-y-4">
              <Suspense fallback={<OrdersLoadingState />}>
                <OrdersSection />
              </Suspense>
            </div>
          )}

          {activeSection === 'refunds' &&
            (user ? (
              <BuyerRefundsTab refundAmount={refundAmount} />
            ) : (
              <BuyerGuestPromptCard
                icon={WalletCards}
                title="Refunds"
                description="Sign in to view your refund balance and withdrawal history."
                onSignIn={() => navigate('/buyer/login')}
              />
            ))}
        </main>

        <BuyerProfileSheet
          open={isProfileOpen}
          onOpenChange={setIsProfileOpen}
          isEditingProfile={isEditingProfile}
          isSavingProfile={isSavingProfile}
          mobilePayment={mobilePayment}
          area={area}
          user={user}
          onLogout={handleLogout}
          onMobilePaymentChange={setMobilePayment}
          onAreaChange={setArea}
          onSaveProfile={handleSaveProfile}
          onToggleEdit={() => setIsEditingProfile(!isEditingProfile)}
        />
      </div>

      <BuyerBottomNav
        activeNav={activeSection}
        navItems={navItems}
        onSelect={setActiveTab}
        hidden={isProfileOpen}
      />
    </div>
  );
}

export default BuyerDashboard;
