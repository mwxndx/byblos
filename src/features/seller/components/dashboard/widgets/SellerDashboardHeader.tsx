import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { Copy, UserRound } from '@/shared/ui/icons';
import type { SellerProfile } from '@/features/auth/types/authTypes';

interface SellerDashboardHeaderProps {
  sellerFirstName: string;
  sellerProfile?: SellerProfile | null;
  shopUsername?: string;
  shopUrl?: string;
  onCopyShopLink?: () => void;
  onOpenProfile: () => void;
}

export function SellerDashboardHeader({
  sellerFirstName,
  sellerProfile,
  shopUsername,
  shopUrl,
  onCopyShopLink,
  onOpenProfile,
}: Readonly<SellerDashboardHeaderProps>) {
  const shopName = sellerProfile?.shopName?.trim() || `Welcome, ${sellerFirstName}`;
  const initial = (sellerProfile?.shopName?.trim() || sellerFirstName || 'S').charAt(0).toUpperCase();
  const displayUrl = shopUsername
    ? `byblosafrica.site/${shopUsername.replace(/^@/, '')}`
    : shopUrl || 'byblosafrica.site/shop';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#27272c] bg-[#121214] px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3">
        {/* Shop identity matching Penpot Top bar */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#db2777] text-sm font-bold text-white shadow-sm sm:h-10 sm:w-10">
            {sellerProfile?.avatarUrl ? (
              <img src={sellerProfile.avatarUrl} alt={shopName} className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
              {shopName}
            </h1>
            {onCopyShopLink && (
              <button
                type="button"
                onClick={onCopyShopLink}
                className="group flex items-center gap-1.5 text-[11px] text-[#a1a1a6] hover:text-white transition-colors"
                title="Click to copy shop link"
              >
                <Copy className="h-3 w-3 shrink-0 text-[#a1a1a6] group-hover:text-white" />
                <span className="truncate max-w-[160px] sm:max-w-[240px]">{displayUrl}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right controls: Notifications bell + Profile trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#27272c] border border-[#34343a] sm:h-10 sm:w-10">
            <NotificationBell role="seller" />
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="Open profile"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#34343a] bg-[#27272c] text-white transition-colors hover:bg-[#34343a] sm:h-10 sm:w-10"
          >
            <UserRound className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
