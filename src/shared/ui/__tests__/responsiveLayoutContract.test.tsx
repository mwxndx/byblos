import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuyerBottomNav } from '@/features/buyer/components/dashboard/BuyerBottomNav';
import { SellerDashboardTabs } from '@/features/seller/components/dashboard/widgets/SellerDashboardTabs';
import { CreatorDashboardTabs } from '@/features/creator/components/CreatorDashboardTabs';
import { Dialog, DialogContent } from '@/shared/ui/dialog';
import { ServiceBookingModal } from '@/features/shop/components/ServiceBookingModal';
import { Home } from '@/shared/ui/icons';

vi.mock('@/shared/utils/modalBackHandler', () => ({
  useModalBackHandler: vi.fn(),
}));

vi.mock('@/shared/components/LocationPicker', () => ({
  default: () => <div data-testid="mock-location-picker" />,
  LocationPicker: () => <div data-testid="mock-location-picker" />,
}));

vi.mock('@/features/auth/hooks/useGlobalAuth', () => ({
  useGlobalAuth: () => ({ user: null, isAuthenticated: false }),
}));

describe('Responsive layout & safe-area contract', () => {
  it('positions BuyerBottomNav, SellerDashboardTabs, and CreatorDashboardTabs above --sab safe area', () => {
    const { container: buyerContainer } = render(
      <BuyerBottomNav
        activeNav="shop"
        navItems={[{ key: 'shop', label: 'Shop', Icon: Home, path: '/buyer' }]}
        onSelect={vi.fn()}
      />
    );
    const { container: sellerContainer } = render(
      <SellerDashboardTabs
        activeTab="products"
        hasUnreadOrders={false}
        onSelectTab={vi.fn()}
      />
    );
    const { container: creatorContainer } = render(
      <CreatorDashboardTabs
        activeTab="performance"
        onSelectTab={vi.fn()}
      />
    );

    const navs = [
      buyerContainer.querySelector('nav'),
      sellerContainer.querySelector('nav'),
      creatorContainer.querySelector('nav'),
    ];

    for (const nav of navs) {
      expect(nav).not.toBeNull();
      expect(nav?.getAttribute('style') || '').toContain('--sab');
    }
  });

  it('includes overflow-y-auto by default on DialogContent so short viewports do not clip', () => {
    render(
      <Dialog open>
        <DialogContent>
          <div>Modal body</div>
        </DialogContent>
      </Dialog>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('overflow-y-auto');
  });

  it('does not downgrade nested location dialog z-index below DialogOverlay (z-[100]) in ServiceBookingModal', () => {
    render(
      <ServiceBookingModal
        isOpen
        onClose={vi.fn()}
        product={{
          id: 1,
          name: 'Haircut',
          price: 1500,
          description: 'Test',
          image_url: '',
          category: 'service',
          aesthetic: 'all',
          stock: 1,
          sellerId: 1,
          productType: 'service',
        }}
        buyerLocation={{ address: 'Nairobi', lat: -1.28, lng: 36.82 }}
        onSaveBuyerLocation={vi.fn().mockResolvedValue(undefined)}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /edit address/i }));
    const dialogs = screen.getAllByRole('dialog');
    const nestedDialog = dialogs[dialogs.length - 1];
    expect(nestedDialog.className).not.toContain('z-[60]');
  });
});

