import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SellerProfileHero } from '../SellerProfileHero';
import type { SellerProfile } from '../../../auth/types/authTypes';

describe('SellerProfileHero', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const baseProfile: SellerProfile = {
    id: 123,
    is_verified: true,
    createdAt: '2026-01-01',
    shopName: 'eris',
    fullName: 'Roy Miller',
    email: 'roy@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
    bio: 'Quality goods for everyone',
    phone: '0712345678',
    whatsappNumber: '0712345678',
    city: 'Nairobi',
    location: 'CBD',
  };

  it('normalizes lowercase shop name to Title Case in avatar alt text', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
        />
      </QueryClientProvider>
    );

    // Should display 'Eris' in avatar alt text
    expect(screen.getByAltText('Eris')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shop link/i })).toBeInTheDocument();
  });

  it('normalizes shop name with underscores by replacing them with spaces and capitalizing each word', () => {
    const profileWithUnderscores: SellerProfile = {
      ...baseProfile,
      shopName: 'eris_fashion_shop',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={profileWithUnderscores}
          shopUsername="eris_fashion_shop"
          onCopyShopLink={vi.fn()}
          canEdit={true}
        />
      </QueryClientProvider>
    );

    expect(screen.getByAltText('Eris Fashion Shop')).toBeInTheDocument();
  });

  it('falls back to "Your shop" initial when shop name and avatar are missing', () => {
    const emptyProfile: SellerProfile = {
      ...baseProfile,
      shopName: '',
      avatarUrl: '',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={emptyProfile}
          shopUsername=""
          onCopyShopLink={vi.fn()}
          canEdit={false}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Y')).toBeInTheDocument();
  });

  it('renders children alongside the profile photo and shop link button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
        >
          <div data-testid="metrics-container">Extra Content</div>
        </SellerProfileHero>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('metrics-container')).toBeInTheDocument();
    expect(screen.getByAltText('Eris')).toBeInTheDocument();
  });

  it('renders compact figures (1k, 1.5k, etc.) above 1000 and expands to full amount on click', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
          balance={1500}
          revenue={1200}
          totalSales={2000}
        />
      </QueryClientProvider>
    );

    // Initial compact figures (1500 -> 1.5k, 1200 -> 1.2k, 2000 -> 2k)
    expect(screen.getByText(/KSh 1\.5k/i)).toBeInTheDocument();
    expect(screen.getByText(/KSh 1\.2k/i)).toBeInTheDocument();
    expect(screen.getByText(/KSh 2k/i)).toBeInTheDocument();

    // Labels below figures
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();

    // Click balance to toggle to full amount
    const balanceBtn = screen.getByText(/KSh 1\.5k/i);
    fireEvent.click(balanceBtn);
    expect(screen.getByText(/KSh 1,500/i)).toBeInTheDocument();

    // Click again to toggle back to compact
    fireEvent.click(screen.getByText(/KSh 1,500/i));
    expect(screen.getByText(/KSh 1\.5k/i)).toBeInTheDocument();

    // Withdraw button is not next to balance
    expect(screen.queryByRole('button', { name: /Withdraw/i })).not.toBeInTheDocument();

    // Popover description buttons for Revenue and Sales
    expect(screen.getByRole('button', { name: /Revenue description/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sales description/i })).toBeInTheDocument();
  });

  it('renders standard full figures for values below 1000', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
          balance={0}
          revenue={90}
          totalSales={100}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/KSh 0/i)).toBeInTheDocument();
    expect(screen.getByText(/KSh 90/i)).toBeInTheDocument();
    expect(screen.getByText(/KSh 100/i)).toBeInTheDocument();
  });

  it('matches photo width and height with shop link button width and has no border', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
        />
      </QueryClientProvider>
    );

    const photoWrapper = container.querySelector('.rounded-full.overflow-hidden');
    expect(photoWrapper).toHaveClass('h-24', 'w-24');
    expect(photoWrapper).not.toHaveStyle({ border: '3px solid' });

    const shopLinkButton = screen.getByRole('button', { name: /Shop link/i });
    expect(shopLinkButton).toHaveClass('w-24');
  });

  it('aligns balance, sales, and revenue to the right of the profile photo using flex-row', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
          balance={1500}
          revenue={1200}
          totalSales={2000}
        />
      </QueryClientProvider>
    );

    const rootContainer = container.firstElementChild;
    expect(rootContainer).toHaveClass('flex', 'flex-row');
  });

  it('renders metrics starting with sales, revenue, and balance with clicks under sales and wishlist under revenue', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
          balance={500}
          revenue={90}
          totalSales={100}
          clicks={42}
          wishlist={7}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/KSh 100/i)).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText(/KSh 90/i)).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText(/KSh 500/i)).toBeInTheDocument();
    expect(screen.getByText('Balance')).toBeInTheDocument();

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('clicks')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('wishlist')).toBeInTheDocument();

    // Verify ordering in DOM: Sales before Revenue before Balance
    const salesLabel = screen.getByText('Sales');
    const revenueLabel = screen.getByText('Revenue');
    const balanceLabel = screen.getByText('Balance');
    expect(salesLabel.compareDocumentPosition(revenueLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(revenueLabel.compareDocumentPosition(balanceLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Verify clicks count and wishlist count are rendered under sales and revenue
    const clicksText = screen.getByText('clicks');
    const wishlistText = screen.getByText('wishlist');
    expect(salesLabel.closest('.grid')).toContainElement(clicksText);
    expect(revenueLabel.closest('.grid')).toContainElement(wishlistText);
  });

  it('arranges clicks, wishlist, shop link button, and metrics on the same row with items-center in desktop mode', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <SellerProfileHero
          sellerProfile={baseProfile}
          shopUsername="eris"
          onCopyShopLink={vi.fn()}
          canEdit={true}
          balance={500}
          revenue={90}
          totalSales={100}
          clicks={42}
          wishlist={7}
        />
      </QueryClientProvider>
    );

    const root = container.firstElementChild;
    expect(root).toHaveClass('md:items-center');

    const shopLinkBtn = screen.getByRole('button', { name: /Shop link/i });
    expect(shopLinkBtn.parentElement).toHaveClass('md:order-7');

    const clicksElement = screen.getByText('clicks').closest('[class*="md:order-5"]');
    expect(clicksElement).toBeInTheDocument();

    const wishlistElement = screen.getByText('wishlist').closest('[class*="md:order-6"]');
    expect(wishlistElement).toBeInTheDocument();
  });
});
