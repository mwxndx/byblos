import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { SellerDashboardHeader } from '../SellerDashboardHeader';

vi.mock('@/features/notifications/components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Bell</div>,
}));

describe('SellerDashboardHeader', () => {
  it('renders the shop name as the main center heading', () => {
    const handleOpenProfile = vi.fn();
    render(
      <SellerDashboardHeader
        shopName="Moji Collections"
        onOpenProfile={handleOpenProfile}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Moji Collections' })).toBeInTheDocument();
    expect(screen.queryByText(/Welcome/i)).not.toBeInTheDocument();
  });
});

