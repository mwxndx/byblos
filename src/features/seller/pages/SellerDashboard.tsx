import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDeleteProductMutation, useUpdateProductMutation } from '@/features/seller/hooks/useSellerProducts';
import { useToast } from '@/shared/hooks/use-toast';
import { useSwipeTabs } from '@/shared/hooks/useSwipeTabs';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import { useSellerDashboardData } from '../components/dashboard/hooks/useSellerDashboardData';
import { useSellerOrders } from '../components/dashboard/hooks/useSellerOrders';
import { useSellerSettingsForm } from '../components/dashboard/hooks/useSellerSettingsForm';
import { useSellerWithdrawals } from '../components/dashboard/hooks/useSellerWithdrawals';
import { CreatorsTab } from '../components/dashboard/tabs/CreatorsTab';
import { useSellerCreatorsQuery } from '@/features/seller/hooks/useSellerCreators';
import { OrdersTab } from '../components/dashboard/tabs/OrdersTab';
import { ProductsTab } from '../components/dashboard/tabs/ProductsTab';
import { SettingsTab } from '../components/dashboard/tabs/SettingsTab';
import { WithdrawalsTab } from '../components/dashboard/tabs/WithdrawalsTab';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { NotificationList } from '@/features/notifications/components/NotificationList';
import { SellerDashboardHeader } from '../components/dashboard/widgets/SellerDashboardHeader';
import { SellerDashboardErrorState } from '../components/dashboard/widgets/SellerDashboardState';
import { DashboardSkeleton } from '@/shared/ui/DashboardSkeleton';
import { SellerDashboardTabs } from '../components/dashboard/widgets/SellerDashboardTabs';
import { RequiredBusinessPhotoModal } from '../components/dashboard/widgets/RequiredBusinessPhotoModal';
import { DashboardProfilePanel } from '@/shared/components/DashboardProfilePanel';
import { copyLinkedTextToClipboard, getShopUrl, getShopUsername } from '@/shared/utils/shopLinks';
import { normalizeShopName } from '@/features/seller/utils/sellerRegistrationUtils';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { useSellerProfileQuery } from '@/features/seller/hooks/useSellerProfile';
import { useThemeScope } from '@/shared/hooks/useAppTheme';
import { registerSubNavigation, registerModalDismiss } from '@/shared/utils/modalBackHandler';
import type { SellerDashboardProps, SellerTabId } from '../components/dashboard/types';

// Swipeable nav tabs only — 'settings' is reached via the header profile icon,
// not the bottom nav, so it is not part of the swipe cycle.
const SELLER_TABS_ORDER: readonly SellerTabId[] = [
  'products',
  'orders',
  'withdrawals',
  'creators',
  'notifications',
];

export default function SellerDashboard({ children }: Readonly<SellerDashboardProps>) {
  useThemeScope('seller');
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user: _globalUser, logout, updateProfile, isLoading: isAuthLoading } = useGlobalAuth();
  const sellerProfile = _globalUser?.role === 'seller' ? _globalUser.profile as SellerProfile : null;
  const updateSellerProfile = (updates: Partial<SellerProfile>) => updateProfile(updates, 'seller');

  const { data: liveSellerProfile } = useSellerProfileQuery(!!sellerProfile);
  const { data: creatorDashboardData } = useSellerCreatorsQuery(!!sellerProfile);
  const activeProfile = (liveSellerProfile as unknown as typeof sellerProfile) || sellerProfile;
  const hasBusinessPhoto = Boolean(activeProfile?.avatarUrl);

  const pendingCreatorsCount = creatorDashboardData?.incomingRequests?.length || 0;
  const { unreadCount: unreadNotificationsCount = 0 } = useNotifications('default', true, 'seller');
  const [activeTab, setActiveTab] = useState<SellerTabId>('products');
  const [hasUnreadOrders, setHasUnreadOrders] = useState(false);
  const [lastViewedOrdersTime, setLastViewedOrdersTime] = useState<string | null>(
    localStorage.getItem('seller_last_viewed_orders')
  );
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Hook non-root tab navigation into native Android back stack
  useEffect(() => {
    if (!isNativeApp() || activeTab === 'products') return;

    return registerSubNavigation(() => {
      setActiveTab('products');
      return true;
    });
  }, [activeTab]);

  // Hook add product modal dismiss into native Android back stack
  useEffect(() => {
    if (!isNativeApp() || !isAddProductModalOpen) return;

    return registerModalDismiss(() => {
      setIsAddProductModalOpen(false);
      return true;
    });
  }, [isAddProductModalOpen]);

  useEffect(() => {
    if (!isNativeApp() || !isProfileOpen) return;

    return registerModalDismiss(() => {
      setIsProfileOpen(false);
      return true;
    });
  }, [isProfileOpen]);

  const currentProfile = (liveSellerProfile as unknown as typeof sellerProfile) || sellerProfile;
  const rawShopName = currentProfile?.shopName?.trim();
  const shopName = useMemo(
    () => (rawShopName ? normalizeShopName(rawShopName) : '') || 'Your shop',
    [rawShopName]
  );

  const {
    analytics,
    error,
    fetchData,
    fetchProducts,
    hasFatalError,
    isInitialLoading,
    isLoading,
    products
  } = useSellerDashboardData({
    navigate,
    locationPathname: location.pathname,
    toast,
    enabled: Boolean(sellerProfile)
  });

  const settingsForm = useSellerSettingsForm({
    sellerProfile: sellerProfile as unknown as import("@/shared/types").ApiSeller,
    toast,
    updateSellerProfile
  });

  const withdrawals = useSellerWithdrawals({
    balance: analytics?.balance || 0,
    enabled: activeTab === 'withdrawals',
    toast
  });
  const ordersQuery = useSellerOrders();

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handleCopyShopLink = useCallback(async () => {
    if (!sellerProfile?.shopName) return;

    const canonicalSlug = sellerProfile?.slug || (liveSellerProfile as unknown as typeof sellerProfile)?.slug || sellerProfile?.shopName;
    const shopUrl = getShopUrl(canonicalSlug);
    const shopUsername = getShopUsername(sellerProfile.shopName);
    try {
      const copyMode = await copyLinkedTextToClipboard(shopUsername, shopUrl);
      toast({
        title: 'Shop link copied',
        description: copyMode === 'rich'
          ? `${shopUsername} was copied as linked text.`
          : `${shopUrl} was copied.`,
      });
    } catch {
      // Fallback: notify user if clipboard API fails
      toast({
        title: 'Error',
        description: 'Failed to copy link. Please try again.',
        variant: 'destructive',
      });
    }
  }, [sellerProfile?.shopName, sellerProfile?.slug, liveSellerProfile, toast]);

  const handleSelectTab = useCallback((tab: SellerTabId) => {
    setActiveTab(tab);

    if (tab === 'orders') {
      const now = new Date().toISOString();
      setLastViewedOrdersTime(now);
      localStorage.setItem('seller_last_viewed_orders', now);
      setHasUnreadOrders(false);
    }
  }, []);

  const {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  } = useSwipeTabs({
    tabs: SELLER_TABS_ORDER,
    activeTab,
    onChange: handleSelectTab,
  });

  const deleteProductMutation = useDeleteProductMutation();
  const updateProductMutation = useUpdateProductMutation();

  const handleDeleteProduct = useCallback(async (id: string) => {
    await deleteProductMutation.mutateAsync(id);
  }, [deleteProductMutation]);

  const handleStatusUpdate = useCallback(async (productId: string, newStatus: 'available' | 'sold') => {
    try {
      const isSold = newStatus === 'sold';
      const soldAt = isSold ? new Date().toISOString() : null;

      await updateProductMutation.mutateAsync({
        id: productId,
        updates: {
          status: newStatus,
          soldAt
        }
      });

      toast({
        title: 'Success',
        description: `Product marked as ${newStatus}`,
      });
    } catch (error) {
      console.error('Failed to update product status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update product status',
        variant: 'destructive',
      });
    }
  }, [toast, updateProductMutation]);

  useEffect(() => {
    const orders = ordersQuery.data || [];
    if (orders.length > 0) {
      const latestOrderTime = new Date(orders[0].createdAt).getTime();
      const lastViewed = lastViewedOrdersTime
        ? new Date(lastViewedOrdersTime).getTime()
        : 0;

      setHasUnreadOrders(latestOrderTime > lastViewed);
    } else {
      setHasUnreadOrders(false);
    }
  }, [lastViewedOrdersTime, ordersQuery.data]);

  if (children) {
    return (
      <div className="space-y-6">
        {children({ fetchData })}
      </div>
    );
  }

  if (isAuthLoading || isInitialLoading) {
    return <DashboardSkeleton />;
  }

  if (hasFatalError && !products.length) {
    return <SellerDashboardErrorState error={error} onRetry={fetchData} />;
  }

  return (
    <div className="page-enter dashboard-layout seller-surface min-w-0 overflow-x-hidden flex flex-col bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#ffffff)] transition-colors duration-200" style={{ minHeight: '100dvh', height: '100dvh', overflowY: 'hidden' } as React.CSSProperties}>
      <SellerDashboardHeader shopName={shopName} onOpenProfile={() => setIsProfileOpen(true)} />

      {/* Main Content Area */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          className="h-full overflow-y-auto overflow-x-hidden"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
            overscrollBehavior: 'none',
          }}
        >
          <div
            className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6"
            style={{ paddingBottom: 'calc(5.75rem + var(--sab, env(safe-area-inset-bottom, 0px)))' }}
          >
          {activeTab === 'orders' && <OrdersTab />}

          {activeTab === 'withdrawals' && (
            <WithdrawalsTab
              balance={analytics.availableBalance ?? analytics.balance}
              pendingSettlementBalance={analytics.pendingSettlementBalance}
              withdrawalReservedBalance={analytics.withdrawalReservedBalance}
              refundReservedBalance={analytics.refundReservedBalance}
              nextSettlementAt={analytics.nextSettlementAt}
              {...withdrawals}
            />
          )}

          {activeTab === 'creators' && <CreatorsTab />}

          {activeTab === 'notifications' && (
            <div className="mx-auto w-full max-w-[760px]">
              <NotificationList
                variant="default"
                role="seller"
                scrollClassName=""
                className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-1"
              />
            </div>
          )}

          {activeTab === 'products' && (
            <ProductsTab
              fetchProducts={fetchProducts}
              isAddProductModalOpen={isAddProductModalOpen}
              onDeleteProduct={handleDeleteProduct}
              onStatusUpdate={handleStatusUpdate}
              products={products}
              setIsAddProductModalOpen={setIsAddProductModalOpen}
              sellerProfile={currentProfile}
              shopUsername={getShopUsername(sellerProfile?.shopName)}
              onCopyShopLink={handleCopyShopLink}
              analytics={analytics}
            />
          )}
          </div>
        </div>

        <DashboardProfilePanel
          open={isProfileOpen}
          onOpenChange={setIsProfileOpen}
          title="Profile"
          bottomInset="0px"
          className="seller-surface"
        >
          <div className="px-4 py-4 pb-8">
            <SettingsTab
              sellerProfile={liveSellerProfile && sellerProfile ? { ...sellerProfile, ...liveSellerProfile } : sellerProfile!}
              onLogout={handleLogout}
              onThemeChange={(newTheme) => {
                void updateSellerProfile({ theme: newTheme });
              }}
              {...settingsForm}
            />
          </div>
        </DashboardProfilePanel>
      </div>

      <SellerDashboardTabs
        activeTab={activeTab}
        hasUnreadOrders={hasUnreadOrders}
        pendingCreatorsCount={pendingCreatorsCount}
        unreadNotificationsCount={unreadNotificationsCount}
        onSelectTab={handleSelectTab}
        hidden={isProfileOpen}
      />

      <RequiredBusinessPhotoModal
        open={!hasBusinessPhoto}
        sellerProfile={activeProfile}
        onLogout={handleLogout}
        onPhotoUploaded={(newAvatarUrl) => {
          void updateSellerProfile({ avatarUrl: newAvatarUrl });
        }}
      />
    </div>
  );
}


