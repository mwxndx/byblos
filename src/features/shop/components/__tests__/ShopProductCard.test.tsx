import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShopProductCard } from '../ShopProductCard';
import type { Product } from '@/shared/types';

vi.mock('@/features/shop/wishlist/useWishlist', () => ({
  useWishlist: () => ({
    addToWishlist: vi.fn(),
    removeFromWishlist: vi.fn(),
  }),
}));

vi.mock('@/features/shop/wishlist/wishlistStore', () => ({
  useIsProductWishlisted: () => false,
}));

describe('ShopProductCard', () => {
  const mockProduct: Product = {
    id: 'prod-123',
    name: 'Byblos Silk Shirt',
    price: 4500,
    description: '100% pure silk shirt with minimalist finish.',
    image_url: 'https://images.unsplash.com/photo-1',
    images: ['https://images.unsplash.com/photo-1', 'https://images.unsplash.com/photo-2'],
    seller_id: 'seller-456',
    created_at: new Date().toISOString(),
    seller: {
      id: 'seller-456',
      fullName: 'Alice Seller',
      shopName: 'Alice Atelier',
      theme: 'default',
    },
  };

  it('renders card with lift effect classes and increased content height', () => {
    const handleTap = vi.fn();
    render(<ShopProductCard product={mockProduct} onTap={handleTap} />);

    const card = screen.getByRole('button', { name: /Add Byblos Silk Shirt to bag/i });
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('product-card-item');
    expect(card).toHaveClass('hover:-translate-y-1.5');

    // Content container has increased height and padding
    const content = card.querySelector('.min-h-\\[96px\\]');
    expect(content).toBeInTheDocument();
  });

  it('renders enlarged image and description buttons with tactile styling and aria-labels', () => {
    const handleTap = vi.fn();
    render(<ShopProductCard product={mockProduct} onTap={handleTap} />);

    const imageBtn = screen.getByRole('button', { name: /View Byblos Silk Shirt images/i });
    const descBtn = screen.getByRole('button', { name: /View Byblos Silk Shirt description/i });

    expect(imageBtn).toBeInTheDocument();
    expect(descBtn).toBeInTheDocument();

    expect(imageBtn).toHaveClass('h-7');
    expect(imageBtn).toHaveClass('rounded-full');
    expect(descBtn).toHaveClass('h-7');
    expect(descBtn).toHaveClass('rounded-full');
  });

  it('opens description dialog when description button is clicked without triggering card onTap', () => {
    const handleTap = vi.fn();
    render(<ShopProductCard product={mockProduct} onTap={handleTap} />);

    const descBtn = screen.getByRole('button', { name: /View Byblos Silk Shirt description/i });
    fireEvent.click(descBtn);

    expect(handleTap).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /Byblos Silk Shirt description/i })).toBeInTheDocument();
    expect(screen.getByText('100% pure silk shirt with minimalist finish.')).toBeInTheDocument();
  });

  it('opens image viewer when image button is clicked without triggering card onTap', () => {
    const handleTap = vi.fn();
    render(<ShopProductCard product={mockProduct} onTap={handleTap} />);

    const imageBtn = screen.getByRole('button', { name: /View Byblos Silk Shirt images/i });
    fireEvent.click(imageBtn);

    expect(handleTap).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /Byblos Silk Shirt images/i })).toBeInTheDocument();
  });

  it('renders product photo with object-contain to avoid image clipping from being rendered too big', () => {
    render(<ShopProductCard product={mockProduct} onTap={vi.fn()} />);

    const productImg = screen.getByAltText('Byblos Silk Shirt');
    expect(productImg).toBeInTheDocument();
    expect(productImg).toHaveClass('object-contain');
    expect(productImg).not.toHaveClass('object-cover');
  });
});
