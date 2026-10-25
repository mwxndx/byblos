import type { Product, Seller, Aesthetic } from '@/shared/types';
import type { Theme } from '@/shared/hooks/useShopTheme';

// Type guard to check if a string is a valid Aesthetic
export function isAesthetic(value: string): value is Aesthetic {
  return [
    'all',
    'clothes-style',
    'sneakers-shoes',
    'beauty-fragrance',
    'art-decor-crafts',
    'electronics-accessories',
    'home-living',
    'health-wellness'
  ].includes(value);
}

export { getInitials as getSellerInitials } from '@/shared/utils/formatting';

// Base product type that matches the Product interface but makes some fields optional
export interface BaseProduct extends Omit<Product, 'seller' | 'aesthetic' | 'isSold' | 'status'> {
  seller?: Seller;
  isSold: boolean;
  status: 'available' | 'sold';
  aesthetic: Aesthetic | string;
}

// Shop-specific product type that extends the base product
export interface ShopProduct extends Omit<BaseProduct, 'seller'> {
  seller?: ShopSeller;
}

// Shop-specific seller type that extends the base Seller type
export interface ShopSeller extends Omit<Seller, 'bannerUrl'> {
  slug?: string;
  theme?: Theme;
  city?: string;
  instagramLink?: string;
  tiktokLink?: string;
  facebookLink?: string;
  bio?: string;
  avatarUrl?: string;
  avatar_url?: string;
  creatorCommissionRate?: number;
  isCreatorMarketplaceEnabled?: boolean;
}

