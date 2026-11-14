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

    // Identical width on desktop and mobile with distinct light/dark border
    expect(nav).toHaveClass('w-[360px]');
    expect(nav).toHaveClass('border', 'border-slate-300', 'dark:border-white/20', 'dashboard-floating-nav');
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

  it('hides the floating nav bar when hidden prop is true', () => {
    const { container } = render(
      <SellerDashboardTabs
        activeTab="products"
        hasUnreadOrders={false}
        pendingCreatorsCount={0}
        onSelectTab={vi.fn()}
        hidden={true}
      />
    );

    expect(container.querySelector('nav')).toBeNull();
  });

  it('uses transition-colors instead of transition-all to prevent position animation', () => {
    render(
      <SellerDashboardTabs
        activeTab="products"
        hasUnreadOrders={false}
        pendingCreatorsCount={0}
        onSelectTab={vi.fn()}
      />
    );

    const nav = screen.getByRole('navigation', { name: /dashboard sections/i });
    expect(nav).toHaveClass('transition-colors');
    expect(nav.className).not.toContain('transition-all');
  });
});
