import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SellerDashboardTabs } from '../SellerDashboardTabs';

describe('SellerDashboardTabs', () => {
  it('renders with solid theme background and sticks to bottom without translucency', () => {
    render(
      <SellerDashboardTabs
        activeTab="products"
        hasUnreadOrders={false}
        pendingCreatorsCount={0}
        onSelectTab={vi.fn()}
      />
    );

    const nav = screen.getByRole('navigation', { name: /dashboard sections/i });
    expect(nav).toBeInTheDocument();

    // Sticks to bottom
    expect(nav).toHaveClass('fixed', 'inset-x-0', 'bottom-0', 'z-50');

    // Solid colors for light & dark themes
    expect(nav).toHaveClass('bg-white', 'dark:bg-[#000000]');

    // Must NOT have translucent /95 or backdrop-blur
    expect(nav.className).not.toContain('/95');
    expect(nav.className).not.toContain('backdrop-blur');

    // Safe area bottom inset class is applied
    expect(nav).toHaveClass('pb-safe-bottom');
  });

  it('renders notifications tab next to creators tab with unread count badge', () => {
    render(
      <SellerDashboardTabs
        activeTab="products"
        hasUnreadOrders={false}
        pendingCreatorsCount={0}
        unreadNotificationsCount={5}
        onSelectTab={vi.fn()}
      />
    );

    const creatorsButton = screen.getByRole('button', { name: /Creators/i });
    const notificationsButton = screen.getByRole('button', { name: /Notifications/i });

    expect(creatorsButton).toBeInTheDocument();
    expect(notificationsButton).toBeInTheDocument();
    expect(creatorsButton.compareDocumentPosition(notificationsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Badge showing 5 unread notifications
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
