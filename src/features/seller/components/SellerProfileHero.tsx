import { useState } from 'react';
import { Heart, Info, Link2, MousePointerClick, Pencil } from '@/shared/ui/icons';
import { formatCurrency, formatCompactCurrency } from '@/shared/utils/formatting';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import { normalizeShopName } from '@/features/seller/utils/sellerRegistrationUtils';
import { SellerMediaEditDialog } from './SellerMediaEditDialog';

interface SellerProfileHeroProps {
  sellerProfile?: SellerProfile | null;
  shopUsername?: string | null;
  onCopyShopLink?: () => void | Promise<void>;
  canEdit?: boolean;
  balance?: number;
  revenue?: number;
  totalSales?: number;
  clicks?: number;
  wishlist?: number;
  children?: React.ReactNode;
}

/**
 * Shop identity block for the seller dashboard: the business profile photo (no border,
 * sized to match the shop link button) with pencil edit overlay, a "Shop link" action,
 * and stats aligned to the right: Sales (with Clicks below), Revenue (with Wishlist below),
 * and Balance, with compact currency notation (1k, 10k, 130.1k) and click-to-expand full figures.
 */
export function SellerProfileHero({
  sellerProfile,
  shopUsername,
  onCopyShopLink,
  canEdit,
  balance,
  revenue,
  totalSales,
  clicks,
  wishlist,
  children
}: Readonly<SellerProfileHeroProps>) {
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const [expandedMetrics, setExpandedMetrics] = useState<Record<string, boolean>>({});

  const toggleMetric = (key: 'balance' | 'sales' | 'revenue') => {
    setExpandedMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const rawShopName = sellerProfile?.shopName?.trim();
  const shopName = (rawShopName ? normalizeShopName(rawShopName) : '') || 'Your shop';
  const avatar = sellerProfile?.avatarUrl;
  const bio = sellerProfile?.bio?.trim();
  const initial = shopName.charAt(0).toUpperCase();

  const hasMetrics = balance !== undefined || revenue !== undefined || totalSales !== undefined || clicks !== undefined || wishlist !== undefined;

  const renderMetricValue = (key: 'balance' | 'sales' | 'revenue', value: number | undefined) => {
    const val = value ?? 0;
    const isExpanded = expandedMetrics[key];
    const displayVal = isExpanded ? formatCurrency(val) : formatCompactCurrency(val);
    const isCompactable = Math.abs(val) >= 1000;

    return (
      <button
        type="button"
        onClick={() => toggleMetric(key)}
        className="text-left text-sm min-[380px]:text-base sm:text-lg lg:text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white truncate transition-transform active:scale-95 focus:outline-none focus-visible:ring-1 focus-visible:ring-yellow-400 rounded cursor-pointer"
        title={isCompactable ? (isExpanded ? 'Click to show compact' : 'Click to show full amount') : undefined}
        aria-label={`${key}: ${formatCurrency(val)}`}
      >
        {displayVal}
      </button>
    );
  };

  return (
    <div className="flex flex-row items-start md:items-center gap-5 min-[380px]:gap-6 sm:gap-8 md:gap-8 lg:gap-10 w-full md:w-auto">
      {/* Business profile photo and shop link button aligned to the left */}
      <div className="flex shrink-0 flex-col items-start text-left md:contents">
        <div className="relative md:order-1 shrink-0">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-surface-2">
            {avatar ? (
              <img src={avatar} alt={shopName} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-2xl font-semibold bg-white text-black dark:bg-white dark:text-black [data-theme=light]_&:bg-black [data-theme=light]_&:text-white"
              >
                {initial}
              </div>
            )}
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsEditingMedia(true)}
              aria-label="Edit profile photo"
              title="Edit profile photo"
              className="btn-standard absolute bottom-0 right-0 z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--bg)] bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90 [data-theme=light]_&:bg-black [data-theme=light]_&:text-white [data-theme=light]_&:hover:bg-black/90 shadow-sm transition-transform active:scale-95"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Shop link button: below avatar on mobile, part of the center row on desktop */}
        {shopUsername && onCopyShopLink && (
          <div className="mt-2.5 md:mt-0 flex shrink-0 md:order-7">
            <button
              type="button"
              onClick={() => onCopyShopLink()}
              className="btn-standard inline-flex w-24 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold shadow-sm transition-transform active:scale-95 shrink-0 bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90 [data-theme=light]_&:bg-black [data-theme=light]_&:text-white [data-theme=light]_&:hover:bg-black/90"
            >
              <Link2 className="h-3.5 w-3.5" />
              Shop link
            </button>
          </div>
        )}

        {/* Shop bio */}
        {bio && (
          <p className="mt-2 max-w-[120px] sm:max-w-xs text-xs font-medium leading-4 sm:leading-5 text-label-2 [overflow-wrap:anywhere] md:hidden">
            {bio}
          </p>
        )}
      </div>

      {/* Metrics container on the right of the photo on mobile; dissolved into parent center row on desktop */}
      {hasMetrics && (
        <div className="flex flex-1 md:contents flex-col min-w-0 pt-1.5 sm:pt-2">
          {/* Mobile grid: 3 cols (Sales, Revenue, Balance on row 1; Clicks, Wishlist on row 2). Desktop: dissolved into parent flex center row */}
          <div className="grid grid-cols-3 md:contents gap-x-4 min-[380px]:gap-x-5 sm:gap-x-8 lg:gap-x-10 gap-y-2.5 sm:gap-y-3 min-w-0">
            {/* Sales */}
            <div className="col-start-1 row-start-1 md:order-2 flex flex-col min-w-0 shrink-0">
              {renderMetricValue('sales', totalSales)}
              <div className="mt-0.5 flex items-center gap-1 text-[11px] min-[380px]:text-xs sm:text-sm font-medium text-slate-500 dark:text-white/60">
                <span>Sales</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Sales description"
                      title="Sales description"
                      className="flex h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white transition-colors focus:outline-none"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="center" className="w-60 p-3 text-xs leading-relaxed text-slate-700 dark:text-white/80">
                    Total product price value (excludes 2% customer service charge).
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Revenue */}
            <div className="col-start-2 row-start-1 md:order-3 flex flex-col min-w-0 shrink-0">
              {renderMetricValue('revenue', revenue)}
              <div className="mt-0.5 flex items-center gap-1 text-[11px] min-[380px]:text-xs sm:text-sm font-medium text-slate-500 dark:text-white/60">
                <span>Revenue</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Revenue description"
                      title="Revenue description"
                      className="flex h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white transition-colors focus:outline-none"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="center" className="w-60 p-3 text-xs leading-relaxed text-slate-700 dark:text-white/80">
                    Net earnings after KSh 10 platform fee per sale.
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Balance */}
            <div className="col-start-3 row-start-1 md:order-4 flex flex-col min-w-0 shrink-0">
              {renderMetricValue('balance', balance)}
              <span className="mt-0.5 text-[11px] min-[380px]:text-xs sm:text-sm font-medium text-slate-500 dark:text-white/60">
                Balance
              </span>
            </div>

            {/* Clicks count: below Sales on mobile, beside metrics on desktop */}
            {clicks !== undefined && (
              <div
                className="col-start-1 row-start-2 md:order-5 flex items-center md:flex-col md:items-start gap-1.5 md:gap-0.5 text-xs text-slate-500 dark:text-white/60 shrink-0"
                title={`${(clicks ?? 0).toLocaleString()} clicks on your shop & products`}
              >
                <div className="flex items-center gap-1.5 font-bold tabular-nums text-slate-900 dark:text-white text-xs min-[380px]:text-sm sm:text-base lg:text-lg">
                  <MousePointerClick className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 dark:text-white/45" />
                  <span>{(clicks ?? 0).toLocaleString()}</span>
                </div>
                <span className="text-[11px] min-[380px]:text-xs sm:text-sm font-medium text-slate-500 dark:text-white/60">
                  {(clicks ?? 0) === 1 ? 'click' : 'clicks'}
                </span>
              </div>
            )}

            {/* Wishlist count: below Revenue on mobile, beside metrics on desktop */}
            {wishlist !== undefined && (
              <div
                className="col-start-2 row-start-2 md:order-6 flex items-center md:flex-col md:items-start gap-1.5 md:gap-0.5 text-xs text-slate-500 dark:text-white/60 shrink-0"
                title={`${(wishlist ?? 0).toLocaleString()} items saved by buyers`}
              >
                <div className="flex items-center gap-1.5 font-bold tabular-nums text-slate-900 dark:text-white text-xs min-[380px]:text-sm sm:text-base lg:text-lg">
                  <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 dark:text-white/45" />
                  <span>{(wishlist ?? 0).toLocaleString()}</span>
                </div>
                <span className="text-[11px] min-[380px]:text-xs sm:text-sm font-medium text-slate-500 dark:text-white/60">
                  wishlist
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {children && (
        <div className="min-w-0 flex-1 w-full">
          {children}
        </div>
      )}

      {canEdit && (
        <SellerMediaEditDialog
          open={isEditingMedia}
          onOpenChange={setIsEditingMedia}
          avatarUrl={avatar}
          fallbackInitial={initial}
        />
      )}
    </div>
  );
}
