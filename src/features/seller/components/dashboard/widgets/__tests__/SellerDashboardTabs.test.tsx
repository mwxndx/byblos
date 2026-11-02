import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SellerDashboardTabs } from '../SellerDashboardTabs';

describe('SellerDashboardTabs', () => {
  it('renders with solid theme background and sticks to bottom without translucency', () => {
    render(
      <SellerDashboardTabs
        activeTab="overview"
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
});
