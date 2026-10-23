import { ChevronDown, MapPin, UserRound } from '@/shared/ui/icons';
import { AppHeader } from '@/shared/ui/AppHeader';
import { useGlobalAuth } from '@/features/auth/contexts';

const SUPPORTED_CITIES = ['Nairobi'] as const;

interface BuyerDashboardHeaderProps {
  onOpenProfile: () => void;
}

export function BuyerDashboardHeader({ onOpenProfile }: BuyerDashboardHeaderProps) {
  const cities = SUPPORTED_CITIES;
  const isSingleCity = cities.length <= 1;
  const { isAuthenticated } = useGlobalAuth();

  return (
    <AppHeader
      left={
        // City selector — with a single supported city it renders disabled (null behavior).
        <div className="relative inline-flex items-center rounded-full border border-slate-200 bg-slate-100 text-slate-900 dark:border-separator dark:bg-white/[0.04] dark:text-white">
          <MapPin className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-500 dark:text-white/60" aria-hidden="true" />
          <select
            aria-label="City"
            defaultValue={cities[0]}
            disabled={isSingleCity}
            className="cursor-pointer appearance-none rounded-full bg-transparent py-1.5 pl-7 pr-7 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#f5c518)]/50 disabled:cursor-default"
          >
            {cities.map((city) => (
              <option key={city} value={city} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                {city}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-slate-500 dark:text-white/60" aria-hidden="true" />
        </div>
      }
      right={
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label={isAuthenticated ? 'Open profile' : 'Sign in or view profile'}
          className={
            isAuthenticated
              ? "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-white/12"
              : "flex h-9 items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] px-2.5 text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-white/12"
          }
        >
          <UserRound className={isAuthenticated ? "h-5 w-5" : "h-4 w-4"} />
          {!isAuthenticated && <span className="text-xs font-bold pr-0.5">Sign In</span>}
        </button>
      }
    />
  );
}
