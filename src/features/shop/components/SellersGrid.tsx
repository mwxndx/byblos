import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { ApiPublicSeller } from '@/shared/types/api/seller';
import SellerBrandCard from '@/features/shop/components/SellerBrandCard';
import { Skeleton } from '@/shared/ui/skeleton';
import { usePublicSellersQuery, usePublicCatalogProductsQuery } from '@/features/shop/hooks/useShopQueries';
import { isDeletedSeller } from '@/features/shop/utils/sellerTransforms';
import { compareSellersByPriority } from '@/features/shop/utils/shopPrioritization';

interface SellersGridProps {
    filterCity: string;
    filterArea: string;
    searchQuery: string;
    isBuyer?: boolean;
}

const INITIAL_VISIBLE_SELLERS = 24;

const SellerGridSkeleton = () => (
    <div role="status" aria-busy="true" aria-live="polite" className="grid grid-cols-2 gap-2.5 sm:gap-3.5 w-full max-w-[760px] mx-auto">
        <span className="sr-only">Loading shops…</span>
        {Array.from({ length: 6 }).map((_, index) => (
            <div
                key={index}
                aria-hidden="true"
                className="flex flex-col justify-between aspect-square w-full rounded-[48px] border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0a0a0a] p-3.5 sm:p-4 shadow-sm transition-colors duration-200"
            >
                <div className="flex items-start justify-between w-full">
                    <Skeleton className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-xl aspect-square" />
                    <Skeleton className="h-4 w-4 rounded" />
                </div>
                <div className="flex flex-col items-start gap-2 w-full">
                    <Skeleton className="h-4 w-24 sm:w-28 rounded-md" />
                    <div className="flex items-center gap-1.5">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-6 w-6 rounded-full" />
                    </div>
                </div>
            </div>
        ))}
    </div>
);

const EMPTY_SELLERS: ApiPublicSeller[] = [];

const SellersGrid = ({ filterCity, filterArea, searchQuery, isBuyer }: SellersGridProps) => {
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_SELLERS);
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const sellersQuery = usePublicSellersQuery({ page: 1, limit: 100 });
    const sellers = sellersQuery?.data?.sellers || EMPTY_SELLERS;
    const loading = Boolean(sellersQuery?.isLoading);

    const isSearchActive = Boolean(deferredSearchQuery.trim());
    const productsQuery = usePublicCatalogProductsQuery(isSearchActive);

    useEffect(() => {
        setVisibleCount(INITIAL_VISIBLE_SELLERS);
    }, [filterCity, filterArea, deferredSearchQuery]);

    const filteredSellers = useMemo(() => {
        const query = deferredSearchQuery.trim().toLowerCase();

        const matchingSellerIdsFromProducts = new Set<string>();
        if (query && productsQuery.data) {
            for (const product of productsQuery.data) {
                const name = (product.name || '').toLowerCase();
                const desc = (product.description || '').toLowerCase();
                if (name.includes(query) || desc.includes(query)) {
                    if (product.sellerId) matchingSellerIdsFromProducts.add(String(product.sellerId));
                    if (product.seller?.id) matchingSellerIdsFromProducts.add(String(product.seller.id));
                }
            }
        }

        const filtered = sellers.filter(seller => {
            if (isDeletedSeller(seller)) return false;
            if (filterCity && seller.city !== filterCity) return false;
            if (filterArea && seller.location !== filterArea) return false;
            if (query) {
                const matchesShop =
                    (seller.shopName || seller.shop_name || '').toLowerCase().includes(query) ||
                    (seller.fullName || '').toLowerCase().includes(query);
                const matchesProduct = matchingSellerIdsFromProducts.has(String(seller.id));
                return matchesShop || matchesProduct;
            }
            return true;
        });

        return [...filtered].sort(compareSellersByPriority);
    }, [sellers, filterCity, filterArea, deferredSearchQuery, productsQuery.data]);

    const visibleSellers = useMemo(
        () => filteredSellers.slice(0, visibleCount),
        [filteredSellers, visibleCount]
    );

    if (loading) {
        return <SellerGridSkeleton />;
    }

    if (filteredSellers.length === 0) {
        return <div className="text-stone-500 text-center py-10">No shops found matching your criteria.</div>;
    }

    return (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 w-full max-w-[760px] mx-auto">
            {visibleSellers.map((seller) => (
                <SellerBrandCard key={seller.id} seller={seller} isBuyer={isBuyer} />
            ))}
        </div>
    );
};

export default memo(SellersGrid);
