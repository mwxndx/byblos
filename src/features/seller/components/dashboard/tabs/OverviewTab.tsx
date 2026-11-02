import { useMemo } from 'react';
import { Copy, Heart, MousePointerClick, Wallet } from '@/shared/ui/icons';
import { formatCurrency } from '@/shared/utils/formatting';
import { IosNotificationBanner } from '@/features/notifications/components/IosNotificationBanner';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import type { AnalyticsData, RecentOrder, SellerTabId } from '../types';

interface OverviewTabProps {
  analytics: AnalyticsData;
  pendingOverviewOrders: RecentOrder[];
  sellerProfile?: SellerProfile | null;
  onSelectTab: (tab: SellerTabId) => void;
  onCopyShopLink?: () => void;
}

export function OverviewTab({
  analytics,
  pendingOverviewOrders,
  sellerProfile,
  onSelectTab,
  onCopyShopLink
}: Readonly<OverviewTabProps>) {
  const recentOrders = (analytics.recentOrders || []).slice(0, 5);

  const balance = analytics.availableBalance ?? analytics.balance;
  const totalSalesCount = analytics.totalSales || 0;
  const revenue = analytics.totalRevenue || 0;
  const clicks = Number(analytics.clickCount || 0);
  const wishlist = Number(analytics.wishlistCount || 0);
  const creatorSales = analytics.creatorGeneratedSales || 0;

  // Formatted activity feed with status indicator dots
  const activityItems = useMemo(() => {
    if (recentOrders.length > 0) {
      return recentOrders.map((order, idx) => {
        const isPaid = order.status === 'paid' || order.status === 'processing';
        const isDelivered = order.status === 'delivered' || order.status === 'completed';
        const dotColor = isPaid ? 'bg-[#f5c518]' : isDelivered ? 'bg-[#30d158]' : 'bg-[#636366]';
        const timeAgo = idx === 0 ? 'Recent' : `${idx + 1}h ago`;

        return {
          id: order.id,
          event: `Order #${order.orderNumber.replace(/^#/, '')} ${order.status}`,
          time: timeAgo,
          dotColor,
        };
      });
    }

    // Default sample activity rows matching Penpot preview when empty
    return [
      { id: 'act-1', event: 'New wishlist save', time: 'Yesterday', dotColor: 'bg-[#636366]' },
      { id: 'act-2', event: 'Shop link shared', time: '2 d ago', dotColor: 'bg-[#636366]' },
    ];
  }, [recentOrders]);

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-6">
      <IosNotificationBanner role="seller" className="mx-0 my-0" />

      {/* ── Shop Live Banner (Matching Penpot) ──────────────────────── */}
      <div className="rounded-[16px] border border-[#34343a] bg-[#121214] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#f5c518] tracking-tight">
              Your shop is live!
            </h2>
            <p className="text-xs sm:text-sm text-[#a1a1a6]">
              Share your link to start getting clicks and sales.
            </p>
          </div>

          {onCopyShopLink && (
            <button
              type="button"
              onClick={onCopyShopLink}
              className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-black transition-all hover:bg-neutral-200 active:scale-95 shrink-0"
            >
              <Copy className="h-4 w-4" />
              Copy shop link
            </button>
          )}
        </div>
      </div>

      {/* ── Available Balance Card (Matching Penpot) ────────────────── */}
      <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-5 sm:p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#a1a1a6]">
          Available balance
        </p>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white tabular-nums">
            {formatCurrency(balance)}
          </p>

          <button
            type="button"
            onClick={() => onSelectTab('withdrawals')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-black transition-all hover:bg-neutral-200 active:scale-95 w-fit"
          >
            <Wallet className="h-4 w-4" />
            Withdraw
          </button>
        </div>
      </div>

      {/* ── Stats 2-Column Grid (Total Sales & Total Revenue) ───────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-4 sm:p-5">
          <p className="text-xs font-medium text-[#a1a1a6]">Total Sales</p>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-white tabular-nums">
            {totalSalesCount}
          </p>
        </div>

        <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-4 sm:p-5">
          <p className="text-xs font-medium text-[#a1a1a6]">Total Revenue</p>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-white tabular-nums">
            {formatCurrency(revenue)}
          </p>
        </div>
      </div>

      {/* ── Shop Activity Card (Clicks & Wishlist) ───────────────────── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Shop activity</h3>
        <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-4 sm:p-5 flex items-center justify-around">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-[#a1a1a6]">
              <MousePointerClick className="h-4 w-4" />
              <span className="text-xs font-medium">Clicks</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums">
              {clicks}
            </p>
          </div>

          <div className="h-8 w-px bg-[#34343a]" />

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-[#a1a1a6]">
              <Heart className="h-4 w-4" />
              <span className="text-xs font-medium">Wishlist</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums">
              {wishlist}
            </p>
          </div>
        </div>

        {/* Creator sales metric */}
        {creatorSales > 0 && (
          <div className="rounded-[14px] border border-[#34343a] bg-[#27272c] p-3.5 flex items-center justify-between text-xs">
            <span className="text-[#a1a1a6]">Creator Sales</span>
            <span className="font-bold text-white">{formatCurrency(creatorSales)} from creator referrals</span>
          </div>
        )}
      </div>

      {/* ── Action Needed Section (Matching Penpot) ─────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {pendingOverviewOrders.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f5c518] text-[10px] font-bold text-black">
              {pendingOverviewOrders.length}
            </span>
          )}
          <h3 className="text-sm font-semibold text-white">Action Needed</h3>
        </div>

        {pendingOverviewOrders.length > 0 ? (
          <div className="space-y-2.5">
            {pendingOverviewOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-[14px] border border-[#34343a] bg-[#121214] p-4 flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    Order #{order.orderNumber.replace(/^#/, '')}
                  </p>
                  <p className="text-xs text-[#a1a1a6] mt-0.5">
                    Paid · needs your action
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectTab('orders')}
                  className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 active:scale-95 transition-all shrink-0"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-[#34343a] bg-[#121214] p-4 text-center">
            <p className="text-xs text-[#a1a1a6]">No paid orders need action right now.</p>
          </div>
        )}
      </div>

      {/* ── Recent Activity Section (Matching Penpot) ───────────────── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
        <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-4 divide-y divide-[#34343a]/60">
          {activityItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-3 first:pt-1 last:pb-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`h-2 w-2 rounded-full shrink-0 ${item.dotColor}`} />
                <span className="text-xs sm:text-sm font-medium text-white truncate">
                  {item.event}
                </span>
              </div>
              <span className="text-[11px] text-[#a1a1a6] shrink-0 ml-3">
                {item.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
