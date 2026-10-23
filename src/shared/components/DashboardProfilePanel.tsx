import { useEffect, useId, useRef, type ReactNode } from 'react';
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

  useEffect(() => {
    if (!open) return;

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    window.addEventListener('keydown', dismissOnEscape);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', dismissOnEscape);
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-x-0 top-0 z-40 flex justify-end overflow-hidden bg-black/45"
      style={{ bottom: bottomInset }}
      data-testid="dashboard-profile-panel"
    >
      <button
        type="button"
        aria-label={`Close ${title}`}
        className="absolute inset-0 cursor-default"
        onClick={() => onOpenChange(false)}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto overscroll-contain bg-surface-1 text-label shadow-2xl',
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
