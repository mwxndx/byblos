import { Copy, LogOut, Loader2, ExternalLink, AlertCircle } from '@/shared/ui/icons';
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

export function CreatorLinkedShops({ shops, onCopy, onLeave, leavingSellerId, maxPromotions }: Readonly<CreatorLinkedShopsProps>) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-semibold text-white">Your links</h2>
        <span className="rounded-full bg-[#27272c] border border-[#34343a] px-2.5 py-1 text-xs font-medium text-[#a1a1a6]">
          {shops.length} of {maxPromotions} promoting
        </span>
      </div>

      {shops.length === 0 ? (
        <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-5 text-sm text-[#a1a1a6]">
          Accept a shop request to get your first shareable link.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[16px] border border-[#34343a] bg-[#27272c]">
          {shops.map((shop, i) => {
            const isPaused = Boolean(shop.sellerCreatorModeOff || shop.status === 'paused');
            const link = isPaused ? '' : getCreatorShopUrl(shop.slug || shop.shop_name, shop.code);
            const shopUsername = getShopUsername(shop.shop_name);
            const previewLink = `${resolveShareOrigin()}/${shop.slug || shop.shop_name}?view=creator-preview&rate=${Number(shop.commission_rate || 0.01)}`;
            const sellerId = Number(shop.seller_id);
            const isLeaving = leavingSellerId === sellerId;
            const initial = (shop.shop_name || 'S').charAt(0).toUpperCase();

            return (
              <div key={shop.id}>
                {i > 0 && <div className="mx-4 h-px bg-[#34343a]" />}
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#34343a] bg-[#121214] text-white font-semibold">
                      {shop.avatar_url ? (
                        <img src={getImageUrl(shop.avatar_url)} alt={shop.shop_name || 'Shop'} className="h-full w-full object-cover" />
                      ) : (
                        <span>{initial}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate text-sm font-semibold text-white">{shop.shop_name}</p>
                        {isPaused ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#f5c518]/15 border border-[#f5c518]/30 px-2 py-0.5 text-[10px] font-semibold text-[#f5c518]">
                            <AlertCircle className="h-3 w-3" />
                            Creator Mode Paused
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[#30d158]/15 border border-[#30d158]/30 px-2 py-0.5 text-[10px] font-semibold text-[#30d158]">
                            Promoting
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[#a1a1a6]">
                        {Number(shop.commission_rate || 0.01) * 100}% cut · {shop.sales_count || 0} sales · {shop.click_count || 0} clicks · {money(shop.earnings)}
                      </p>
                      {isPaused && (
                        <p className="mt-1 text-xs text-[#f5c518]/90 leading-relaxed">
                          This seller has switched off creator mode. Collaboration link is paused until the seller re-enables it.
                        </p>
                      )}
                      <a
                        href={previewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#f5c518] hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Preview shop (read-only)
                      </a>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isPaused ? (
                      <Button variant="outline" disabled className="h-9 border-[#34343a] text-[#a1a1a6] opacity-50 cursor-not-allowed text-xs">
                        Link paused
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => onCopy(link, shopUsername)}
                        className="h-9 border-[#34343a] bg-[#121214] hover:bg-[#27272c] text-white text-xs"
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copy link
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => onLeave(sellerId)}
                      disabled={isLeaving || !Number.isFinite(sellerId)}
                      className="h-9 border-[#34343a] bg-transparent text-[#ff5a52] hover:bg-red-500/10 text-xs"
                    >
                      {isLeaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="mr-1.5 h-3.5 w-3.5" />Leave</>}
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
