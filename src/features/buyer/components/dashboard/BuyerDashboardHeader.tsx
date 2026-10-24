import { ArrowLeft, UserRound } from '@/shared/ui/icons';
import { AppHeader } from '@/shared/ui/AppHeader';
import { useGlobalAuth } from '@/features/auth/contexts';
import { useNavigate } from 'react-router-dom';

interface BuyerDashboardHeaderProps {
  onOpenProfile: () => void;
}

export function BuyerDashboardHeader({ onOpenProfile }: BuyerDashboardHeaderProps) {
  const { isAuthenticated } = useGlobalAuth();
  const navigate = useNavigate();

  return (
    <AppHeader
      left={
        !isAuthenticated ? (
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to landing page"
            className="flex h-9 items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] px-2.5 text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-white/12 text-xs font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Home</span>
          </button>
        ) : null
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
