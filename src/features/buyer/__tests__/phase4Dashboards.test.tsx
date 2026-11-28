import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Store } from '@/shared/ui/icons';
import { BuyerBottomNav } from '../components/dashboard/BuyerBottomNav';
import { CreatorDashboardTabs } from '@/features/creator/components/CreatorDashboardTabs';
import { SellerDashboardTabs } from '@/features/seller/components/dashboard/widgets/SellerDashboardTabs';
import { DashboardSkeleton } from '@/shared/ui/DashboardSkeleton';
import { BuyerOrderDialogs } from '@/features/orders/components/BuyerOrderDialogs';

describe('Phase 4 Buyer & Creator Dashboard Surfaces', () => {
  it('BuyerBottomNav uses semantic surface-1 and separator tokens', () => {
    render(
      <BuyerBottomNav
        activeNav="shop"
        navItems={[{ key: 'shop', label: 'Shops', Icon: Store, path: '/buyer/dashboard' }]}
        onSelect={vi.fn()}
      />
    );
    const nav = screen.getByRole('navigation', { name: /buyer navigation/i });
    expect(nav.className).toContain('bg-surface-1/95');
    expect(nav.className).toContain('border-separator');
    expect(nav.className).not.toContain('bg-[#121212]');
  });

  it('CreatorDashboardTabs uses semantic surface-1 and separator tokens', () => {
    render(
      <CreatorDashboardTabs
        activeTab="shops"
        onSelectTab={vi.fn()}
      />
    );
    const nav = screen.getByRole('navigation', { name: /creator navigation/i });
    expect(nav.className).toContain('bg-surface-1/95');
    expect(nav.className).toContain('border-separator');
    expect(nav.className).not.toContain('bg-[#121212]');
  });

  it('BuyerOrderDialogs cancel and receipt dialogs use semantic surface tokens', () => {
    render(
      <BuyerOrderDialogs
        orders={[{ id: '1', items: [], seller: { shopName: 'Demo' } } as never]}
        currentOrderId="1"
        isConfirming={null}
        isCancelling={null}
        showCancelDialog={true}
        showReceiptDialog={false}
        selectedOrderForDetails={null}
        viewingImage={null}
        onCancelDialogChange={vi.fn()}
        onReceiptDialogChange={vi.fn()}
        onSelectedOrderChange={vi.fn()}
        onViewingImageChange={vi.fn()}
        onCancelOrder={vi.fn()}
        onConfirmReceipt={vi.fn()}
        onConfirmReceiptClick={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('bg-surface-1');
    expect(dialog.className).toContain('border-separator');
    expect(dialog.className).toContain('text-label');
    expect(dialog.className).not.toContain('bg-white dark:bg-surface-1');
  });

  it('floating bottom navs and DashboardSkeleton use 0.5rem bottom offset and 4.25rem soft gradient scrim', () => {
    const expectedBottom = 'calc(0.5rem + var(--sab, env(safe-area-inset-bottom, 0px)))';
    const expectedScrimHeight = 'calc(4.25rem + var(--sab, env(safe-area-inset-bottom, 0px)))';

    const { container: buyerContainer, unmount: unmountBuyer } = render(
      <BuyerBottomNav
        activeNav="shop"
        navItems={[{ key: 'shop', label: 'Shops', Icon: Store, path: '/buyer/dashboard' }]}
        onSelect={vi.fn()}
      />
    );
    const buyerNav = screen.getByRole('navigation', { name: /buyer navigation/i });
    expect(buyerNav.getAttribute('style')).toContain(expectedBottom);
    expect(buyerNav.getAttribute('style')).not.toContain('1.125rem');
    expect(buyerContainer.innerHTML).toContain(expectedScrimHeight);
    expect(buyerContainer.innerHTML).not.toContain('32%');
    unmountBuyer();

    const { container: creatorContainer, unmount: unmountCreator } = render(
      <CreatorDashboardTabs activeTab="shops" onSelectTab={vi.fn()} />
    );
    const creatorNav = screen.getByRole('navigation', { name: /creator navigation/i });
    expect(creatorNav.getAttribute('style')).toContain(expectedBottom);
    expect(creatorContainer.innerHTML).toContain(expectedScrimHeight);
    expect(creatorContainer.innerHTML).not.toContain('32%');
    unmountCreator();

    const { container: sellerContainer, unmount: unmountSeller } = render(
      <SellerDashboardTabs activeTab="products" hasUnreadOrders={false} onSelectTab={vi.fn()} />
    );
    const sellerNav = screen.getByRole('navigation', { name: /dashboard sections/i });
    expect(sellerNav.getAttribute('style')).toContain(expectedBottom);
    expect(sellerContainer.innerHTML).toContain(expectedScrimHeight);
    expect(sellerContainer.innerHTML).not.toContain('32%');
    unmountSeller();

    const { container: skelContainer } = render(<DashboardSkeleton />);
    expect(skelContainer.innerHTML).toContain(expectedBottom);
    expect(skelContainer.innerHTML).toContain(expectedScrimHeight);
    expect(skelContainer.innerHTML).not.toContain('32%');
  });
});

