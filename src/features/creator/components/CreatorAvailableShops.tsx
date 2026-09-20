import { useState } from 'react';
import { Store, ExternalLink, Send, Check, Clock, Loader2, MapPin, Package } from 'lucide-react';
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
            <h2 className="text-base font-semibold text-label">Explore available shops</h2>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] px-2.5 py-0.5 text-xs font-medium text-brand-text">
              Marketplace
            </span>
          </div>
          <p className="mt-0.5 text-xs text-label-3 sm:text-sm">
            Shops currently seeking creators. Preview their products and request to promote them.
          </p>
        </div>

        {shops.length > 0 && (
          <span className="text-xs font-medium text-label-3">
            {shops.length} {shops.length === 1 ? 'shop' : 'shops'} available
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-text" />
        </div>
      ) : shops.length === 0 ? (
        <div className="rounded-card border border-separator bg-surface-1 p-8 text-center">
          <Store className="mx-auto mb-2 h-10 w-10 text-label-3" />
          <p className="text-sm font-medium text-label">No shops currently listed</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-label-3">
            Check back soon. When sellers list their stores in the Creator Marketplace, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => {
            const commissionPercent = (shop.creatorCommissionRate * 100).toFixed(1).replace(/\.0$/, '');
            const previewUrl = `/${shop.slug || shop.shopName}?view=creator-preview&rate=${shop.creatorCommissionRate}`;
            const isRequesting = requestingShopId === shop.id;

            return (
              <div
                key={shop.id}
                className="flex flex-col justify-between rounded-card border border-separator bg-surface-1 p-4 transition-colors hover:border-separator-strong sm:p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {shop.logoUrl ? (
                        <img
                          src={getImageUrl(shop.logoUrl)}
                          alt={shop.shopName}
                          className="h-11 w-11 rounded-control border border-separator object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-control border border-separator bg-fill text-label-3">
                          <Store className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-medium text-label">{shop.shopName}</h3>
                        {shop.location && (
                          <p className="flex items-center gap-1 truncate text-[11px] text-label-3">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {shop.location}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-control bg-[color-mix(in_srgb,var(--sys-green)_14%,transparent)] px-2.5 py-1 text-center">
                      <span className="block text-[10px] font-medium text-sys-green">Commission</span>
                      <span className="block text-sm font-semibold text-sys-green">{commissionPercent}%</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-xs text-label-2">
                    <span className="inline-flex items-center gap-1 rounded-control bg-fill px-2.5 py-1">
                      <Package className="h-3.5 w-3.5" />
                      <strong className="font-medium text-label">{shop.productCount}</strong> products
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-separator pt-3">
                  <Button asChild variant="outline" className="h-9 flex-1 text-xs">
                    <Link to={previewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Preview shop
                    </Link>
                  </Button>

                  {shop.collaborationStatus === 'active' ? (
                    <span className="inline-flex h-9 items-center justify-center gap-1 rounded-control bg-[color-mix(in_srgb,var(--sys-green)_14%,transparent)] px-3 text-xs font-medium text-sys-green">
                      <Check className="h-3.5 w-3.5" />
                      Promoting
                    </span>
                  ) : shop.collaborationStatus === 'pending' ? (
                    <span className="inline-flex h-9 items-center justify-center gap-1 rounded-control bg-[color-mix(in_srgb,var(--sys-orange)_14%,transparent)] px-3 text-xs font-medium text-sys-orange">
                      <Clock className="h-3.5 w-3.5" />
                      Pending
                    </span>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => handleSendRequest(shop)}
                      disabled={isRequesting}
                      className="h-9 px-3.5 text-xs"
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
