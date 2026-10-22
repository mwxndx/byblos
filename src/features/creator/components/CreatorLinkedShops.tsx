import { Copy, LogOut, Loader2, Store, ExternalLink, AlertCircle } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import { getCreatorShopUrl, getShopUsername, resolveShareOrigin } from '@/shared/utils/shopLinks';
import { getImageUrl } from '@/shared/utils/formatting';
import { money, type LinkedShop } from '@/features/creator/utils/creatorDashboardUtils';

interface CreatorLinkedShopsProps {
  shops: LinkedShop[];
  onCopy: (link: string, label?: string) => void;
  onLeave: (sellerId: number) => void;
  leavingSellerId: number | null;
  maxPromotions: number;
}

export function CreatorLinkedShops({ shops, onCopy, onLeave, leavingSellerId, maxPromotions }: CreatorLinkedShopsProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-semibold text-label">Your links</h2>
        <span className="rounded-full bg-fill px-2.5 py-1 text-xs font-medium text-label-2">
          {shops.length} of {maxPromotions} promoting
        </span>
      </div>

      {shops.length === 0 ? (
        <div className="rounded-card border border-separator bg-surface-1 p-4 text-sm text-label-2">
          Accept a shop request to get your first shareable link.
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-separator bg-surface-1">
          {shops.map((shop, i) => {
            const isPaused = Boolean(shop.sellerCreatorModeOff || shop.status === 'paused');
            const link = isPaused ? '' : getCreatorShopUrl(shop.slug || shop.shop_name, shop.code);
            const shopUsername = getShopUsername(shop.shop_name);
            // Read-only preview: the shop opens in creator-preview mode, which
            // hides add-to-bag and wishlist so the creator can't act on their own
            // shop. The shareable tracking link (for shoppers) stays on Copy link.
            const previewLink = `${resolveShareOrigin()}/${shop.slug || shop.shop_name}?view=creator-preview&rate=${Number(shop.commission_rate || 0.01)}`;
            const sellerId = Number(shop.seller_id);
            const isLeaving = leavingSellerId === sellerId;
            return (
              <div key={shop.id}>
                {i > 0 && <div className="ml-4 h-px bg-separator" />}
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-control border border-separator bg-fill">
                      {shop.avatar_url ? (
                        <img src={getImageUrl(shop.avatar_url)} alt={shop.shop_name || 'Shop'} className="h-full w-full object-cover" />
                      ) : (
                        <Store className="h-5 w-5 text-label-3" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate text-sm font-medium text-label">{shop.shop_name}</p>
                        {isPaused && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            <AlertCircle className="h-3 w-3" />
                            Creator Mode Paused
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-label-3">
                        {Number(shop.commission_rate || 0.01) * 100}% cut · {shop.sales_count || 0} sales · {shop.click_count || 0} clicks · {money(shop.earnings)}
                      </p>
                      {isPaused && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                          This seller has switched off creator mode. Collaboration link is paused until the seller re-enables it.
                        </p>
                      )}
                      <a
                        href={previewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-text"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Preview shop (read-only)
                      </a>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isPaused ? (
                      <Button variant="outline" disabled className="h-9 opacity-50 cursor-not-allowed text-xs">
                        Link paused
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => onCopy(link, shopUsername)} className="h-9 text-xs">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy link
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => onLeave(sellerId)}
                      disabled={isLeaving || !Number.isFinite(sellerId)}
                      className="h-9 text-sys-red"
                    >
                      {isLeaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="mr-2 h-4 w-4" />Leave</>}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
