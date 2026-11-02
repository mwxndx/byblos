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
 * Uses a clean, basic opacity transition (no slide animations) for instant,
 * smooth, and 100% jank-free appearance across all devices and webviews.
 */
export function DashboardProfilePanel({
  open,
  onOpenChange,
  title,
  children,
  bottomInset = '0px',
  className,
}: Readonly<DashboardProfilePanelProps>) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Synchronous presence initialization: mount immediately when open becomes true
  const [shouldRender, setShouldRender] = useState(open);

  if (open && !shouldRender) {
    setShouldRender(true);
  }

  useEffect(() => {
    if (!open && shouldRender) {
      // 150ms basic transition before unmounting from DOM
      const timer = window.setTimeout(() => {
        setShouldRender(false);
      }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [open, shouldRender]);

  // Lock body scroll while panel is open to prevent background touch-drag and scroll bleed
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

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
        'dashboard-profile-backdrop absolute inset-x-0 top-0 z-40 overflow-hidden transition-opacity duration-150',
        open ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      style={{ bottom: bottomInset }}
      data-testid="dashboard-profile-panel"
    >
      {/* Translucent backdrop overlay */}
      <div
        aria-hidden="true"
        data-state={state}
        className="absolute inset-0 bg-black/40 dark:bg-black/60"
      />

      {/* Backdrop click dismiss button */}
      <button
        type="button"
        aria-label={`Close ${title}`}
        className="absolute inset-0 cursor-default focus:outline-none"
        onClick={() => onOpenChange(false)}
        tabIndex={open ? 0 : -1}
      />

      {/* Drawer aside: basic fade transition without slide animations */}
      <aside
        ref={panelRef}
        role="complementary"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-state={state}
        className={cn(
          'absolute top-0 right-0 z-10 flex h-full w-full max-w-md flex-col overflow-y-auto overscroll-contain bg-surface-1 text-label shadow-[var(--shadow-pop)] border-l border-separator',
          'transition-opacity duration-150 ease-out',
          open ? 'opacity-100' : 'opacity-0',
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
