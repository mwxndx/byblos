import type { ApiPublicSeller } from '@/shared/types/api/seller';

/**
 * Calculates a priority score for a shop:
 * - Shops with Business Profile Photo + Instagram + TikTok get a 1000-point completeness bonus
 *   guaranteeing they are displayed as the first shops.
 * - Business profile photo adds 100 points.
 * - Instagram link/handle adds 50 points.
 * - TikTok link/handle adds 50 points.
 */
export function calculateShopPriorityScore(seller: Partial<ApiPublicSeller>): number {
  const avatar = String(seller.avatarUrl || (seller as unknown as { avatar_url?: string }).avatar_url || '').trim();
  const instagram = String(seller.instagramLink || (seller as unknown as { instagram_link?: string }).instagram_link || '').trim();
  const tiktok = String(seller.tiktokLink || (seller as unknown as { tiktok_link?: string }).tiktok_link || '').trim();

  const hasAvatar = Boolean(avatar);
  const hasInstagram = Boolean(instagram);
  const hasTiktok = Boolean(tiktok);

  let score = 0;
  if (hasAvatar && hasInstagram && hasTiktok) {
    score += 1000;
  }
  if (hasAvatar) score += 100;
  if (hasInstagram) score += 50;
  if (hasTiktok) score += 50;

  return score;
}

/**
 * Comparator to sort shops by priority:
 * 1. Priority Score descending (Photo + Instagram + TikTok first)
 * 2. Total Wishlist Count descending
 * 3. 24h Knock Count descending
 * 4. ID ascending for stable sort
 */
export function compareSellersByPriority(a: ApiPublicSeller, b: ApiPublicSeller): number {
  const scoreA = calculateShopPriorityScore(a);
  const scoreB = calculateShopPriorityScore(b);
  if (scoreB !== scoreA) {
    return scoreB - scoreA;
  }

  const wishlistA = Number(a.totalWishlistCount ?? (a as unknown as { total_wishlist_count?: number }).total_wishlist_count ?? 0);
  const wishlistB = Number(b.totalWishlistCount ?? (b as unknown as { total_wishlist_count?: number }).total_wishlist_count ?? 0);
  if (wishlistB !== wishlistA) {
    return wishlistB - wishlistA;
  }

  const knockA = Number(a.knockCount ?? (a as unknown as { knock_count?: number }).knock_count ?? 0);
  const knockB = Number(b.knockCount ?? (b as unknown as { knock_count?: number }).knock_count ?? 0);
  if (knockB !== knockA) {
    return knockB - knockA;
  }

  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}

