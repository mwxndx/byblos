import { Skeleton } from '@/shared/ui/skeleton';

/**
 * Modern dashboard loading skeleton matching the updated compact header,
 * action bar, card list, and floating bottom navigation bar.
 */
export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="min-h-[100svh] w-full overflow-x-hidden bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#ffffff)] flex flex-col transition-colors duration-200"
    >
      <span className="sr-only">Loading dashboard…</span>

      {/* Modern Compact Header Skeleton */}
      <header className="sticky top-0 z-40 w-full border-b border-white dark:border-separator/70 bg-white/95 dark:bg-black/95 backdrop-blur-md px-4 py-2 sm:px-6">
        <div className="mx-auto flex h-10 sm:h-11 max-w-[1480px] items-center justify-between">
          <div className="w-8 h-8 sm:w-9 sm:h-9" />
          <Skeleton className="h-5 w-32 sm:w-44 rounded-md" />
          <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-full" />
        </div>
      </header>

      {/* Main Content Area Skeleton */}
      <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 pb-28">
        {/* Action / Search Bar */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Skeleton className="h-10 sm:h-11 w-full sm:max-w-xs rounded-xl" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>

        {/* Content Item Rows / Cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-zinc-950 p-4 shadow-sm"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
                <div className="space-y-2 min-w-0">
                  <Skeleton className="h-4 w-36 sm:w-56 rounded-md" />
                  <Skeleton className="h-3 w-24 sm:w-32 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Skeleton className="h-8 w-16 sm:w-20 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Navigation Bar Skeleton */}
      <div
        className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] h-12 sm:h-13 rounded-2xl sm:rounded-full border border-slate-300 dark:border-white/20 dashboard-floating-nav bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md shadow-xl px-4 flex items-center justify-between"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-6 rounded-md" />
        ))}
      </div>
    </div>
  );
}
