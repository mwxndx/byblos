import { Skeleton } from '@/shared/ui/skeleton';

/**
 * Generic dashboard loading skeleton: a themed surface with a hero bar, a row of
 * stat tiles and two content panels. Shared by the creator, admin and marketing
 * dashboards so every role speaks the same pulse-based loading language — no
 * spinners, and the container carries the theme background so there is no
 * whitish flash before the real content mounts.
 */
export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="min-h-[100svh] w-full overflow-x-hidden bg-[var(--bg)] px-4 py-5 transition-colors duration-200 sm:px-6 lg:px-8"
    >
      <span className="sr-only">Loading dashboard…</span>

      {/* Hero */}
      <Skeleton className="mb-6 h-28 w-full rounded-3xl sm:h-32" />

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>

      {/* Panels */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
