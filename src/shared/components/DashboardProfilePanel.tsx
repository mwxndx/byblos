import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

interface DashboardProfilePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** Space reserved for a fixed dashboard navigation bar. */
  bottomInset?: string;
  className?: string;
}

/**
 * A profile panel that stays inside a dashboard's content region. Unlike the
 * global Sheet primitive, it does not portal to document.body, so a dashboard
 * header and bottom navigation remain visible and interactive above it.
 *
 * Implements smooth hardware-accelerated slide-in and slide-out transitions
 * with iOS-calibrated easing curves, ensuring no visual glitch or abrupt cutoff
 * across buyer, seller, and creator dashboards.
 */
export function DashboardProfilePanel({
  open,
  onOpenChange,
  title,
  children,
  bottomInset = '0px',
  className,
}: DashboardProfilePanelProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Synchronous presence initialization: when open becomes true, render immediately
  // without triggering a second render in useEffect (which causes animation restart/double-play).
  const [shouldRender, setShouldRender] = useState(open);

  if (open && !shouldRender) {
    setShouldRender(true);
  }

  useEffect(() => {
    if (!open && shouldRender) {
      // 200ms slide-out animation + 20ms buffer before unmounting from DOM
      const timer = window.setTimeout(() => {
        setShouldRender(false);
      }, 220);
      return () => window.clearTimeout(timer);
    }
  }, [open, shouldRender]);

  useEffect(() => {
    if (!open) return;

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    window.addEventListener('keydown', dismissOnEscape);
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', dismissOnEscape);
      previousFocusRef.current?.focus();
    };
  }, [onOpenChange, open]);

  if (!shouldRender && !open) return null;

  const state = open ? 'open' : 'closed';

  return (
    <div
      data-state={state}
      className={cn(
        'dashboard-profile-backdrop absolute inset-x-0 top-0 z-40 flex justify-end overflow-hidden transform-gpu',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
        'data-[state=open]:duration-[280ms] data-[state=closed]:duration-200',
        !open && 'pointer-events-none',
      )}
      style={{ bottom: bottomInset }}
      data-testid="dashboard-profile-panel"
    >
      <button
        type="button"
        aria-label={`Close ${title}`}
        className="absolute inset-0 cursor-default focus:outline-none"
        onClick={() => onOpenChange(false)}
        tabIndex={open ? 0 : -1}
      />
      <aside
        ref={panelRef}
        role="complementary"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-state={state}
        className={cn(
          'relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto overscroll-contain bg-surface-1 text-label shadow-[var(--shadow-pop)] border-l border-separator',
          'transform-gpu will-change-transform [animation-timing-function:var(--ease-ios,cubic-bezier(0.32,0.72,0,1))]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
          'data-[state=open]:duration-[280ms] data-[state=closed]:duration-200',
          className,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-separator bg-surface-1 px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Close ${title}`}
            className="h-9 w-9 shrink-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}
