import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuyerBottomNav } from '../BuyerBottomNav';
import { ShoppingBag, Heart, User } from '@/shared/ui/icons';

describe('BuyerBottomNav', () => {
  const items = [
    { key: 'shop' as const, label: 'Shop', Icon: ShoppingBag, path: '/buyer/dashboard' },
    { key: 'wishlist' as const, label: 'Saved', Icon: Heart, path: '/buyer/dashboard/saved' },
    { key: 'profile' as const, label: 'Profile', Icon: User, path: '/buyer/dashboard/profile' },
  ];

  it('renders with solid theme background and sticks to bottom without translucency', () => {
    render(<BuyerBottomNav activeNav="shop" navItems={items} onSelect={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: /buyer navigation/i });
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
