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
    expect(screen.getByRole('dialog', { name: 'Profile' })).toHaveClass('overflow-y-auto', 'overscroll-contain');
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
});
