/* eslint-disable react-refresh/only-export-components -- provider + its hooks co-located by convention */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Product } from '@/shared/types';
import { calculateProductServiceCharge, getProductFlags, type ProductWithApiFields } from '@/features/shop/utils/productCardUtils';

const isServiceProduct = (product: Product) => getProductFlags(product as unknown as ProductWithApiFields).isService;

export const MAX_BAG_PRODUCTS = 5;

const sameId = (a: string | number, b: string | number) => String(a) === String(b);

export interface BagLine {
  product: Product;
  quantity: number;
}

interface AddResult {
  ok: boolean;
  reason?: string;
}

export interface BagContextValue {
  items: BagLine[];
  count: number;          // distinct products in the bag
  totalQuantity: number;
  subtotal: number;
  serviceCharge: number;  // 2% Byblos charge (delivery is added later at checkout)
  total: number;          // subtotal + serviceCharge
  isFull: boolean;
  isOpen: boolean;
  addProduct: (product: Product) => AddResult;
  removeProduct: (productId: string | number) => void;
  setQuantity: (productId: string | number, quantity: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  hasProduct: (productId: string | number) => boolean;
}

const BagContext = createContext<BagContextValue | null>(null);

/**
 * Per-seller shopping bag. Mounted once per seller shop, so its contents are
 * naturally isolated to the current shop — leaving one shop and opening another
 * remounts a fresh, empty bag (spec §29: bags never mix between sellers).
 * Holds up to MAX_BAG_PRODUCTS distinct products (quantities can grow beyond that).
 * Session-scoped per shopSlug so page refreshes and login redirects preserve the cart.
 */
export function BagProvider({ seedProduct, shopSlug, children }: { seedProduct?: Product | null; shopSlug?: string; children: ReactNode }) {
  const [items, setItems] = useState<BagLine[]>(() => {
    if (typeof window === 'undefined' || !shopSlug) return [];
    try {
      const stored = sessionStorage.getItem(`byblos_bag_${shopSlug}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.debug('Failed to load stored bag:', e);
    }
    return [];
  });
  const [isOpen, setIsOpen] = useState(false);
  const seededRef = useRef(false);

  // Sync cart items to sessionStorage scoped by seller shop
  useEffect(() => {
    if (typeof window === 'undefined' || !shopSlug) return;
    try {
      if (items.length > 0) {
        sessionStorage.setItem(`byblos_bag_${shopSlug}`, JSON.stringify(items));
      } else {
        sessionStorage.removeItem(`byblos_bag_${shopSlug}`);
      }
    } catch (e) {
      console.debug('Failed to save bag to sessionStorage:', e);
    }
  }, [items, shopSlug]);

  // Pre-add a product carried over from another surface (e.g. a wishlist tap that
  // opens this shop with the item already in the bag — spec: wishlist → shop + bag).
  useEffect(() => {
    if (!seedProduct || seededRef.current) return;
    seededRef.current = true;
    setItems((prev) => (prev.some((l) => sameId(l.product.id, seedProduct.id)) ? prev : [...prev, { product: seedProduct, quantity: 1 }]));
    setIsOpen(true);
    toast.success(`${seedProduct.name} added to your bag`);
  }, [seedProduct]);

  const hasProduct = useCallback(
    (productId: string | number) => items.some((l) => sameId(l.product.id, productId)),
    [items],
  );

  const addProduct = useCallback((product: Product): AddResult => {
    const trackInventory = Boolean((product as unknown as ProductWithApiFields).track_inventory);
    const availableStock = typeof (product as unknown as ProductWithApiFields).quantity === 'number'
      ? (product as unknown as ProductWithApiFields).quantity!
      : Infinity;

    if (trackInventory && availableStock <= 0) {
      return { ok: false, reason: 'This product is out of stock.' };
    }

    const already = items.find((l) => sameId(l.product.id, product.id));
    if (already) {
      if (trackInventory && already.quantity + 1 > availableStock) {
        return {
          ok: false,
          reason: availableStock <= 0
            ? 'This product is out of stock.'
            : `Only ${availableStock} item${availableStock === 1 ? '' : 's'} available in stock.`
        };
      }
      setItems((prev) => prev.map((l) => (sameId(l.product.id, product.id) ? { ...l, quantity: l.quantity + 1 } : l)));
      return { ok: true };
    }
    // A service is booked with the seller and cannot share an order with other
    // products, so it occupies the bag on its own.
    const addingService = isServiceProduct(product);
    const bagHasService = items.some((l) => isServiceProduct(l.product));
    if (items.length > 0 && (addingService || bagHasService)) {
      return { ok: false, reason: 'A service is booked on its own — check it out separately from products.' };
    }
    if (items.length >= MAX_BAG_PRODUCTS) {
      return { ok: false, reason: `Your bag is full — up to ${MAX_BAG_PRODUCTS} products.` };
    }
    setItems((prev) => [...prev, { product, quantity: 1 }]);
    return { ok: true };
  }, [items]);

  const removeProduct = useCallback((productId: string | number) => {
    setItems((prev) => prev.filter((l) => !sameId(l.product.id, productId)));
  }, []);

  const setQuantity = useCallback((productId: string | number, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((l) => !sameId(l.product.id, productId));
      return prev.map((l) => {
        if (!sameId(l.product.id, productId)) return l;
        const trackInventory = Boolean((l.product as unknown as ProductWithApiFields).track_inventory);
        const availableStock = typeof (l.product as unknown as ProductWithApiFields).quantity === 'number'
          ? (l.product as unknown as ProductWithApiFields).quantity!
          : Infinity;
        if (trackInventory && quantity > availableStock) {
          toast.error(`Only ${availableStock} available in stock.`);
          return { ...l, quantity: availableStock };
        }
        return { ...l, quantity };
      });
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    if (typeof window !== 'undefined' && shopSlug) {
      try {
        sessionStorage.removeItem(`byblos_bag_${shopSlug}`);
      } catch (e) {
        // ignore
      }
    }
  }, [shopSlug]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<BagContextValue>(() => {
    const subtotal = items.reduce((sum, l) => sum + (Number(l.product.price) || 0) * l.quantity, 0);
    const serviceCharge = calculateProductServiceCharge(subtotal);
    const totalQuantity = items.reduce((sum, l) => sum + l.quantity, 0);
    return {
      items,
      count: items.length,
      totalQuantity,
      subtotal,
      serviceCharge,
      total: subtotal + serviceCharge,
      isFull: items.length >= MAX_BAG_PRODUCTS,
      isOpen,
      addProduct,
      removeProduct,
      setQuantity,
      clear,
      open,
      close,
      hasProduct,
    };
  }, [items, isOpen, addProduct, removeProduct, setQuantity, clear, open, close, hasProduct]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

/** Bag access inside a seller shop. Throws if used outside a BagProvider. */
export function useBag(): BagContextValue {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error('useBag must be used within a BagProvider');
  return ctx;
}
