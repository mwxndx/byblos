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
    products: [],
    setIsAddProductModalOpen: vi.fn(),
    sellerProfile: baseProfile,
    shopUsername: 'eris',
    onCopyShopLink: vi.fn(),
    analytics: {
      totalProducts: 0,
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

  it('does not contain removed header text or banner descriptions', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsTab {...defaultProps} />
      </QueryClientProvider>
    );

    expect(screen.queryByText(/Product Management/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Manage all your products in one place/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/All Products/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Manage inventory and track stock levels/i)).not.toBeInTheDocument();
  });

  it('renders add product button with horizontal three dots on the same row that display service charge description when clicked', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsTab {...defaultProps} />
      </QueryClientProvider>
    );

    const addProductBtn = screen.getByRole('button', { name: /Add product/i });
    expect(addProductBtn).toBeInTheDocument();

    const threeDotsBtn = screen.getByRole('button', { name: /Service charge description/i });
    expect(threeDotsBtn).toBeInTheDocument();

    // Both are siblings inside the same row container
    expect(addProductBtn.parentElement).toBe(threeDotsBtn.parentElement);

    // Click three dots to open description
    fireEvent.click(threeDotsBtn);
    expect(
      screen.getByText(/Byblos adds a 2% service charge to each product price to keep products safe in transit, secure the transaction, and support our operations and maintenance\./i)
    ).toBeInTheDocument();
  });
});
