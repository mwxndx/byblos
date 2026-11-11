import { memo, useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, Store, UserMinus } from '@/shared/ui/icons';
import { cn, getImageUrl } from '@/shared/utils/formatting';
import { useKnockSellerMutation } from '@/features/shop/hooks/useShopQueries';
import type { ApiPublicSeller } from '@/shared/types/api/seller';
import { socialUrl, coordsMapUrl } from '../utils/socialLinks';
import { SocialButtons } from './SocialButtons';

interface SellerBrandCardProps {
    seller: ApiPublicSeller;
    className?: string;
    isBuyer?: boolean;
    showUnfollow?: boolean;
    isUnfollowing?: boolean;
    onUnfollow?: (seller: ApiPublicSeller) => void;
    onClickCountChange?: (seller: ApiPublicSeller, clickCount: number) => void;
}

const getNumber = (...values: unknown[]) => {
    for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const SellerBrandCard = ({ seller, className, isBuyer, showUnfollow = false, isUnfollowing = false, onUnfollow, onClickCountChange }: SellerBrandCardProps) => {
    const navigate = useNavigate();
    const knockSellerMutation = useKnockSellerMutation();
    const shopName = seller.shopName || seller.shop_name || 'Shop';
    const canonicalSlug = (seller.slug || seller.shopName || seller.shop_name || '') as string;
    const shopLink = isBuyer
        ? `/buyer/shop/${encodeURIComponent(canonicalSlug)}`
        : `/${encodeURIComponent(canonicalSlug)}`;
    const avatarUrl = String(seller.avatarUrl || (seller as unknown as { avatar_url?: string }).avatar_url || '');
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [knockCount, setKnockCount] = useState(getNumber(seller.knockCount, seller.knock_count));
    const hasAvatar = Boolean(avatarUrl && !avatarFailed);

    const instagramHref = socialUrl('instagram', seller.instagramLink);
    const tiktokHref = socialUrl('tiktok', seller.tiktokLink);
    const mapHref = coordsMapUrl(seller.latitude, seller.longitude);

    useEffect(() => {
        setKnockCount(getNumber(seller.knockCount, seller.knock_count));
    }, [seller.knockCount, seller.knock_count]);

    const handleKnock = useCallback(() => {
        const optimisticCount = knockCount + 1;
        setKnockCount(optimisticCount);
        onClickCountChange?.(seller, optimisticCount);

        knockSellerMutation.mutate(seller.id, {
            onSuccess: (result) => {
                if (typeof result.knockCount !== 'number') return;
                setKnockCount(result.knockCount);
                onClickCountChange?.(seller, result.knockCount);
            },
            onError: (error) => {
                console.error('Failed to record seller knock:', error);
            },
        });

        navigate(shopLink);
    }, [knockCount, navigate, onClickCountChange, seller, shopLink, knockSellerMutation]);

    const handleUnfollow = useCallback(() => {
        if (!onUnfollow || isUnfollowing) return;
        onUnfollow(seller);
    }, [isUnfollowing, onUnfollow, seller]);

    const handleCardKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleKnock();
    }, [handleKnock]);

    // Inner links must not trigger the card's navigation.
    const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

    return (
        <div
            className={cn(
                'group relative flex w-full cursor-pointer items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-surface-1 p-3 sm:p-3.5 shadow-sm transition-all duration-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-white/70 min-h-[72px] sm:min-h-[80px]',
                className,
            )}
            role="link"
            tabIndex={0}
            onClick={handleKnock}
            onKeyDown={handleCardKeyDown}
            aria-label={`Open ${shopName}`}
        >
            {/* Left side: Business profile photo in square frame with rounded corners, followed by shop name */}
            <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl aspect-square border border-slate-200/80 dark:border-white/10 bg-slate-100 dark:bg-zinc-900 flex items-center justify-center">
                    {hasAvatar ? (
                        <img
                            src={getImageUrl(avatarUrl)}
                            alt={`${shopName} business photo`}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            loading="lazy"
                            onError={() => setAvatarFailed(true)}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-zinc-900">
                            <Store className="h-6 w-6 text-slate-400 dark:text-white/50" strokeWidth={1.5} />
                        </div>
                    )}
                </div>

                <div className="flex flex-col min-w-0 justify-center">
                    <h3 className="truncate text-[15px] sm:text-[16px] font-bold tracking-tight text-slate-900 dark:text-white" title={shopName}>
                        {shopName}
                    </h3>
                </div>
            </div>

            {/* Right side: arranged horizontally from right towards left */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-row-reverse">
                {showUnfollow && onUnfollow ? (
                    <button
                        type="button"
                        disabled={isUnfollowing}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleUnfollow();
                        }}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-xl border border-red-400/35 bg-red-500/15 px-3 text-[11px] font-semibold text-red-600 dark:text-white transition duration-200 hover:bg-red-500/25 active:bg-red-500/30 disabled:cursor-wait disabled:opacity-60"
                        aria-label={`Unfollow ${shopName}`}
                    >
                        <UserMinus className="h-3.5 w-3.5" />
                        <span>{isUnfollowing ? '...' : 'Unfollow'}</span>
                    </button>
                ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400 dark:text-white/40 group-hover:translate-x-0.5 transition-transform" />
                )}

                {mapHref ? (
                    <a
                        href={mapHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={stop}
                        aria-label={`${shopName} location on the map`}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.06] p-1.5 shadow-sm transition-all hover:opacity-80"
                    >
                        <MapPin className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-400" />
                    </a>
                ) : (
                    <span
                        aria-label="Location not available"
                        aria-disabled="true"
                        className="inline-flex cursor-not-allowed items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.03] p-1.5 opacity-35"
                    >
                        <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-white/60" />
                    </span>
                )}

                <SocialButtons instagramHref={instagramHref} tiktokHref={tiktokHref} shopName={shopName} size="sm" />
            </div>
        </div>
    );
};

export default memo(SellerBrandCard);
