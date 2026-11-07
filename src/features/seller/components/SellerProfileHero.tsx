import { useState } from 'react';
import { Link2, Pencil } from '@/shared/ui/icons';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import { normalizeShopName } from '@/features/seller/utils/sellerRegistrationUtils';
import { SellerMediaEditDialog } from './SellerMediaEditDialog';

interface SellerProfileHeroProps {
  sellerProfile?: SellerProfile | null;
  shopUsername?: string | null;
  onCopyShopLink?: () => void | Promise<void>;
  canEdit?: boolean;
  children?: React.ReactNode;
}

/**
 * Shop identity block for the seller dashboard: the business profile photo in a
 * circular accent frame with a pencil edit overlay, a "Shop link" action, and bio,
 * aligned to the left and pairing with companion metrics on the same line.
 */
export function SellerProfileHero({ sellerProfile, shopUsername, onCopyShopLink, canEdit, children }: Readonly<SellerProfileHeroProps>) {
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const rawShopName = sellerProfile?.shopName?.trim();
  const shopName = (rawShopName ? normalizeShopName(rawShopName) : '') || 'Your shop';
  const avatar = sellerProfile?.avatarUrl;
  const bio = sellerProfile?.bio?.trim();
  const initial = shopName.charAt(0).toUpperCase();

  return (
    <div className={children ? "flex flex-col sm:flex-row items-start gap-3 sm:gap-4 lg:gap-5" : "flex flex-col items-start text-left"}>
      {/* Business profile photo and shop link button aligned to the left */}
      <div className="flex shrink-0 flex-col items-start text-left">
        <div className="relative">
          <div
            className="h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-full bg-surface-2"
            style={{
              border: '3px solid var(--theme-accent, #f5c518)',
              boxShadow: '0 0 0 3px rgba(var(--theme-accent-rgb, 245, 158, 11), 0.18)'
            }}
          >
            {avatar ? (
              <img src={avatar} alt={shopName} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-xl font-semibold sm:text-2xl"
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
              className="absolute bottom-0 right-0 z-20 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border-2 border-[var(--bg)] bg-yellow-400 text-black shadow-sm transition-transform hover:bg-yellow-300 active:scale-95"
            >
              <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
          )}
        </div>

        {/* Shop link button aligned to the left */}
        {shopUsername && onCopyShopLink && (
          <button
            type="button"
            onClick={() => onCopyShopLink()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 sm:px-3.5 sm:py-1.5 text-xs font-semibold shadow-sm transition-transform active:scale-95 shrink-0"
            style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
          >
            <Link2 className="h-3.5 w-3.5" />
            Shop link
          </button>
        )}

        {/* Shop bio — sits below the shop link button aligned to the left */}
        {bio && (
          <p className="mt-1.5 max-w-[200px] sm:max-w-xs text-xs font-medium leading-4 sm:leading-5 text-label-2 [overflow-wrap:anywhere]">
            {bio}
          </p>
        )}
      </div>

      {/* Companion content on the same line (Balance, Sales & Revenue) */}
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
