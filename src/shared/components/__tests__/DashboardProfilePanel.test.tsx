import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardProfilePanel } from '../DashboardProfilePanel';

describe('DashboardProfilePanel', () => {
  it('stays in its dashboard host and reserves the fixed navigation inset', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <div className="relative h-[600px]">
        <DashboardProfilePanel
          open
          onOpenChange={onOpenChange}
          title="Profile"
          bottomInset="56px"
        >
          <div>Profile content</div>
        </DashboardProfilePanel>
      </div>,
    );

    const panelHost = screen.getByTestId('dashboard-profile-panel');
    expect(panelHost.parentElement).toBe(container.firstElementChild);
    expect(panelHost).toHaveClass('absolute');
    expect(panelHost).toHaveStyle({ bottom: '56px' });
    expect(screen.getByRole('complementary', { name: 'Profile' })).toHaveClass('overflow-y-auto', 'overscroll-contain');
  });

  it('dismisses through its backdrop and Escape key', () => {
    const onOpenChange = vi.fn();
    render(
      <div className="relative h-[600px]">
        <DashboardProfilePanel open onOpenChange={onOpenChange} title="Profile">
          <div>Profile content</div>
        </DashboardProfilePanel>
      </div>,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Close Profile' })[0]);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
  });

  it('restores focus to the control that opened the non-modal panel', () => {
    const onOpenChange = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <div className="relative h-[600px]">
        <DashboardProfilePanel open onOpenChange={onOpenChange} title="Profile">
          <div>Profile content</div>
        </DashboardProfilePanel>
      </div>,
    );

    expect(screen.getByRole('complementary', { name: 'Profile' })).toHaveFocus();
    rerender(<div className="relative h-[600px]" />);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('preserves underlying dashboard content and renders a delineated slide-over drawer on desktop', () => {
    const onOpenChange = vi.fn();
    render(
      <div className="relative h-[800px] w-[1200px]">
        <div data-testid="dashboard-content">
          <h1>Main Dashboard Metrics</h1>
          <p>Sales, orders, and charts</p>
        </div>
        <DashboardProfilePanel open onOpenChange={onOpenChange} title="Profile">
          <div>Profile Settings Content</div>
        </DashboardProfilePanel>
      </div>,
    );

    // Dashboard content remains mounted and visible in DOM alongside the panel
    const dashboardContent = screen.getByTestId('dashboard-content');
    expect(dashboardContent).toBeInTheDocument();
    expect(screen.getByText('Main Dashboard Metrics')).toBeInTheDocument();

    // Profile panel container has the translucent backdrop class for desktop overlay visibility
    const panelHost = screen.getByTestId('dashboard-profile-panel');
    expect(panelHost).toHaveClass('dashboard-profile-backdrop', 'absolute', 'inset-x-0', 'top-0');

    // Drawer aside has crisp border boundary and elevation
    const drawerAside = screen.getByRole('complementary', { name: 'Profile' });
    expect(drawerAside).toHaveClass('border-l', 'border-separator', 'max-w-md');
  });
});
