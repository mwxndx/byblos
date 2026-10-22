import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { BagProvider, useBag, MAX_BAG_PRODUCTS } from '../BagContext';
import type { Product } from '@/shared/types';

const mockPhysicalProduct = (id: string | number, name: string, overrides: Partial<Product> = {}): Product => ({
  id: id as unknown as string,
  name,
  price: 500,
  product_type: 'physical',
  image_url: 'https://example.com/test.jpg',
  ...overrides,
});

const mockTrackedProduct = (id: string | number, name: string, stock: number): Product => ({
  id: id as unknown as string,
  name,
  price: 1000,
  product_type: 'physical',
  image_url: 'https://example.com/test.jpg',
  track_inventory: true,
  quantity: stock,
} as unknown as Product);

const mockServiceProduct = (id: string | number, name: string): Product => ({
  id: id as unknown as string,
  name,
  price: 2500,
  product_type: 'service',
  image_url: 'https://example.com/service.jpg',
});

describe('BagContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('hydrates initial items from sessionStorage for the current shopSlug', () => {
    const shopSlug = 'nairobi-thrifts';
    const storedItems = [
      { product: mockPhysicalProduct('p1', 'Vintage Denim Jacket'), quantity: 2 },
    ];
    sessionStorage.setItem(`byblos_bag_${shopSlug}`, JSON.stringify(storedItems));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BagProvider shopSlug={shopSlug}>{children}</BagProvider>
    );

    const { result } = renderHook(() => useBag(), { wrapper });

    expect(result.current.count).toBe(1);
    expect(result.current.totalQuantity).toBe(2);
    expect(result.current.items[0].product.name).toBe('Vintage Denim Jacket');
  });

  it('maintains strict isolation between two different shop slugs (spec §29)', () => {
    const shopA = 'shop-alpha';
    const shopB = 'shop-beta';

    sessionStorage.setItem(
      `byblos_bag_${shopA}`,
      JSON.stringify([{ product: mockPhysicalProduct('a1', 'Alpha Item'), quantity: 1 }])
    );

    const wrapperB = ({ children }: { children: React.ReactNode }) => (
      <BagProvider shopSlug={shopB}>{children}</BagProvider>
    );

    const { result } = renderHook(() => useBag(), { wrapper: wrapperB });

    expect(result.current.count).toBe(0);
    expect(result.current.items).toEqual([]);
  });

  it('persists items to sessionStorage on addProduct and setQuantity', () => {
    const shopSlug = 'urban-streetwear';
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BagProvider shopSlug={shopSlug}>{children}</BagProvider>
    );

    const { result } = renderHook(() => useBag(), { wrapper });

    act(() => {
      const res = result.current.addProduct(mockPhysicalProduct('prod1', 'Hoodie'));
      expect(res.ok).toBe(true);
    });

    const stored = JSON.parse(sessionStorage.getItem(`byblos_bag_${shopSlug}`) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].product.id).toBe('prod1');
    expect(stored[0].quantity).toBe(1);
  });

  it('enforces stock availability limit when track_inventory is true', () => {
    const shopSlug = 'limited-drops';
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BagProvider shopSlug={shopSlug}>{children}</BagProvider>
    );

    const { result } = renderHook(() => useBag(), { wrapper });
    const productWithStock2 = mockTrackedProduct('limited-1', 'Rare Sneakers', 2);

    // Add 1st item
    act(() => {
      const res1 = result.current.addProduct(productWithStock2);
      expect(res1.ok).toBe(true);
    });

    // Add 2nd item (reaches stock limit)
    act(() => {
      const res2 = result.current.addProduct(productWithStock2);
      expect(res2.ok).toBe(true);
    });

    // Attempt to add 3rd item (exceeds stock limit of 2)
    act(() => {
      const res3 = result.current.addProduct(productWithStock2);
      expect(res3.ok).toBe(false);
      expect(res3.reason).toMatch(/Only 2 items available in stock/i);
    });

    expect(result.current.items[0].quantity).toBe(2);
  });

  it('rejects adding an out of stock product when track_inventory is true and quantity is 0', () => {
    const shopSlug = 'boutique';
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BagProvider shopSlug={shopSlug}>{children}</BagProvider>
    );

    const { result } = renderHook(() => useBag(), { wrapper });
    const outOfStockProduct = mockTrackedProduct('oos-1', 'Sold Out Shirt', 0);

    act(() => {
      const res = result.current.addProduct(outOfStockProduct);
      expect(res.ok).toBe(false);
      expect(res.reason).toMatch(/out of stock/i);
    });

    expect(result.current.count).toBe(0);
  });

  it('enforces that a service product must occupy the bag alone', () => {
    const shopSlug = 'beauty-salon';
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BagProvider shopSlug={shopSlug}>{children}</BagProvider>
    );

    const { result } = renderHook(() => useBag(), { wrapper });

    // Add physical product
    act(() => {
      result.current.addProduct(mockPhysicalProduct('cream-1', 'Skin Cream'));
    });

    // Attempt to add service product to bag with physical items
    act(() => {
      const res = result.current.addProduct(mockServiceProduct('service-1', 'Facial Treatment'));
      expect(res.ok).toBe(false);
      expect(res.reason).toMatch(/A service is booked on its own/i);
    });
  });

  it('enforces MAX_BAG_PRODUCTS distinct items limit', () => {
    const shopSlug = 'general-store';
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BagProvider shopSlug={shopSlug}>{children}</BagProvider>
    );

    const { result } = renderHook(() => useBag(), { wrapper });

    for (let i = 1; i <= MAX_BAG_PRODUCTS; i++) {
      act(() => {
        const res = result.current.addProduct(mockPhysicalProduct(`item-${i}`, `Product ${i}`));
        expect(res.ok).toBe(true);
      });
    }

    // Attempt to add 6th item
    act(() => {
      const res = result.current.addProduct(mockPhysicalProduct('item-6', 'Product 6'));
      expect(res.ok).toBe(false);
      expect(res.reason).toMatch(/bag is full/i);
    });
  });

  it('clears items and removes sessionStorage on clear()', () => {
    const shopSlug = 'clearing-store';
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BagProvider shopSlug={shopSlug}>{children}</BagProvider>
    );

    const { result } = renderHook(() => useBag(), { wrapper });

    act(() => {
      result.current.addProduct(mockPhysicalProduct('p1', 'Item 1'));
    });

    expect(result.current.count).toBe(1);
    expect(sessionStorage.getItem(`byblos_bag_${shopSlug}`)).not.toBeNull();

    act(() => {
      result.current.clear();
    });

    expect(result.current.count).toBe(0);
    expect(sessionStorage.getItem(`byblos_bag_${shopSlug}`)).toBeNull();
  });
});
