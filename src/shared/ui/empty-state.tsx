import { ReactNode } from 'react';
import { cn } from '@/shared/utils/formatting';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string | ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
  // Lets each caller place the title at the correct depth in its page's
  // heading outline instead of forcing an <h3> everywhere, which risks
  // skipped/duplicated levels since this is reused at varying depths across
  // portals. WCAG 1.3.1 / 2.4.6. Defaults to 3 to preserve current behavior.
  headingLevel?: 2 | 3 | 4;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
  headingLevel = 3,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] text-slate-950 dark:text-white shadow-sm transition-colors duration-200',
        compact && 'py-6 px-4 border-none bg-transparent shadow-none',
        className
      )}
    >
      {icon && (
        <div aria-hidden="true" className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400/15 border border-yellow-400/30 text-yellow-600 dark:text-yellow-400 shadow-sm shrink-0">
          {icon}
        </div>
      )}
      <Heading className="text-base sm:text-lg font-bold text-slate-950 dark:text-white mb-1">
        {title}
      </Heading>
      {description && (
        <div className="text-xs sm:text-sm text-slate-600 dark:text-white/60 max-w-sm mx-auto mb-4 leading-relaxed">
          {description}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
