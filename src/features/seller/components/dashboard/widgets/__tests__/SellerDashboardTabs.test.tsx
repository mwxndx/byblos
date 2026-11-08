import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SellerDashboardTabs } from '../SellerDashboardTabs';

describe('SellerDashboardTabs', () => {
  it('renders as a floating navigation bar with rounded corners and identical fixed width across mobile and desktop', () => {
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

    // Floats above bottom with fixed positioning and centered translation
    expect(nav).toHaveClass('fixed', 'left-1/2', '-translate-x-1/2', 'z-50');

    // Rounded corners
    expect(nav.className).toMatch(/rounded-(2xl|full)/);

    // Identical width on desktop and mobile
    expect(nav).toHaveClass('w-[360px]');
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

  it('renders tab icons with visually hidden labels for accessibility without visible text labels', () => {
    const { container } = render(
      <SellerDashboardTabs
        activeTab="products"
        hasUnreadOrders={false}
        pendingCreatorsCount={0}
        onSelectTab={vi.fn()}
      />
    );

    // Visible text spans should have sr-only class
    const labels = container.querySelectorAll('button span.sr-only');
    expect(labels.length).toBe(5);
    const visibleSpans = container.querySelectorAll('button span:not(.sr-only)');
    expect(visibleSpans.length).toBe(0);
  });
});
