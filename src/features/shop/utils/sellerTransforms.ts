import type { ApiPublicSeller } from '@/shared/types/api/seller';
export type { ApiPublicSeller };


const str = (v: unknown, fallback = ''): string => (v === null || v === undefined || v === '') ? fallback : String(v);

function extractSellerIdentity(sObj: Record<string, unknown>) {
  return {
    id: str(sObj.id),
    fullName: str(sObj.full_name || sObj.fullName, 'Unknown Seller'),
    email: str(sObj.email),
    phone: str(sObj.phone),
    bannerUrl: str(sObj.banner_url || sObj.bannerUrl),
    shopName: str(sObj.shop_name || sObj.shopName, 'My Shop'),
    createdAt: str(sObj.created_at || sObj.createdAt, new Date().toISOString()),
    updatedAt: str(sObj.updated_at || sObj.updatedAt, new Date().toISOString()),
    theme: str(sObj.theme, 'default'),
    ...(sObj.bio ? { bio: str(sObj.bio) } : {}),
    ...(sObj.avatar_url ? { avatarUrl: str(sObj.avatar_url) } : {}),
    ...(sObj.avatarUrl ? { avatarUrl: str(sObj.avatarUrl) } : {})
  };
}

function extractSellerLocation(sObj: Record<string, unknown>) {
  const physicalAddress = sObj.physicalAddress || sObj.physical_address;
  return {
    ...(sObj.location ? { location: str(sObj.location) } : {}),
    ...(sObj.city ? { city: str(sObj.city) } : {}),
    hasPhysicalShop: Boolean(sObj.hasPhysicalShop || sObj.has_physical_shop || physicalAddress),
    ...(physicalAddress ? { physicalAddress: str(physicalAddress) } : {}),
    ...(sObj.latitude ? { latitude: Number(sObj.latitude) } : {}),
    ...(sObj.longitude ? { longitude: Number(sObj.longitude) } : {})
  };
}

function extractSellerSocial(sObj: Record<string, unknown>) {
  const socialMedia = sObj.social_media || sObj.socialMedia;
  const instagram = sObj.instagramLink || sObj.instagram_link;
  const tiktok = sObj.tiktokLink || sObj.tiktok_link;
  const facebook = sObj.facebookLink || sObj.facebook_link;

  return {
    ...(sObj.website ? { website: str(sObj.website) } : {}),
    ...(socialMedia ? { socialMedia: socialMedia as Record<string, string> } : {}),
    ...(instagram ? { instagramLink: str(instagram) } : {}),
    ...(tiktok ? { tiktokLink: str(tiktok) } : {}),
    ...(facebook ? { facebookLink: str(facebook) } : {})
  };
}

function extractSellerMetrics(sObj: Record<string, unknown>) {
  const totalWishlist = sObj.totalWishlistCount ?? sObj.total_wishlist_count;
  const wishlist = sObj.wishlistCount ?? sObj.wishlist_count;
  const knock = sObj.knockCount ?? sObj.knock_count;

  return {
    ...(totalWishlist !== undefined ? { totalWishlistCount: Number(totalWishlist) } : {}),
    ...(wishlist !== undefined ? { wishlistCount: Number(wishlist) } : {}),
    ...(knock !== undefined ? { knockCount: Number(knock) } : {})
  };
}

export function isDeletedSeller(seller: unknown): boolean {
  if (!seller || typeof seller !== 'object') return false;
  const sObj = seller as Record<string, unknown>;

  const status = String(sObj.status || '').toLowerCase();
  if (status === 'deleted' || status === 'suspended') return true;

  if (sObj.is_active === false || sObj.isActive === false) return true;

  const shopName = String(sObj.shop_name || '').trim();
  const camelShopName = String(sObj.shopName || '').trim();
  if (/^deleted-shop-/i.test(shopName) || /^deleted-shop-/i.test(camelShopName)) return true;

  const fullName = String(sObj.full_name || '').trim().toLowerCase();
  const camelFullName = String(sObj.fullName || '').trim().toLowerCase();
  if (
    fullName === 'deleted user' ||
    fullName === 'deleted seller' ||
    camelFullName === 'deleted user' ||
    camelFullName === 'deleted seller'
  ) {
    return true;
  }

  return false;
}

export function transformSeller(seller: unknown): ApiPublicSeller | null {
  if (!seller || isDeletedSeller(seller)) return null;
  const sObj = seller as Record<string, unknown>;

  return {
    ...extractSellerIdentity(sObj),
    ...extractSellerLocation(sObj),
    ...extractSellerSocial(sObj),
    ...extractSellerMetrics(sObj)
  };
}
