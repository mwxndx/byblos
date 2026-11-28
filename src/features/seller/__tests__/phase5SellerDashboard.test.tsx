import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SellerDashboardHeader } from '../components/dashboard/widgets/SellerDashboardHeader';
import { SellerDashboardTabs } from '../components/dashboard/widgets/SellerDashboardTabs';
import { SellerDashboardErrorState } from '../components/dashboard/widgets/SellerDashboardState';

describe('Phase 5 Seller Dashboard Surfaces', () => {
  it('SellerDashboardHeader uses semantic text-label, border-separator, bg-fill, and expanded touch target', () => {
    render(<SellerDashboardHeader shopName="Test Shop" onOpenProfile={vi.fn()} />);

    const heading = screen.getByRole('heading', { name: 'Test Shop' });
    expect(heading.className).toContain('text-label');

    const profileBtn = screen.getByRole('button', { name: /open profile/i });
    expect(profileBtn.className).toContain('border-separator');
    expect(profileBtn.className).toContain('bg-fill');
    expect(profileBtn.className).toContain('text-label');
    expect(profileBtn.className).toContain('before:-inset-1.5');
  });

  it('SellerDashboardTabs uses semantic bg-surface-1/95 and border-separator tokens', () => {
    render(
      <SellerDashboardTabs
        activeTab="products"
        hasUnreadOrders={false}
        onSelectTab={vi.fn()}
      />
    );

    const nav = screen.getByRole('navigation', { name: /dashboard sections/i });
    expect(nav.className).toContain('bg-surface-1/95');
    expect(nav.className).toContain('border-separator');
    expect(nav.className).not.toContain('bg-[#121212]');
  });

  it('SellerDashboardErrorState uses 100dvh, safe-area padding, and semantic text tokens', () => {
    const { container } = render(
      <SellerDashboardErrorState error="Network timeout" onRetry={vi.fn()} />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('min-h-[100dvh]');
    expect(root.className).toContain('pt-safe-top');
    expect(root.className).toContain('pb-safe-bottom');
    expect(screen.getByText('Unable to load dashboard')).toBeInTheDocument();
  });
});

