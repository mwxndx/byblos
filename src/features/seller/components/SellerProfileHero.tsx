import { useState } from 'react';
import { Link2, Pencil } from '@/shared/ui/icons';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import { SellerMediaEditDialog } from './SellerMediaEditDialog';

interface SellerProfileHeroProps {
  sellerProfile: SellerProfile;
  shopUsername?: string | null;
  onCopyShopLink?: () => void | Promise<void>;
  canEdit?: boolean;
}

/**
 * Shop identity block for the seller dashboard: the business profile photo in a
 * circular accent frame with a pencil edit overlay, a "Shop link" action, the
 * shop name, and bio — a compact centered stack, no banner card.
 */
export function SellerProfileHero({ sellerProfile, shopUsername, onCopyShopLink, canEdit }: SellerProfileHeroProps) {
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const shopName = sellerProfile?.shopName?.trim() || 'Your shop';
  const avatar = sellerProfile?.avatarUrl;
  const bio = sellerProfile?.bio?.trim();
  const initial = shopName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-center text-center">
      {/* Business profile photo with accent ring + lower-right pencil overlay */}
      <div className="relative">
        <div
          className="h-20 w-20 overflow-hidden rounded-full bg-surface-2 sm:h-24 sm:w-24"
          style={{
            border: '4px solid var(--theme-accent, #f5c518)',
            boxShadow: '0 0 0 4px rgba(var(--theme-accent-rgb, 245, 158, 11), 0.18)'
          }}
        >
          {avatar ? (
            <img src={avatar} alt={shopName} className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-2xl font-semibold sm:text-3xl"
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
            className="absolute bottom-0 right-0 z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--bg)] bg-yellow-400 text-black shadow-sm transition-transform hover:bg-yellow-300 active:scale-95 sm:h-8 sm:w-8"
          >
            <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </button>
        )}
      </div>

      {/* Shop link — centered between the photo and the shop name. */}
      {shopUsername && onCopyShopLink && (
        <button
          type="button"
          onClick={() => onCopyShopLink()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm transition-transform active:scale-95"
          style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
        >
          <Link2 className="h-3.5 w-3.5" />
          Shop link
        </button>
      )}

      {/* Shop name */}
      <h2 className="mt-3 text-center text-xl font-semibold tracking-tight text-label sm:text-2xl [overflow-wrap:anywhere]">
        {shopName}
      </h2>

      {/* Shop bio — sits directly below the shop name. */}
      {bio && (
        <p className="mt-1.5 max-w-md text-center text-xs font-medium leading-5 text-label-2 sm:text-sm [overflow-wrap:anywhere]">
          {bio}
        </p>
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
