import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardSkeleton } from '../DashboardSkeleton';
import { OrdersLoadingState } from '../OrdersLoadingState';
import { Skeleton } from '../skeleton';
import { Dialog, DialogContent, DialogTitle } from '../dialog';
import { Sheet, SheetContent, SheetTitle } from '../sheet';
import { Toaster } from '../sonner';

vi.mock('@/shared/hooks/useAppTheme', () => ({
  useAppTheme: () => ({ theme: 'dark' }),
}));

describe('Phase 1 Foundation UI Primitives', () => {
  it('DashboardSkeleton uses safe-area top padding, 100dvh, and semantic tokens', () => {
    render(<DashboardSkeleton />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status.className).toContain('min-h-[100dvh]');

    const header = status.querySelector('header');
    expect(header).not.toBeNull();
    expect(header!.className).toContain('pt-safe-top');
    expect(header!.className).toContain('border-separator');
    expect(header!.className).not.toContain('border-white');
  });

  it('OrdersLoadingState uses semantic surface-1 and separator tokens', () => {
    render(<OrdersLoadingState />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    const html = status.innerHTML;
    expect(html).toContain('bg-surface-1');
    expect(html).toContain('border-separator');
    expect(html).not.toContain('bg-[#0a0a0a]');
  });

  it('Skeleton respects prefers-reduced-motion', () => {
    const { container } = render(<Skeleton data-testid="skel" className="h-4 w-4" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('motion-reduce:animate-none');
  });

  it('DialogContent renders accessible close button with mobile-friendly hit target', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test Dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    const closeBtn = screen.getByRole('button', { name: /close/i });
    expect(closeBtn.className).toContain('h-9');
    expect(closeBtn.className).toContain('w-9');
  });

  it('SheetContent side="bottom" constrains height to 90dvh and scrolls cleanly', () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Bottom Sheet</SheetTitle>
        </SheetContent>
      </Sheet>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-h-[90dvh]');
    expect(dialog.className).toContain('overflow-y-auto');

    const closeBtn = screen.getByRole('button', { name: /close/i });
    expect(closeBtn.className).toContain('h-9');
    expect(closeBtn.className).toContain('w-9');
  });

  it('Toaster renders without crashing', () => {
    const { container } = render(<Toaster />);
    expect(container).toBeTruthy();
  });
});

