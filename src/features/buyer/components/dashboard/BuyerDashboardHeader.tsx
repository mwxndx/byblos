import { useRef, useEffect } from 'react';
import { ArrowLeft, ChevronDown, MapPin, Search, UserRound, X } from '@/shared/ui/icons';
import { AppHeader } from '@/shared/ui/AppHeader';
import { useGlobalAuth } from '@/features/auth/contexts';
import { useNavigate } from 'react-router-dom';

interface BuyerDashboardHeaderProps {
  onOpenProfile: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
}

export function BuyerDashboardHeader({
  onOpenProfile,
  isSearchOpen = false,
  onToggleSearch,
  searchQuery = '',
  onSearchQueryChange,
}: Readonly<BuyerDashboardHeaderProps>) {
  const { isAuthenticated } = useGlobalAuth();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  return (
    <div className="sticky top-0 z-50 bg-[var(--bg,#000000)]">
      <AppHeader
        className="[&>div]:py-1 sm:[&>div]:py-1.5 [&_.grid]:min-h-10 sm:[&_.grid]:min-h-11 shadow-none border-b border-[var(--bg,#000000)]"
        left={
          <div className="flex items-center gap-1.5">
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => navigate('/')}
                aria-label="Back to landing page"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-white/12"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}

            {/* Nairobi pill on the left of the header */}
            <div className="relative inline-flex items-center rounded-full border border-slate-200/80 dark:border-white/15 bg-slate-100/80 dark:bg-white/[0.06] text-label">
              <MapPin className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-label-2" aria-hidden="true" />
              <select
                aria-label="City"
                defaultValue="Nairobi"
                disabled
                className="cursor-pointer appearance-none rounded-full bg-transparent py-1 pl-6 pr-5 text-xs font-bold text-slate-900 dark:text-white focus-visible:outline-none disabled:cursor-default"
              >
                <option value="Nairobi" className="bg-white text-slate-900 dark:bg-black dark:text-white">
                  Nairobi
                </option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-label-2" aria-hidden="true" />
            </div>
          </div>
        }
        center={
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-950 dark:text-white">
              Byblos
            </span>
            <button
              type="button"
              onClick={onToggleSearch}
              aria-label={isSearchOpen ? 'Close search' : 'Search products or shops'}
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-slate-600 hover:text-slate-950 dark:text-white/70 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        }
        right={
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label={isAuthenticated ? 'Open profile' : 'Sign in or view profile'}
            className={
              isAuthenticated
                ? 'flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-white/12'
                : 'flex h-8 sm:h-9 items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] px-2.5 text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-white/12'
            }
          >
            <UserRound className={isAuthenticated ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-4 w-4'} />
            {!isAuthenticated && <span className="text-xs font-bold pr-0.5">Sign In</span>}
          </button>
        }
      />

      {/* Expandable search bar when search icon is clicked */}
      {isSearchOpen && (
        <div className="w-full px-4 py-2 border-b border-[var(--bg,#000000)] bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md flex items-center justify-center animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 rounded-xl border border-separator bg-slate-100/90 dark:bg-zinc-900/90 px-3 h-9 w-full max-w-[500px]">
            <Search className="h-4 w-4 text-label-2 shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              aria-label="Search products or shops"
              placeholder="Search products or shops..."
              className="flex-1 bg-transparent border-none outline-none text-label placeholder:text-label-3 text-xs sm:text-sm font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange?.('')}
                className="text-label-3 hover:text-label p-0.5"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
