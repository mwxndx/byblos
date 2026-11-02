import { useState } from 'react';
import { Store, ExternalLink, Send, Check, Clock, Loader2, MapPin, Package, X } from '@/shared/ui/icons';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { getImageUrl } from '@/shared/utils/formatting';
import { useAvailableShopsQuery } from '../hooks/queries/useAvailableShopsQuery';
import { useRequestCollaborationMutation } from '../hooks/mutations/useRequestCollaborationMutation';
import { classifyApiError } from '@/shared/utils/errorClassification';
import type { AvailableShop } from '../api/marketplace';

export function CreatorAvailableShops() {
  const { data: shops = [], isLoading, refetch } = useAvailableShopsQuery();
  const requestMutation = useRequestCollaborationMutation();
  const [requestingShopId, setRequestingShopId] = useState<number | null>(null);

  const handleSendRequest = async (shop: AvailableShop) => {
    setRequestingShopId(shop.id);
    try {
      await requestMutation.mutateAsync({ sellerId: shop.id });
      toast.success(`Collaboration request sent to ${shop.shopName}!`);
      refetch();
    } catch (err: unknown) {
      toast.error(classifyApiError(err, 'Could not send request.').message);
    } finally {
      setRequestingShopId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Explore available shops</h2>
            <span className="rounded-full bg-[#f5c518]/15 border border-[#f5c518]/30 px-2.5 py-0.5 text-xs font-semibold text-[#f5c518]">
              Marketplace
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#a1a1a6] sm:text-sm">
            Shops currently seeking creators. Preview their products and request to promote them.
          </p>
        </div>

        {shops.length > 0 && (
          <span className="text-xs font-medium text-[#a1a1a6]">
            {shops.length} {shops.length === 1 ? 'shop' : 'shops'} available
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center rounded-[16px] border border-[#34343a] bg-[#27272c] text-[#a1a1a6]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#f5c518]" />
          Loading marketplace shops…
        </div>
      ) : shops.length === 0 ? (
        <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-6 text-center">
          <Store className="mx-auto h-8 w-8 text-[#a1a1a6]" />
          <h3 className="mt-2 text-sm font-semibold text-white">No shops currently open for requests</h3>
          <p className="mt-1 text-xs text-[#a1a1a6]">
            Check back soon or invite store owners directly using your seller referral link.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => {
            const commissionPercent = (shop.creatorCommissionRate * 100).toFixed(1).replace(/\.0$/, '');
            const previewUrl = `/${shop.slug || shop.shopName}?view=creator-preview&rate=${shop.creatorCommissionRate}`;
            const isRequesting = requestingShopId === shop.id;
            const initial = (shop.shopName || 'S').charAt(0).toUpperCase();

            return (
              <div
                key={shop.id}
                className="flex flex-col justify-between rounded-[16px] border border-[#34343a] bg-[#27272c] p-4 transition-all hover:border-[#4a4a52] sm:p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {shop.logoUrl ? (
                        <img
                          src={getImageUrl(shop.logoUrl)}
                          alt={shop.shopName}
                          className="h-11 w-11 rounded-xl border border-[#34343a] object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#34343a] bg-[#121214] text-white font-semibold">
                          <span>{initial}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-white">{shop.shopName}</h3>
                        {shop.location && (
                          <p className="flex items-center gap-1 truncate text-[11px] text-[#a1a1a6]">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {shop.location}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-xl bg-[#30d158]/15 border border-[#30d158]/30 px-2.5 py-1 text-center">
                      <span className="block text-[10px] font-medium text-[#30d158]">Commission</span>
                      <span className="block text-sm font-bold text-[#30d158]">{commissionPercent}%</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-xs text-[#a1a1a6]">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#121214] border border-[#34343a] px-2.5 py-1">
                      <Package className="h-3.5 w-3.5" />
                      <strong className="font-semibold text-white">{shop.productCount}</strong> products
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-[#34343a] pt-3">
                  <Button asChild variant="outline" className="h-9 flex-1 border-[#34343a] bg-[#121214] hover:bg-[#27272c] text-white text-xs">
                    <Link to={previewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Preview shop
                    </Link>
                  </Button>

                  {shop.collaborationStatus === 'active' ? (
                    <span className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-[#30d158]/15 border border-[#30d158]/30 px-3 text-xs font-semibold text-[#30d158]">
                      <Check className="h-3.5 w-3.5" />
                      Promoting
                    </span>
                  ) : shop.collaborationStatus === 'pending' ? (
                    <span className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-[#f5c518]/15 border border-[#f5c518]/30 px-3 text-xs font-semibold text-[#f5c518]">
                      <Clock className="h-3.5 w-3.5" />
                      Pending
                    </span>
                  ) : shop.collaborationStatus === 'denied' ? (
                    <span className="inline-flex h-9 items-center justify-center gap-1 rounded-control bg-slate-100 dark:bg-white/10 px-3 text-xs font-medium text-slate-500 dark:text-white/50 cursor-not-allowed">
                      <X className="h-3.5 w-3.5" />
                      Declined
                    </span>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => handleSendRequest(shop)}
                      disabled={isRequesting}
                      className="h-9 px-3.5 text-xs bg-white hover:bg-neutral-100 text-black font-semibold rounded-lg"
                    >
                      {isRequesting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          Request
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
