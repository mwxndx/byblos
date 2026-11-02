import { describe, it, expect } from 'vitest';
import { calculateShopPriorityScore, compareSellersByPriority } from '../shopPrioritization';
import type { ApiPublicSeller } from '@/shared/types/api/seller';

describe('shopPrioritization', () => {
  it('calculates highest score for shops with photo, instagram, and tiktok', () => {
    const completeShop: Partial<ApiPublicSeller> = {
      avatarUrl: 'https://example.com/avatar.jpg',
      instagramLink: 'https://instagram.com/myshop',
      tiktokLink: 'https://tiktok.com/@myshop'
    };
    expect(calculateShopPriorityScore(completeShop)).toBe(1200);
  });

  it('calculates score for partial matches', () => {
    const photoAndIg: Partial<ApiPublicSeller> = {
      avatarUrl: 'https://example.com/avatar.jpg',
      instagramLink: 'myshop'
    };
    expect(calculateShopPriorityScore(photoAndIg)).toBe(150);

    const photoOnly: Partial<ApiPublicSeller> = {
      avatarUrl: 'https://example.com/avatar.jpg'
    };
    expect(calculateShopPriorityScore(photoOnly)).toBe(100);

    const socialsOnly: Partial<ApiPublicSeller> = {
      instagramLink: 'myshop',
      tiktokLink: 'myshop'
    };
    expect(calculateShopPriorityScore(socialsOnly)).toBe(100);

    const none: Partial<ApiPublicSeller> = {};
    expect(calculateShopPriorityScore(none)).toBe(0);
  });

  it('sorts shops with photo, instagram, and tiktok first', () => {
    const incomplete: ApiPublicSeller = {
      id: '1',
      shopName: 'Incomplete Shop',
      fullName: 'Seller 1',
      totalWishlistCount: 100
    } as ApiPublicSeller;

    const photoOnly: ApiPublicSeller = {
      id: '2',
      shopName: 'Photo Only Shop',
      fullName: 'Seller 2',
      avatarUrl: 'https://example.com/avatar.jpg',
      totalWishlistCount: 10
    } as ApiPublicSeller;

    const complete: ApiPublicSeller = {
      id: '3',
      shopName: 'Complete Shop',
      fullName: 'Seller 3',
      avatarUrl: 'https://example.com/avatar.jpg',
      instagramLink: 'myshop',
      tiktokLink: 'myshop',
      totalWishlistCount: 0
    } as ApiPublicSeller;

    const list = [incomplete, photoOnly, complete];
    list.sort(compareSellersByPriority);

    expect(list[0].id).toBe('3'); // Complete must be first
    expect(list[1].id).toBe('2'); // Photo only next
    expect(list[2].id).toBe('1'); // Incomplete last
  });
});

