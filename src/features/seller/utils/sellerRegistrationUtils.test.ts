import { describe, it, expect } from 'vitest';
import { normalizeShopName } from './sellerRegistrationUtils';

describe('sellerRegistrationUtils - normalizeShopName', () => {
  it('capitalizes the first letter of each word', () => {
    expect(normalizeShopName('urban wear')).toBe('Urban Wear');
    expect(normalizeShopName('jane')).toBe('Jane');
  });

  it('replaces single underscores with spaces and capitalizes each word', () => {
    expect(normalizeShopName('urban_wear')).toBe('Urban Wear');
    expect(normalizeShopName('glam_boutique_ke')).toBe('Glam Boutique Ke');
    expect(normalizeShopName('my_cool_shop')).toBe('My Cool Shop');
  });

  it('handles multiple consecutive underscores cleanly', () => {
    expect(normalizeShopName('urban___wear')).toBe('Urban Wear');
    expect(normalizeShopName('cool__kicks__store')).toBe('Cool Kicks Store');
  });

  it('strips leading and trailing underscores and spaces', () => {
    expect(normalizeShopName('_thrift_store_')).toBe('Thrift Store');
    expect(normalizeShopName('__vintage_closet__')).toBe('Vintage Closet');
    expect(normalizeShopName('  _urban_wear_  ')).toBe('Urban Wear');
  });

  it('never contains an underscore in the output', () => {
    const testCases = [
      'urban_wear',
      '_leading_and_trailing_',
      'triple___underscore',
      'a_b_c_d_e',
    ];

    testCases.forEach((input) => {
      const normalized = normalizeShopName(input);
      expect(normalized).not.toContain('_');
      expect(normalized.charAt(0)).toBe(normalized.charAt(0).toUpperCase());
    });
  });

  it('handles alphanumeric words and numbers correctly', () => {
    expect(normalizeShopName('store_101')).toBe('Store 101');
    expect(normalizeShopName('24seven_shop')).toBe('24seven Shop');
  });

  it('returns empty string for null, undefined, or empty values', () => {
    expect(normalizeShopName('')).toBe('');
    expect(normalizeShopName(null as unknown as string)).toBe('');
    expect(normalizeShopName(undefined as unknown as string)).toBe('');
    expect(normalizeShopName('   ___   ')).toBe('');
  });
});

