import { useState } from 'react';
import { Info, Link2, Pencil, Wallet } from '@/shared/ui/icons';
import { formatCurrency } from '@/shared/utils/formatting';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import { normalizeShopName } from '@/features/seller/utils/sellerRegistrationUtils';
import { SellerMediaEditDialog } from './SellerMediaEditDialog';
import type { SellerTabId } from './dashboard/types';

interface SellerProfileHeroProps {
  sellerProfile?: SellerProfile | null;
  shopUsername?: string | null;
  onCopyShopLink?: () => void | Promise<void>;
  canEdit?: boolean;
  balance?: number;
  revenue?: number;
  totalSales?: number;
  onSelectTab?: (tab: SellerTabId) => void;
  children?: React.ReactNode;
}

/**
 * Shop identity block for the seller dashboard: the business profile photo (no border,
 * sized to match the shop link button) with pencil edit overlay, a "Shop link" action,
 * and the balance, revenue, and sales stats with figures on top and text below.
 */
export function SellerProfileHero({
  sellerProfile,
  shopUsername,
  onCopyShopLink,
  canEdit,
  balance,
  revenue,
  totalSales,
  onSelectTab,
  children
}: Readonly<SellerProfileHeroProps>) {
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const rawShopName = sellerProfile?.shopName?.trim();
  const shopName = (rawShopName ? normalizeShopName(rawShopName) : '') || 'Your shop';
  const avatar = sellerProfile?.avatarUrl;
  const bio = sellerProfile?.bio?.trim();
  const initial = shopName.charAt(0).toUpperCase();

  const hasMetrics = balance !== undefined || revenue !== undefined || totalSales !== undefined;

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 lg:gap-8">
      {/* Business profile photo and shop link button aligned to the left */}
      <div className="flex shrink-0 flex-col items-start text-left">
        <div className="relative">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-surface-2">
            {avatar ? (
              <img src={avatar} alt={shopName} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-2xl font-semibold"
                style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
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
              className="absolute bottom-0 right-0 z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--bg)] bg-yellow-400 text-black shadow-sm transition-transform hover:bg-yellow-300 active:scale-95"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Shop link button aligned to the left with matching width */}
        {shopUsername && onCopyShopLink && (
          <button
            type="button"
            onClick={() => onCopyShopLink()}
            className="mt-2.5 inline-flex w-24 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold shadow-sm transition-transform active:scale-95 shrink-0"
            style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
          >
            <Link2 className="h-3.5 w-3.5" />
            Shop link
          </button>
        )}

        {/* Shop bio — sits below the shop link button aligned to the left */}
        {bio && (
          <p className="mt-2 max-w-[200px] sm:max-w-xs text-xs font-medium leading-4 sm:leading-5 text-label-2 [overflow-wrap:anywhere]">
            {bio}
          </p>
        )}
      </div>

      {/* Balance, Revenue and Sales in the profile photo section (figures on top, text below) */}
      {hasMetrics && (
        <div className="flex flex-1 items-start justify-between sm:justify-start gap-4 sm:gap-8 lg:gap-12 min-w-0 pt-2 sm:pt-3">
          {/* Balance */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-base sm:text-lg lg:text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white truncate">
                {formatCurrency(balance ?? 0)}
              </span>
              {onSelectTab && (
                <button
                  type="button"
                  onClick={() => onSelectTab('withdrawals')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold shadow-sm transition-transform active:scale-95"
                  style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
                >
                  <Wallet className="h-3 w-3" />
                  Withdraw
                </button>
              )}
            </div>
            <span className="mt-0.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-white/60">
              Balance
            </span>
          </div>

          {/* Revenue */}
          <div className="flex flex-col min-w-0">
            <span className="text-base sm:text-lg lg:text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white truncate">
              {formatCurrency(revenue ?? 0)}
            </span>
            <div className="mt-0.5 flex items-center gap-1 text-xs sm:text-sm font-medium text-slate-500 dark:text-white/60">
              <span>Revenue</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Revenue description"
                    title="Revenue description"
                    className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white transition-colors focus:outline-none"
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

          {/* Sales */}
          <div className="flex flex-col min-w-0">
            <span className="text-base sm:text-lg lg:text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white truncate">
              {formatCurrency(totalSales ?? 0)}
            </span>
            <div className="mt-0.5 flex items-center gap-1 text-xs sm:text-sm font-medium text-slate-500 dark:text-white/60">
              <span>Sales</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Sales description"
                    title="Sales description"
                    className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white transition-colors focus:outline-none"
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
