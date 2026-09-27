import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { ApiPublicSeller } from '@/shared/types/api/seller';
import SellerBrandCard from '@/features/shop/components/SellerBrandCard';
import { Skeleton } from '@/shared/ui/skeleton';
import { usePublicSellersQuery } from '@/features/shop/hooks/useShopQueries';

interface SellersGridProps {
    filterCity: string;
    filterArea: string;
    searchQuery: string;
    isBuyer?: boolean;
}

const INITIAL_VISIBLE_SELLERS = 24;
const VISIBLE_SELLERS_STEP = 24;

const SellerGridSkeleton = () => (
    <div role="status" aria-busy="true" aria-live="polite" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <span className="sr-only">Loading shops…</span>
        {Array.from({ length: 12 }).map((_, index) => (
            <div
                key={index}
                aria-hidden="true"
                className="h-[184px] overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-3 shadow-sm dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-colors duration-200"
            >
                <div className="mb-3 flex items-start gap-3">
                    <Skeleton className="h-14 w-14 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3 rounded" />
                        <Skeleton className="h-3 w-full rounded" />
                        <Skeleton className="h-3 w-4/5 rounded" />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    <Skeleton className="h-12 rounded-xl" />
                    <Skeleton className="h-12 rounded-xl" />
                    <Skeleton className="h-12 rounded-xl" />
                </div>
                <Skeleton className="mt-3 h-9 rounded-xl" />
            </div>
        ))}
    </div>
);

const EMPTY_SELLERS: ApiPublicSeller[] = [];

const SellersGrid = ({ filterCity, filterArea, searchQuery, isBuyer }: SellersGridProps) => {
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_SELLERS);
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const sellersQuery = usePublicSellersQuery({ page: 1, limit: 100 });
    const sellers = sellersQuery.data?.sellers || EMPTY_SELLERS;
    const loading = sellersQuery.isLoading;

    useEffect(() => {
        setVisibleCount(INITIAL_VISIBLE_SELLERS);
    }, [filterCity, filterArea, deferredSearchQuery]);

    const filteredSellers = useMemo(() => {
        const query = deferredSearchQuery.trim().toLowerCase();

        return sellers.filter(seller => {
            if (filterCity && seller.city !== filterCity) return false;
            if (filterArea && seller.location !== filterArea) return false;
            if (query) {
                return (
                    (seller.shopName || seller.shop_name || '').toLowerCase().includes(query) ||
                    (seller.fullName || '').toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [sellers, filterCity, filterArea, deferredSearchQuery]);

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
        <div className="grid grid-cols-2 gap-3 sm:gap-4 [@media(min-width:640px)]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
            {filteredSellers.map((seller) => (
                <SellerBrandCard key={seller.id} seller={seller} isBuyer={isBuyer} />
            ))}
        </div>
    );
};

export default memo(SellersGrid);


