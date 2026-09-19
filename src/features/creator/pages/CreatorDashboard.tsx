import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, UserRound } from 'lucide-react';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { AccountSwitcher } from '@/features/auth/components/AccountSwitcher';
import { toast } from 'sonner';
import { useCreatorDashboardQuery } from '@/features/creator/hooks/queries/useCreatorDashboardQuery';
import { useCreatorReferralDashboardQuery } from '@/features/creator/hooks/queries/useCreatorReferralDashboardQuery';
import { useAcceptShopRequestMutation } from '@/features/creator/hooks/mutations/useAcceptShopRequestMutation';
import { useDenyShopRequestMutation } from '@/features/creator/hooks/mutations/useDenyShopRequestMutation';
import { useCreatorLogoutMutation } from '@/features/creator/hooks/mutations/useCreatorAuthMutations';
import { useLeavePromotedShopMutation } from '@/features/creator/hooks/mutations/useLeavePromotedShopMutation';
import { useLeaveInvitedBusinessMutation } from '@/features/creator/hooks/mutations/useLeaveInvitedBusinessMutation';
import { clearRoleSession } from '@/features/auth/services/authSession';
import { Button } from '@/shared/ui/button';
import { copyLinkedTextToClipboard, resolveShareOrigin } from '@/shared/utils/shopLinks';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { registerModalDismiss } from '@/shared/utils/modalBackHandler';
import { useThemeScope } from '@/shared/hooks/useAppTheme';
import { classifyApiError } from '@/shared/utils/errorClassification';
import {
  money,
  MAX_PROMOTED_SHOPS,
  MAX_INVITED_BUSINESSES,
  type AnalysisPeriod
} from '@/features/creator/utils/creatorDashboardUtils';
import { CreatorEarningsHero } from '@/features/creator/components/CreatorEarningsHero';
import { CreatorAnalysisCharts } from '@/features/creator/components/CreatorAnalysisCharts';
import { CreatorLinkedShops } from '@/features/creator/components/CreatorLinkedShops';
import { CreatorAvailableShops } from '@/features/creator/components/CreatorAvailableShops';
import { CreatorProfileSheet } from '@/features/creator/components/CreatorProfileSheet';

type DashboardTab = 'performance' | 'shops';

export default function CreatorDashboard() {
  const navigate = useNavigate();
  useThemeScope('creator');

  const [analysisPeriod, setAnalysisPeriod] = useState<AnalysisPeriod>('monthly');
  const [tab, setTab] = useState<DashboardTab>('performance');
  const [respondingRequestId, setRespondingRequestId] = useState<number | null>(null);
  const [leavingShopSellerId, setLeavingShopSellerId] = useState<number | null>(null);
  const [leavingBusinessSellerId, setLeavingBusinessSellerId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFocusWithdrawals, setSheetFocusWithdrawals] = useState(false);

  const dashboardQuery = useCreatorDashboardQuery(analysisPeriod);
  const referralQuery = useCreatorReferralDashboardQuery();
  const logoutMutation = useCreatorLogoutMutation();
  const acceptRequestMutation = useAcceptShopRequestMutation();
  const denyRequestMutation = useDenyShopRequestMutation();
  const leaveShopMutation = useLeavePromotedShopMutation();
  const leaveBusinessMutation = useLeaveInvitedBusinessMutation();

  const dashboard = dashboardQuery.data || null;
  const referral = referralQuery.data || null;
  const loading = dashboardQuery.isLoading || referralQuery.isLoading;

  // Dismiss the shop-request dialog on Android back.
  useEffect(() => {
    if (!isNativeApp() || respondingRequestId === null) return;
    return registerModalDismiss(() => {
      setRespondingRequestId(null);
      return true;
    });
  }, [respondingRequestId]);

  const copy = async (value: string, label?: string) => {
    if (label) {
      const copyMode = await copyLinkedTextToClipboard(label, value);
      toast.success(copyMode === 'rich' ? 'Copied as linked text.' : 'Copied.');
      return;
    }
    await navigator.clipboard.writeText(value);
    toast.success('Copied.');
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // The local session should still end if the network request fails.
    } finally {
      await clearRoleSession('creator');
      navigate('/creator/login', { replace: true });
    }
  };

  const handleShopRequest = async (inviteId: number, action: 'accept' | 'deny') => {
    setRespondingRequestId(inviteId);
    try {
      if (action === 'accept') {
        await acceptRequestMutation.mutateAsync(inviteId);
        toast.success('Shop request accepted.');
      } else {
        await denyRequestMutation.mutateAsync(inviteId);
        toast.success('Shop request declined.');
      }
    } catch (error: unknown) {
      toast.error(classifyApiError(error, 'Could not update shop request.').message);
    } finally {
      setRespondingRequestId(null);
    }
  };

  const handleLeaveShop = async (sellerId: number) => {
    setLeavingShopSellerId(sellerId);
    try {
      await leaveShopMutation.mutateAsync(sellerId);
      toast.success('You have left this shop.');
    } catch (error: unknown) {
      toast.error(classifyApiError(error, 'Could not leave this shop.').message);
    } finally {
      setLeavingShopSellerId(null);
    }
  };

  const handleLeaveBusiness = async (sellerId: number) => {
    setLeavingBusinessSellerId(sellerId);
    try {
      await leaveBusinessMutation.mutateAsync(sellerId);
      toast.success('You have left this business.');
    } catch (error: unknown) {
      toast.error(classifyApiError(error, 'Could not leave this business.').message);
    } finally {
      setLeavingBusinessSellerId(null);
    }
  };

  const analysis = useMemo(() => dashboard?.analysis || dashboard?.monthly || [], [dashboard?.analysis, dashboard?.monthly]);
  const businessEarnings = useMemo(() => dashboard?.businessEarnings || [], [dashboard?.businessEarnings]);

  if (loading) {
    return (
      <main className="dashboard-layout flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 text-label transition-colors duration-200">
        <div className="flex items-center gap-3 rounded-full border border-separator bg-surface-1 px-5 py-3 shadow-[var(--shadow-card)]">
          <Loader2 className="h-5 w-5 animate-spin text-brand-text" />
          <span className="text-sm font-medium text-label-2">Loading creator dashboard…</span>
        </div>
      </main>
    );
  }

  const creator = dashboard?.creator || {};
  const clearance = dashboard?.clearance;
  const totalBalance = Number(clearance?.totalBalance ?? creator.balance ?? 0);
  const availableBalance = Number(clearance?.availableBalance ?? creator.balance ?? 0);
  const clearingBalance = Number(clearance?.clearingBalance ?? 0);
  const isClearing = Boolean(clearance?.isClearing);
  const nextAvailableAt = clearance?.nextAvailableAt;

  const referralLink = `${resolveShareOrigin()}/seller/register?ref=${referral?.referralCode || ''}`;
  const invitedBusinesses = referral?.referredSellers || [];
  const linkedShops = dashboard?.shops || [];
  const shopRequests = dashboard?.shopRequests || [];

  const latestPeriod = analysis.length ? analysis[analysis.length - 1] : undefined;
  const monthEarnings = Number(latestPeriod?.earnings || 0);
  const monthSales = Number(latestPeriod?.sales || 0);
  const monthClicks = Number(latestPeriod?.clicks || 0);

  const openWithdrawals = () => {
    setSheetFocusWithdrawals(true);
    setSheetOpen(true);
  };
  const openProfile = () => {
    setSheetFocusWithdrawals(false);
    setSheetOpen(true);
  };

  const tabButton = (value: DashboardTab, label: string, badge?: number) => {
    const active = tab === value;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setTab(value)}
        className={`flex flex-1 items-center justify-center gap-2 rounded-[7px] px-4 py-2 text-sm font-medium transition-colors ease-ios ${
          active ? 'bg-surface-1 text-label shadow-sm' : 'text-label-2 hover:text-label'
        }`}
      >
        {label}
        {badge ? (
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-medium text-brand-on">
            {badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <main className="dashboard-layout text-label transition-colors duration-200 bg-[var(--bg)]" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh', height: '100svh', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <header
        className="sticky top-0 z-50 bg-[var(--bg)] px-4 pb-3 sm:px-6 flex items-end justify-between gap-3 transition-colors duration-200"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-label sm:text-3xl">Creator</h1>
          <p className="mt-0.5 text-sm text-label-2">{money(availableBalance)} available</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell triggerClassName="text-label hover:bg-fill" />
          <AccountSwitcher />
          <button
            type="button"
            onClick={openProfile}
            aria-label="Open profile"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-separator bg-fill text-label transition-colors hover:bg-fill-2"
          >
            <UserRound className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="px-4 pt-3 sm:px-6 lg:px-8">
        <div role="tablist" aria-label="Dashboard section" className="flex gap-1 rounded-control bg-fill p-1">
          {tabButton('performance', 'Performance')}
          {tabButton('shops', 'Shops', shopRequests.length)}
        </div>
      </div>

      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {tab === 'performance' ? (
          <>
            <CreatorEarningsHero
              firstName={creator.firstName}
              totalEarnings={Number(creator.totalEarnings || 0)}
              balance={totalBalance}
              availableBalance={availableBalance}
              clearingBalance={clearingBalance}
              nextAvailableAt={nextAvailableAt}
              isClearing={isClearing}
              monthEarnings={monthEarnings}
              monthSales={monthSales}
              monthClicks={monthClicks}
              referralLink={referralLink}
              onCopyLink={() => copy(referralLink)}
              onGoToWithdraw={openWithdrawals}
            />

            <CreatorAnalysisCharts
              analysis={analysis}
              businessEarnings={businessEarnings}
              analysisPeriod={analysisPeriod}
              setAnalysisPeriod={setAnalysisPeriod}
            />

            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-semibold text-label">Invited businesses</h2>
                <span className="rounded-full bg-fill px-2.5 py-1 text-xs font-medium text-label-2">
                  {invitedBusinesses.length} of {MAX_INVITED_BUSINESSES}
                </span>
              </div>
              <p className="px-1 text-xs text-label-3">
                Businesses you invited earn you KSh 3 per sale. Leaving cancels only pending (still-clearing) earnings.
              </p>
              {invitedBusinesses.length === 0 ? (
                <div className="rounded-card border border-separator bg-surface-1 p-4 text-sm text-label-2">
                  Share your referral link (in the earnings card above) to invite up to {MAX_INVITED_BUSINESSES} businesses.
                </div>
              ) : (
                <div className="overflow-hidden rounded-card border border-separator bg-surface-1">
                  {invitedBusinesses.map((biz, i) => {
                    const sid = Number(biz.id);
                    const isLeaving = leavingBusinessSellerId === sid;
                    return (
                      <div key={biz.id}>
                        {i > 0 && <div className="ml-4 h-px bg-separator" />}
                        <div className="flex items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-label">{biz.shop_name || `Business ${biz.id}`}</p>
                            <p className="mt-0.5 text-xs text-label-3">Earned {money(biz.earnings)}</p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => handleLeaveBusiness(sid)}
                            disabled={isLeaving}
                            className="h-9 shrink-0 text-sys-red"
                          >
                            {isLeaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="mr-2 h-4 w-4" />Leave</>}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            {shopRequests.length > 0 && (
              <section className="space-y-2">
                <div className="px-1">
                  <h2 className="text-base font-semibold text-label">Shop requests</h2>
                  <p className="mt-0.5 text-xs text-label-3">Accept a seller request to start earning on that shop.</p>
                </div>
                <div className="overflow-hidden rounded-card border border-separator bg-surface-1">
                  {shopRequests.map((request, i) => (
                    <div key={request.id}>
                      {i > 0 && <div className="ml-4 h-px bg-separator" />}
                      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-label">{request.shop_name}</p>
                          <p className="mt-0.5 text-xs text-label-3">Invited by {request.seller_name || 'seller'}</p>
                        </div>
                        <div className="grid shrink-0 grid-cols-2 gap-2">
                          <Button
                            type="button"
                            onClick={() => handleShopRequest(request.id, 'accept')}
                            disabled={respondingRequestId === request.id}
                            className="h-9"
                          >
                            {respondingRequestId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleShopRequest(request.id, 'deny')}
                            disabled={respondingRequestId === request.id}
                            className="h-9"
                          >
                            Deny
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <CreatorLinkedShops
              shops={linkedShops}
              onCopy={copy}
              onLeave={handleLeaveShop}
              leavingSellerId={leavingShopSellerId}
              maxPromotions={MAX_PROMOTED_SHOPS}
            />

            <CreatorAvailableShops />
          </>
        )}
      </div>

      <CreatorProfileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        creator={creator}
        clearance={clearance}
        withdrawals={dashboard?.withdrawals || []}
        onLogout={handleLogout}
        focusWithdrawals={sheetFocusWithdrawals}
      />
    </main>
  );
}
