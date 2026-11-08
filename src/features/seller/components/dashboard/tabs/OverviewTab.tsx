import { useState } from 'react';
import { ArrowUpRight, Heart, Megaphone, MousePointerClick, Package, PackagePlus } from '@/shared/ui/icons';
import { formatCurrency } from '@/shared/utils/formatting';
import { SellerReminders } from '../widgets/SellerReminders';
import { SellerProfileHero } from '../../SellerProfileHero';
import { IosNotificationBanner } from '@/features/notifications/components/IosNotificationBanner';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import type { AnalyticsData, RecentOrder, SellerTabId } from '../types';

interface OverviewTabProps {
  analytics: AnalyticsData;
  pendingOverviewOrders?: RecentOrder[];
  sellerProfile?: SellerProfile | null;
  shopUsername?: string | null;
  onCopyShopLink?: () => void | Promise<void>;
  onSelectTab: (tab: SellerTabId) => void;
}

export function OverviewTab({ analytics, sellerProfile, shopUsername, onCopyShopLink, onSelectTab }: Readonly<OverviewTabProps>) {
  const balance = analytics.availableBalance ?? analytics.balance;
  const totalSales = analytics.totalSales || 0;
  const revenue = analytics.totalRevenue || 0;
  const clicks = Number(analytics.clickCount || 0);
  const wishlist = Number(analytics.wishlistCount || 0);
  const liveProducts = Number(analytics.totalProducts || 0);
  const creatorSales = analytics.creatorGeneratedSales || 0;

  // "Nothing yet" — a brand-new shop with no numbers to show.
  const hasActivity = revenue > 0 || balance > 0 || liveProducts > 0 || clicks > 0 || wishlist > 0;
  const [showMetrics, setShowMetrics] = useState(false);

  const secondaryStatsBlock = (
    <div className="space-y-3 sm:space-y-4">
      {/* Shop activity — lighter-weight secondary stats. */}
      <div>
        <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/40">Shop activity</p>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {[
            { label: 'Clicks', value: clicks.toLocaleString(), icon: MousePointerClick },
            { label: 'Wishlist', value: wishlist.toLocaleString(), icon: Heart },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-transparent bg-slate-100 dark:bg-white/[0.02] px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-white/45">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
              </div>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status chips — Live products is a state, not a KPI. Creator sales
          only appears once there is something to show. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 dark:bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-slate-500 dark:text-white/80">
          <Package className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
          {liveProducts.toLocaleString()} live {liveProducts === 1 ? 'product' : 'products'}
        </span>
        {creatorSales > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-slate-100 dark:bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:text-white/80">
            <Megaphone className="h-3 w-3" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            {formatCurrency(creatorSales)} creator sales
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Profile photo section: left-aligned photo & button, with balance, sales & revenue stats */}
      <SellerProfileHero
        sellerProfile={sellerProfile}
        shopUsername={shopUsername}
        onCopyShopLink={onCopyShopLink}
        canEdit
        balance={balance}
        revenue={revenue}
        totalSales={totalSales}
      />

      <IosNotificationBanner role="seller" className="mx-0 my-0" />

      <SellerReminders sellerProfile={sellerProfile} totalProducts={liveProducts} onSelectTab={onSelectTab} />

      {hasActivity ? (
        secondaryStatsBlock
      ) : (
        <>
          <div className="rounded-2xl border border-transparent bg-slate-100 dark:bg-white/[0.03] p-6 text-center sm:p-8">
            <span
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.16)' }}
            >
              <PackagePlus className="h-6 w-6" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            </span>
            <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white sm:text-lg">Add your first product to start getting clicks</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-white/60 sm:text-sm">
              Once buyers start engaging, your balance, revenue and activity will show up right here.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => { onSelectTab('products'); }}
                className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition-transform active:scale-95"
                style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
              >
                <PackagePlus className="h-4 w-4" />
                Add a product
              </button>
              <button
                type="button"
                onClick={() => { setShowMetrics((v) => !v); }}
                className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-white/70 transition-colors hover:bg-white/10 hover:text-slate-900 dark:text-white sm:text-sm"
              >
                {showMetrics ? 'Hide metrics' : 'Show metrics'}
                <ArrowUpRight className={`h-3.5 w-3.5 transition-transform ${showMetrics ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>
          {showMetrics && secondaryStatsBlock}
        </>
      )}
    </div>
  );
}
