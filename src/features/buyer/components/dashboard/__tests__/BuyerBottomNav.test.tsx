import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuyerBottomNav } from '../BuyerBottomNav';
import { ShoppingBag, Heart, User } from '@/shared/ui/icons';

describe('BuyerBottomNav — Floating Navigation Bar', () => {
  const items = [
    { key: 'shop' as const, label: 'Shop', Icon: ShoppingBag, path: '/buyer/dashboard' },
    { key: 'wishlist' as const, label: 'Saved', Icon: Heart, path: '/buyer/dashboard/saved' },
    { key: 'profile' as const, label: 'Profile', Icon: User, path: '/buyer/dashboard/profile' },
  ];

  it('renders as a floating navigation bar matching seller dashboard style', () => {
    render(<BuyerBottomNav activeNav="shop" navItems={items} onSelect={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: /buyer navigation/i });
    expect(nav).toBeInTheDocument();

    // Floating bar centered at bottom
    expect(nav).toHaveClass('fixed', 'bottom-4', 'sm:bottom-5', 'left-1/2', '-translate-x-1/2', 'z-50');

    // Fixed width with fluid boundary
    expect(nav.className).toContain('w-[360px]');

    // Rounded pill styling with backdrop blur and distinct border (increased roundness factor of 3)
    expect(nav.className).toContain('rounded-[48px]');
    expect(nav.className).toContain('backdrop-blur-md');
    expect(nav).toHaveClass('border', 'border-slate-300', 'dark:border-white/20', 'dashboard-floating-nav');

    // Labels are sr-only (no visible text under icons)
    const labelSpans = nav.querySelectorAll('span.sr-only');
    expect(labelSpans.length).toBe(3);
  });

  it('renders nothing when hidden is true', () => {
    const { container } = render(
      <BuyerBottomNav activeNav="shop" navItems={items} onSelect={vi.fn()} hidden={true} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
