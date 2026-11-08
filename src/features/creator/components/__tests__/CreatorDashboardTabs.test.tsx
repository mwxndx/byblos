import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreatorDashboardTabs } from '../CreatorDashboardTabs';

describe('CreatorDashboardTabs — Floating Navigation Bar', () => {
  it('renders floating navigation bar with 4 sections including notifications', () => {
    const handleSelectTab = vi.fn();
    render(
      <CreatorDashboardTabs
        activeTab="performance"
        shopRequestsCount={2}
        unreadNotificationsCount={5}
        onSelectTab={handleSelectTab}
      />
    );

    const nav = screen.getByRole('navigation', { name: /creator navigation/i });
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('fixed', 'bottom-4', 'sm:bottom-5', 'left-1/2', '-translate-x-1/2', 'z-50');
    expect(nav.className).toContain('w-[360px]');
    expect(nav.className).toContain('rounded-2xl');

    // All 4 tabs present
    expect(screen.getByRole('button', { name: 'Performance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdrawals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shops' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();

    // Badges
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    // Tab selection
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(handleSelectTab).toHaveBeenCalledWith('notifications');
  });

  it('renders nothing when hidden is true', () => {
    const { container } = render(
      <CreatorDashboardTabs
        activeTab="performance"
        onSelectTab={vi.fn()}
        hidden={true}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
