import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent } from "@/shared/ui/tabs";
import { Spinner } from "@/shared/ui/spinner";
import { Activity, RefreshCw, Shield, Truck, WalletCards, XCircle } from '@/shared/ui/icons';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { adminApi } from '@/features/admin/api';
import { adminQueryKeys } from '@/features/admin/api/queryKeys';
import RefundRequestsPage from './RefundRequestsPage';
import DetectionsPage from './DetectionsPage';
import { AdminEntityModals } from '../components/AdminEntityModals';
import { AdminDashboardTabs } from '../components/AdminDashboardTabs';
import { AdminOverviewTab } from '../components/AdminOverviewTab';
import { AdminLogisticsTab } from '../components/AdminLogisticsTab';
import { AdminSellersTab } from '../components/AdminSellersTab';
import { AdminCreatorsTab } from '../components/AdminCreatorsTab';
import { AdminBuyersTab } from '../components/AdminBuyersTab';
import { AdminWithdrawalsTab } from '../components/AdminWithdrawalsTab';
import { useAdminDashboard } from '../hooks/useAdminDashboard';

const money = (value: number) => `KSh ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const NewAdminDashboard = () => {
  const navigate = useNavigate();
  const {
    authLoading,
    isAuthenticated,
    isInitialized,
    error,
    retryDashboard,
    dashboardState,
    activeTab,
    setActiveTab,
    sellersList,
    creatorsList,
    buyersList,
    withdrawalsList,
    paginationState,
    safeFormatDate,
    formatProviderBalance,
    providerHealth,
    providerHealthOk,
    providerHealthAvailable,
    pendingPayoutCount,
    pendingPayoutAmount,
    pendingRefundCount,
    pendingDetectionCount,
    openOrderCount,
    inspectionSessionId,
    selectedSeller,
    isLoadingSeller,
    closeSellerModal,
    selectedBuyer,
    isLoadingBuyer,
    closeBuyerModal,
    handleViewSeller,
    handleDeleteUser,
    handleDeleteCreator,
    deletingId,
    handleViewBuyer,
    handleWithdrawalRequestAction,
    processingWithdrawalId,
  } = useAdminDashboard();

  // Logistics problem count for the action row + tab badge. Shares the exact
  // query key the Logistics tab uses (status 'all', sort 'priority'), so the
  // list is fetched once and this reads the same cached summary — no duplicate
  // request and no second copy of the problem-detection SQL.
  const logisticsQuery = useQuery({
    queryKey: adminQueryKeys.logistics('all', 'priority'),
    queryFn: () => adminApi.getLogisticsRequests({ status: 'all', sort: 'priority' }),
    enabled: isAuthenticated && !authLoading,
    staleTime: 20_000,
  });
  const logisticsSummary = logisticsQuery.data?.summary;
  const logisticsProblems = (logisticsSummary?.failed || 0) + (logisticsSummary?.delayed || 0) + (logisticsSummary?.manualReview || 0);

  const analytics = dashboardState.analytics;
  const financials = dashboardState.financialMetrics;

  // Only the queues an admin acts on live here. Vanity metrics moved to the
  // Overview "at a glance" strip so they no longer sit above every tab.
  const attention = [
    { key: 'withdrawals', icon: WalletCards, label: 'Payouts to approve', count: pendingPayoutCount, hint: pendingPayoutCount > 0 ? `${money(pendingPayoutAmount)} waiting` : 'None waiting', tone: 'amber' as const },
    { key: 'refunds', icon: RefreshCw, label: 'Refunds pending', count: pendingRefundCount, hint: pendingRefundCount > 0 ? 'Decide now' : 'None pending', tone: 'red' as const },
    { key: 'detections', icon: Shield, label: 'Detections to review', count: pendingDetectionCount, hint: pendingDetectionCount > 0 ? 'Self-dealing check' : 'None flagged', tone: 'blue' as const },
    { key: 'logistics', icon: Truck, label: 'Logistics problems', count: logisticsProblems, hint: logisticsProblems > 0 ? 'Needs resolution' : 'All clear', tone: 'red' as const },
    { key: null, icon: Activity, label: 'Open paid orders', count: openOrderCount, hint: 'Being fulfilled', tone: 'neutral' as const },
  ];

  const toneClass = (tone: string, active: boolean) => {
    if (!active) return 'border-separator bg-surface-1 text-label-2';
    if (tone === 'amber') return 'border-amber-500/30 bg-amber-500/[0.08] text-amber-300';
    if (tone === 'red') return 'border-red-500/30 bg-red-500/[0.08] text-red-300';
    if (tone === 'blue') return 'border-blue-500/30 bg-blue-500/[0.08] text-blue-300';
    return 'border-separator bg-surface-1 text-label-2';
  };

  const metrics = [
    { label: 'Sales', value: money(financials.totalSales) },
    { label: 'Commission', value: money(financials.totalCommission) },
    { label: 'Refunds paid', value: money(financials.totalRefunds) },
    { label: 'Products', value: Number(analytics.totalProducts || 0).toLocaleString() },
    { label: 'Sellers', value: Number(analytics.totalSellers || 0).toLocaleString() },
    { label: 'Creators', value: Number(analytics.totalCreators || 0).toLocaleString() },
    { label: 'Buyers', value: Number(analytics.totalBuyers || 0).toLocaleString() },
    { label: 'Low stock', value: Number(analytics.lowStockProducts || 0).toLocaleString() },
  ];

  if (authLoading || !isInitialized) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-4 rounded-full border border-separator bg-surface-1 px-6 py-4 shadow-xl">
          <Spinner className="h-12 w-12 text-yellow-500" />
          <p className="text-label-2 font-semibold text-sm animate-pulse">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/admin/login', { replace: true });
    return null;
  }

  if (error) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-[var(--bg)] p-4 text-center sm:p-6">
        <div className="max-w-md space-y-6 rounded-3xl border border-separator bg-surface-1 p-8 shadow-xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-label tracking-tight">Something went wrong</h2>
            <p className="text-label-2 font-medium">{error}</p>
          </div>
          <Button onClick={retryDashboard} className="w-full h-12 bg-yellow-400 text-black font-semibold rounded-2xl hover:bg-yellow-300 transition-all">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] overflow-x-hidden bg-[var(--bg)] text-label font-sans">
      <div className="mx-auto w-full max-w-[1600px] p-3 sm:p-5 md:p-8 space-y-6">
        {/* Slim header — one line, no hero card. */}
        <header className="flex items-center justify-between gap-3 border-b border-separator pb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-label">Admin</h1>
            <span className="text-sm text-label-3">Byblos operations</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-label-2">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <NotificationBell />
          </div>
        </header>

        {/* Needs attention — the admin's action queue, first thing. */}
        <section>
          <p className="mb-2 text-sm font-semibold text-label-2">Needs attention</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {attention.map((tile) => {
              const active = tile.count > 0 && tile.tone !== 'neutral';
              const Icon = tile.icon;
              const clickable = Boolean(tile.key);
              return (
                <button
                  key={tile.label}
                  type="button"
                  disabled={!clickable}
                  onClick={() => tile.key && setActiveTab(tile.key)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${toneClass(tile.tone, active)} ${clickable ? 'hover:border-yellow-500/40 cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold">{tile.label}</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-label">{tile.count.toLocaleString()}</p>
                  <p className="mt-0.5 text-xs text-label-3">{tile.hint}{clickable ? ' →' : ''}</p>
                </button>
              );
            })}
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <AdminDashboardTabs
            counts={{
              withdrawals: pendingPayoutCount,
              refunds: pendingRefundCount,
              detections: pendingDetectionCount,
              logistics: logisticsProblems,
            }}
          />

          <AdminEntityModals
            selectedSeller={selectedSeller as Record<string, unknown> | null}
            isLoadingSeller={isLoadingSeller}
            closeSellerModal={closeSellerModal}
            selectedBuyer={selectedBuyer as Record<string, unknown> | null}
            isLoadingBuyer={isLoadingBuyer}
            closeBuyerModal={closeBuyerModal}
            safeFormatDate={safeFormatDate}
            inspectionSessionId={inspectionSessionId}
          />

          <TabsContent value="overview" className="space-y-6">
            {/* At a glance — business metrics, on Overview only. */}
            <div>
              <p className="mb-2 text-sm font-semibold text-label-2">At a glance</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
                {metrics.map((m) => (
                  <div key={m.label} className="rounded-xl border border-separator bg-surface-1 p-3">
                    <p className="text-[11px] text-label-3">{m.label}</p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-label">{m.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <AdminOverviewTab
              dashboardState={{
                analytics: dashboardState.analytics as unknown as Record<string, unknown>,
                topShops: dashboardState.topShops as Record<string, unknown>[],
                sellers: dashboardState.sellers as unknown as Record<string, unknown>[],
              }}
              safeFormatDate={safeFormatDate}
              onShowSellers={() => setActiveTab('sellers')}
            />
          </TabsContent>

          <TabsContent value="withdrawals" className="space-y-6">
            <AdminWithdrawalsTab
              withdrawalRequests={dashboardState.withdrawalRequests}
              searchQuery={withdrawalsList.search}
              onSearchChange={withdrawalsList.setSearch}
              pagination={paginationState.withdrawalRequests}
              onPageChange={withdrawalsList.setPage}
              activeOrders={dashboardState.analytics.activeOrders}
              pendingPayoutCount={pendingPayoutCount}
              pendingPayoutAmount={pendingPayoutAmount}
              providerHealth={providerHealth}
              providerHealthOk={providerHealthOk}
              providerHealthAvailable={providerHealthAvailable}
              formatProviderBalance={formatProviderBalance}
              formatDate={safeFormatDate}
              onAction={handleWithdrawalRequestAction}
              processingRequestId={processingWithdrawalId}
            />
          </TabsContent>

          <TabsContent value="refunds" className="space-y-6">
            <div className="bg-surface-1 border border-separator rounded-card p-5 md:p-8 shadow-xl">
              <RefundRequestsPage />
            </div>
          </TabsContent>

          <TabsContent value="detections" className="space-y-6">
            <div className="bg-surface-1 border border-separator rounded-card p-5 md:p-8 shadow-xl">
              <DetectionsPage />
            </div>
          </TabsContent>

          <TabsContent value="logistics" className="space-y-6">
            <AdminLogisticsTab />
          </TabsContent>

          <TabsContent value="sellers" className="space-y-6">
            <AdminSellersTab
              sellers={dashboardState.sellers}
              searchQuery={sellersList.search}
              onSearchChange={sellersList.setSearch}
              pagination={paginationState.sellers}
              onPageChange={sellersList.setPage}
              onView={handleViewSeller}
              onDelete={handleDeleteUser}
              deletingId={deletingId}
            />
          </TabsContent>

          <TabsContent value="creators" className="space-y-6">
            <AdminCreatorsTab
              creators={dashboardState.creators}
              searchQuery={creatorsList.search}
              onSearchChange={creatorsList.setSearch}
              pagination={paginationState.creators}
              onPageChange={creatorsList.setPage}
              onDelete={handleDeleteCreator}
              deletingId={deletingId}
              totalCreatorSales={dashboardState.analytics.totalCreatorSales || 0}
              totalCreatorLinkClicks={dashboardState.analytics.totalCreatorLinkClicks || 0}
              totalCreatorEarnings={dashboardState.analytics.totalCreatorEarnings || 0}
            />
          </TabsContent>

          <TabsContent value="buyers" className="space-y-6">
            <AdminBuyersTab
              buyers={dashboardState.buyers}
              searchQuery={buyersList.search}
              onSearchChange={buyersList.setSearch}
              pagination={paginationState.buyers}
              onPageChange={buyersList.setPage}
              onView={handleViewBuyer}
              onDelete={handleDeleteUser}
              deletingId={deletingId}
              formatDate={safeFormatDate}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default NewAdminDashboard;
