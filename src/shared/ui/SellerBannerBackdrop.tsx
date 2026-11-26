import { useEffect, useState } from 'react';
import { getImageUrl } from '@/shared/utils/formatting';

interface SellerBannerBackdropProps {
  bannerUrl?: string | null;
  alt?: string;
}

/**
 * Full-bleed seller banner backdrop placed behind shop identity/analytics.
 * Starts at the top of its container (bottom of header) and fades out smoothly
 * at the bottom into the page background. Renders nothing when no banner is set.
 */
export function SellerBannerBackdrop({ bannerUrl, alt = 'Shop banner' }: Readonly<SellerBannerBackdropProps>) {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [bannerUrl]);

  const trimmed = bannerUrl?.trim();
  if (!trimmed || loadFailed) {
    return null;
  }

  return (
    <div
      data-testid="seller-banner-backdrop"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      <img
        src={getImageUrl(trimmed, 1200)}
        alt={alt}
        className="h-full w-full object-cover object-center opacity-55 dark:opacity-45"
        onError={() => setLoadFailed(true)}
      />
      {/* Top-to-bottom fade so foreground text stays readable and bottom fades cleanly into --byblos-bg */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, color-mix(in srgb, var(--byblos-bg, #000000) 20%, transparent) 0%, color-mix(in srgb, var(--byblos-bg, #000000) 58%, transparent) 55%, var(--byblos-bg, #000000) 100%)',
        }}
      />
    </div>
  );
}
