import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/formatting';

interface AppHeaderProps {
  /** Left slot — branding, title, or a leading control. */
  left?: ReactNode;
  /** Optional centered slot. When provided the bar uses a 3-column grid
   *  (leading / centered title / trailing), like the seller "Welcome" header.
   *  When omitted the bar is a simple left/right split. */
  center?: ReactNode;
  /** Right slot — actions (notifications, account switcher, etc.). */
  right?: ReactNode;
  className?: string;
}

/**
 * The single app-wide dashboard header shell, shared by every role (buyer,
 * seller, creator, admin, marketing, mzigo). It owns the things that used to
 * drift per role and caused notch/z-index/height bugs:
 *
 *  - sticky at the top of its scroll container (`top-0 z-50`)
 *  - safe-area / notch handling (`pt-safe-top`)
 *  - one fixed height (`min-h-14 sm:min-h-16` → 56/64px)
 *  - one themed background token (`--bg`, which every theme scope aliases to
 *    `--byblos-bg`, so it resolves correctly in all role scopes)
 *
 * Each role only supplies its own content through the `left` / `center` /
 * `right` slots and keeps its own text styling on those nodes.
 */
export function AppHeader({ left, center, right, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 bg-[var(--bg,#000000)] pt-safe-top transition-colors duration-200',
        className
      )}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {center !== undefined ? (
          <div className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 sm:min-h-16">
            <div className="flex min-w-0 items-center gap-2 justify-self-start">{left}</div>
            <div className="min-w-0 justify-self-center text-center">{center}</div>
            <div className="flex shrink-0 items-center gap-2 justify-self-end">{right}</div>
          </div>
        ) : (
          <div className="flex min-h-14 items-center justify-between gap-3 sm:min-h-16">
            <div className="flex min-w-0 items-center gap-2">{left}</div>
            <div className="flex shrink-0 items-center gap-2">{right}</div>
          </div>
        )}
      </div>
    </header>
  );
}
