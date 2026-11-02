import { ArrowLeft, UserRound } from '@/shared/ui/icons';
import { AppHeader } from '@/shared/ui/AppHeader';
import { useGlobalAuth } from '@/features/auth/contexts';
import { useNavigate } from 'react-router-dom';

interface BuyerDashboardHeaderProps {
  onOpenProfile: () => void;
}

export function BuyerDashboardHeader({ onOpenProfile }: Readonly<BuyerDashboardHeaderProps>) {
  const { isAuthenticated, user } = useGlobalAuth();
  const navigate = useNavigate();

  const buyerProfile = user?.profile as { fullName?: string; email?: string } | undefined;
  const buyerInitial = buyerProfile?.fullName
    ? buyerProfile.fullName.trim().charAt(0).toUpperCase()
    : buyerProfile?.email
      ? buyerProfile.email.trim().charAt(0).toUpperCase()
      : 'A';

  return (
    <AppHeader
      left={
        !isAuthenticated ? (
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to landing page"
            className="flex h-10 items-center gap-1.5 rounded-full border border-slate-200 dark:border-[#34343a] bg-slate-100 dark:bg-[#27272c] px-3 text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-[#34343a] text-xs font-semibold"
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
              ? "flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-[#34343a] bg-slate-100 dark:bg-[#27272c] text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-[#34343a] font-semibold text-sm"
              : "flex h-10 items-center gap-1.5 rounded-full border border-slate-200 dark:border-[#34343a] bg-slate-100 dark:bg-[#27272c] px-3 text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-[#34343a] text-xs font-semibold"
          }
        >
          {isAuthenticated ? (
            <span>{buyerInitial}</span>
          ) : (
            <>
              <UserRound className="h-4 w-4" />
              <span className="text-xs font-semibold pr-0.5">Sign In</span>
            </>
          )}
        </button>
      }
    />
  );
}
