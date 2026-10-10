import { useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Heart, Image as ImageIcon, Info, Package, X } from '@/shared/ui/icons';
import { Card } from '@/shared/ui/card';
import type { Product } from '@/shared/types';
import { cn, formatCurrency, getImageUrl } from '@/shared/utils/formatting';
import { getProductCardThemeVars, getProductFlags, type ProductWithApiFields, type Theme } from '@/features/shop/utils/productCardUtils';
import { useWishlist } from '@/features/shop/wishlist/useWishlist';
import { useIsProductWishlisted } from '@/features/shop/wishlist/wishlistStore';

interface ShopProductCardProps {
  product: Product;
  /** Tap the card body — add to bag (shop) or go to the shop with it pre-added (wishlist). */
  onTap: () => void;
  /** Shop context: the product is already in the bag → show the remove (x) control. */
  inBag?: boolean;
  onRemoveFromBag?: () => void;
  /** Wishlist context: a filled heart that removes the item from the wishlist. */
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
  isReadOnly?: boolean;
}

/**
 * Minimal product card (spec §17): image, product name, price, description, and images button.
 * The card surface follows the shop's dark/light theme (--theme-*), but the name, price, and the
 * image/description icons use the app's theme-aware label colour (text-label: near-black in light,
 * near-white in dark) rather than the seller's accent, so they stay readable across shop themes.
 */
export function ShopProductCard({
  product,
  onTap,
  inBag = false,
  onRemoveFromBag,
  isWishlisted,
  onToggleWishlist,
  isReadOnly = false,
}: ShopProductCardProps) {
  const [showDescription, setShowDescription] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const { addToWishlist, removeFromWishlist } = useWishlist();
  const isAutoWishlisted = useIsProductWishlisted(product.id);
  const wishlisted = isWishlisted !== undefined ? isWishlisted : isAutoWishlisted;

  const handleToggleWishlistClick = (e: MouseEvent) => {
    stop(e);
    if (onToggleWishlist) {
      onToggleWishlist();
    } else if (wishlisted) {
      removeFromWishlist(String(product.id));
    } else {
      addToWishlist(product);
    }
  };

  const { isSold } = getProductFlags(product as unknown as ProductWithApiFields);
  const image = product.image_url ? getImageUrl(product.image_url) : null;
  const theme = (product.seller?.theme as Theme) || 'default';
  const themeVars = getProductCardThemeVars(theme);

  // Extract all images array
  const productImages: string[] = [];
  if (product.image_url) {
    productImages.push(getImageUrl(product.image_url));
  }
  if (Array.isArray(product.images)) {
    product.images.forEach((img) => {
      if (typeof img === 'string' && img.trim()) {
        const fullUrl = getImageUrl(img);
        if (!productImages.includes(fullUrl)) productImages.push(fullUrl);
      }
    });
  } else if (typeof product.images === 'string' && product.images.trim()) {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed)) {
        parsed.forEach((img) => {
          if (typeof img === 'string' && img.trim()) {
            const fullUrl = getImageUrl(img);
            if (!productImages.includes(fullUrl)) productImages.push(fullUrl);
          }
        });
      }
    } catch {
      // ignore
    }
  }

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <>
      <Card
        role="button"
        tabIndex={isSold ? -1 : 0}
        aria-label={isSold ? `${product.name} — sold` : isReadOnly ? product.name : `Add ${product.name} to bag`}
        aria-disabled={isSold}
        onClick={isSold ? undefined : onTap}
        onKeyDown={(e) => {
          if (isSold) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); }
        }}
        style={{
          ...themeVars,
          backgroundColor: 'var(--product-card-bg, var(--byblos-surface, #ffffff))',
          color: 'var(--product-card-text, var(--byblos-text, #0f0f0e))',
          borderColor: 'var(--product-card-border, var(--byblos-border, rgba(0, 0, 0, 0.1)))',
        }}
        className={cn(
          'group relative flex h-full flex-col overflow-hidden rounded-xl border transition-all duration-300 sm:rounded-2xl',
          isSold ? 'cursor-not-allowed opacity-70' : 'cursor-pointer sm:hover:-translate-y-1',
          inBag && 'ring-2 ring-[var(--product-card-accent,#f5c518)]',
        )}
      >
        {/* Image — full width, flush to the top. */}
        <div className="relative aspect-square w-full overflow-hidden bg-black/10 select-none">
          {image ? (
            <img src={image} alt={product.name} className="h-full w-full object-cover pointer-events-none" loading="lazy" onContextMenu={(e) => e.preventDefault()} />
          ) : (
            <div className="flex h-full w-full items-center justify-center opacity-40"><Package className="h-8 w-8" /></div>
          )}

          {/* Sleek horizontal watermark banner running across the center */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center py-1 bg-black/21 backdrop-blur-[1px]">
            <p className="w-full text-center text-[10px] sm:text-xs font-normal uppercase tracking-widest text-white/48 drop-shadow-md truncate px-2 select-none">
              @{product.seller?.shopName || product.seller?.fullName || 'Shop'} • Byblos
            </p>
          </div>

          {isSold && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-900">Sold</span>
            </div>
          )}

          {/* Heart button — top right on all products (hidden in creator read-only preview) */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleToggleWishlistClick}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              className={cn(
                'absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition-all duration-200 hover:scale-110 active:scale-95',
                wishlisted
                  ? 'bg-white/95 text-red-500 shadow-md dark:bg-zinc-900/90'
                  : 'bg-white/90 text-slate-400 hover:text-slate-600 dark:bg-black/60 dark:text-zinc-400 dark:hover:text-zinc-200 border border-black/5 dark:border-white/10'
              )}
            >
              <Heart
                className={cn(
                  'h-4 w-4 transition-colors duration-200',
                  wishlisted
                    ? 'fill-red-500 text-red-500'
                    : 'fill-slate-400/20 text-slate-400 dark:text-zinc-400'
                )}
              />
            </button>
          )}

          {inBag && onRemoveFromBag && (
            <button
              type="button"
              onClick={(e) => { stop(e); onRemoveFromBag(); }}
              aria-label={`Remove ${product.name} from bag`}
              className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm backdrop-blur-sm transition hover:scale-110"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Name, price, description & images buttons — theme-aware label colour (black/white by light/dark). */}
        <div className="flex flex-1 flex-col justify-between gap-1 p-2 sm:p-2.5">
          {/* Product name on left, image icon to the right */}
          <div className="flex items-center justify-between gap-1.5">
            <h3
              className="min-w-0 flex-1 truncate text-xs font-normal tracking-tight text-label sm:text-sm"
              title={product.name}
            >
              {product.name}
            </h3>

            <button
              type="button"
              onClick={(e) => { stop(e); setActiveImageIndex(0); setShowImages(true); }}
              aria-label={`View ${product.name} images`}
              className="inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer text-label hover:opacity-75 transition-opacity shrink-0"
            >
              <ImageIcon className="h-4 w-4 sm:h-4.5 sm:w-4.5 shrink-0" />
            </button>
          </div>

          {/* Price on left, description icon on right */}
          <div className="mt-auto flex items-center justify-between gap-1 pt-1">
            <p className="text-sm font-normal tabular-nums text-label sm:text-base">
              {formatCurrency(product.price)}
            </p>

            <button
              type="button"
              onClick={(e) => { stop(e); setShowDescription(true); }}
              aria-label={`View ${product.name} description`}
              className="inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer text-label hover:opacity-75 transition-opacity shrink-0"
            >
              <Info className="h-4 w-4 sm:h-4.5 sm:w-4.5 shrink-0" />
            </button>
          </div>
        </div>
      </Card>

      {/* Description popup (§18) */}
      {showDescription && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${product.name} description`}>
          <button type="button" aria-label="Close description" onClick={() => setShowDescription(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
            style={{
              ...themeVars,
              backgroundColor: 'var(--product-card-bg, var(--byblos-surface, #ffffff))',
              color: 'var(--product-card-text, var(--byblos-text, #0f0f0e))',
              borderColor: 'var(--product-card-border, var(--byblos-border, rgba(0, 0, 0, 0.12)))',
            }}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-base font-normal text-label">{product.name}</h3>
              <button type="button" onClick={() => setShowDescription(false)} aria-label="Close" className="-mr-1 -mt-1 rounded-full p-1.5 opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="max-h-[50vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed opacity-80">
              {product.description?.trim() || 'No description provided for this product.'}
            </p>
          </div>
        </div>
      )}

      {/* Full Image viewer — borderless, clean overlay with only image and close icon */}
      {showImages && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in-0 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} images`}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close image viewer"
            onClick={() => setShowImages(false)}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm cursor-default"
          />

          {/* Close button (top right, safe-area aware) */}
          <button
            type="button"
            onClick={() => setShowImages(false)}
            aria-label="Close"
            className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/90 hover:text-white hover:bg-black/80 transition-colors shadow-lg focus:outline-none"
            style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))' }}
          >
            <X className="h-6 w-6" />
          </button>

          {/* Center full image container (no border, no card background) */}
          <div className="relative z-10 flex h-full max-h-[90vh] w-full max-w-4xl items-center justify-center">
            {productImages.length > 0 ? (
              <img
                src={productImages[activeImageIndex]}
                alt={`${product.name} - image ${activeImageIndex + 1}`}
                className="max-h-[85vh] max-w-[95vw] w-auto h-auto object-contain select-none pointer-events-auto rounded-lg shadow-2xl"
                onContextMenu={(e) => e.preventDefault()}
              />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center text-white/40">
                <Package className="h-16 w-16" />
              </div>
            )}

            {/* Navigation buttons if multiple images */}
            {productImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    setActiveImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1));
                  }}
                  aria-label="Previous image"
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition hover:scale-110 hover:bg-black/80 active:scale-95"
                >
                  <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    setActiveImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
                  }}
                  aria-label="Next image"
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition hover:scale-110 hover:bg-black/80 active:scale-95"
                >
                  <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
                </button>

                {/* Subtle bottom indicator dots */}
                <div
                  className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-2 pointer-events-auto"
                  style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
                >
                  {productImages.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Go to image ${idx + 1}`}
                      onClick={(e) => {
                        stop(e);
                        setActiveImageIndex(idx);
                      }}
                      className={cn(
                        "h-2 rounded-full transition-all duration-200",
                        activeImageIndex === idx
                          ? "w-6 bg-white shadow"
                          : "w-2 bg-white/40 hover:bg-white/70"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ShopProductCard;
