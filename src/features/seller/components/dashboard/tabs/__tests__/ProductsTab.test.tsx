import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductsTab } from '../ProductsTab';
import type { SellerProfile } from '@/features/auth/types/authTypes';

const baseProfile: SellerProfile = {
  id: 'seller-1',
  sellerId: 'seller-1',
  businessName: 'Eris Store',
  shopName: 'eris',
  bio: 'Handcrafted items',
  avatarUrl: 'https://example.com/avatar.jpg',
  theme: 'default',
  location: null,
  role: 'seller',
  email: 'seller@example.com',
  isApproved: true,
};

const mockProduct = {
  id: 'prod-1',
  name: 'Vintage Leather Bag',
  description: 'Handcrafted full-grain leather shoulder bag',
  price: 4500,
  image_url: 'https://example.com/bag.jpg',
  status: 'available' as const,
  quantity: 12,
  track_inventory: true,
  seller_id: 'seller-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('ProductsTab', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const defaultProps = {
    fetchProducts: vi.fn().mockResolvedValue(undefined),
    isAddProductModalOpen: false,
    onDeleteProduct: vi.fn().mockResolvedValue(undefined),
    onEditProduct: vi.fn(),
    onStatusUpdate: vi.fn().mockResolvedValue(undefined),
    products: [mockProduct],
    setIsAddProductModalOpen: vi.fn(),
    sellerProfile: baseProfile,
    shopUsername: 'eris',
    onCopyShopLink: vi.fn(),
    analytics: {
      totalProducts: 1,
      totalSales: 100,
      totalRevenue: 90,
      totalPayout: 90,
      balance: 0,
      availableBalance: 0,
      pendingSettlementBalance: 0,
      withdrawalReservedBalance: 0,
      refundReservedBalance: 0,
      nextSettlementAt: null,
      creatorCount: 0,
      creatorGeneratedSales: 0,
      wishlistCount: 2,
      clickCount: 15,
      monthlySales: [],
      recentOrders: [],
    },
  };

  it('renders seller profile hero with sales, revenue, balance, clicks, and wishlist at the top', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsTab {...defaultProps} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('clicks')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('wishlist')).toBeInTheDocument();
  });

  it('renders number of active products pill from database/analytics', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsTab {...defaultProps} />
      </QueryClientProvider>
    );

    const pill = screen.getByTestId('active-products-pill');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent(/1 active product/i);
  });

  it('places search icon between add product button and three dots with vertical alignment', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsTab {...defaultProps} />
      </QueryClientProvider>
    );

    const addProductBtn = screen.getByRole('button', { name: /Add product/i });
    const searchBtn = screen.getByRole('button', { name: /Search products/i });
    const threeDotsBtn = screen.getByRole('button', { name: /Service charge description/i });

    expect(addProductBtn).toBeInTheDocument();
    expect(searchBtn).toBeInTheDocument();
    expect(threeDotsBtn).toBeInTheDocument();

    // Verify ordering inside the buttons container
    const container = addProductBtn.parentElement;
    expect(container).toHaveClass('flex', 'items-center');
    expect(searchBtn.parentElement).toBe(container);
    expect(threeDotsBtn.parentElement).toBe(container);

    // Search button is positioned after Add product and before Three dots
    expect(addProductBtn.compareDocumentPosition(searchBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(searchBtn.compareDocumentPosition(threeDotsBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows search bar input when search icon is clicked', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsTab {...defaultProps} />
      </QueryClientProvider>
    );

    // Search bar is not visible initially
    expect(screen.queryByPlaceholderText(/Search products\.\.\./i)).not.toBeInTheDocument();

    // Click search icon
    const searchBtn = screen.getByRole('button', { name: /Search products/i });
    fireEvent.click(searchBtn);

    // Search bar is now visible
    expect(screen.getByPlaceholderText(/Search products\.\.\./i)).toBeInTheDocument();
  });

  it('renders rectangular product card with square image, name, description, stock button, pencil top-right, delete bottom-right, and price/sold-out row', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsTab {...defaultProps} />
      </QueryClientProvider>
    );

    const card = screen.getByTestId('product-card-prod-1');
    expect(card).toBeInTheDocument();

    // Square product image
    const img = screen.getByAltText('Vintage Leather Bag');
    expect(img).toBeInTheDocument();
    expect(img.parentElement).toHaveClass('h-20', 'w-20');

    // Name and description
    expect(screen.getByText('Vintage Leather Bag')).toBeInTheDocument();
    expect(screen.getByText('Handcrafted full-grain leather shoulder bag')).toBeInTheDocument();

    // Stock button allowing inventory editing
    const stockBtn = screen.getByRole('button', { name: /Edit stock/i });
    expect(stockBtn).toBeInTheDocument();
    expect(stockBtn).toHaveTextContent(/12 in stock/i);

    // Pencil icon at top right
    const editBtn = screen.getByRole('button', { name: /Edit product/i });
    expect(editBtn).toBeInTheDocument();
    expect(editBtn).toHaveClass('absolute', 'top-3', 'right-3');

    // Delete icon at bottom right
    const deleteBtn = screen.getByRole('button', { name: /Delete product/i });
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn).toHaveClass('absolute', 'bottom-3', 'right-3');

    // Price and Mark as sold out button
    expect(screen.getByText(/KSh 4,500/i)).toBeInTheDocument();
    const markSoldOutBtn = screen.getByRole('button', { name: /Mark as sold out/i });
    expect(markSoldOutBtn).toBeInTheDocument();
  });
});
