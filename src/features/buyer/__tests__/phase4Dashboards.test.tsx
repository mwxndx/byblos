import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Store } from '@/shared/ui/icons';
import { BuyerBottomNav } from '../components/dashboard/BuyerBottomNav';
import { CreatorDashboardTabs } from '@/features/creator/components/CreatorDashboardTabs';
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
});

