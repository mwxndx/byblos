import { describe, it, expect } from 'vitest';
import { transformSeller, isDeletedSeller } from '../sellerTransforms';

describe('sellerTransforms - defense-in-depth against deleted sellers', () => {
  const activeSeller = {
    id: '5',
    shop_name: 'Toto',
    full_name: 'Toto Owner',
    status: 'active',
    is_active: true,
    created_at: '2026-10-16T19:07:00.226Z'
  };

  it('transforms active seller normally', () => {
    const result = transformSeller(activeSeller);
    expect(result).not.toBeNull();
    expect(result?.shopName).toBe('Toto');
    expect(isDeletedSeller(activeSeller)).toBe(false);
  });

  it('returns null and flags isDeletedSeller when status is deleted', () => {
    const seller = { ...activeSeller, status: 'deleted' };
    expect(isDeletedSeller(seller)).toBe(true);
    expect(transformSeller(seller)).toBeNull();
  });

  it('returns null and flags isDeletedSeller when is_active is false', () => {
    const seller = { ...activeSeller, is_active: false };
    expect(isDeletedSeller(seller)).toBe(true);
    expect(transformSeller(seller)).toBeNull();
  });

  it('returns null and flags isDeletedSeller when shop_name starts with deleted-shop-', () => {
    const seller = { ...activeSeller, shop_name: 'deleted-shop-16_1792971474434' };
    expect(isDeletedSeller(seller)).toBe(true);
    expect(transformSeller(seller)).toBeNull();
  });

  it('returns null and flags isDeletedSeller when camelCase shopName starts with deleted-shop-', () => {
    const seller = { id: '16', shopName: 'deleted-shop-16_1792971474434', fullName: 'Some Name' };
    expect(isDeletedSeller(seller)).toBe(true);
    expect(transformSeller(seller)).toBeNull();
  });

  it('returns null and flags isDeletedSeller when full_name or fullName is Deleted user', () => {
    const sellerWithSnake = { ...activeSeller, full_name: 'Deleted user' };
    expect(isDeletedSeller(sellerWithSnake)).toBe(true);
    expect(transformSeller(sellerWithSnake)).toBeNull();

    const sellerWithCamel = { ...activeSeller, fullName: 'Deleted user' };
    expect(isDeletedSeller(sellerWithCamel)).toBe(true);
    expect(transformSeller(sellerWithCamel)).toBeNull();
  });
});
