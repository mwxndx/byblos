import { UserRound } from '@/shared/ui/icons';
import { AppHeader } from '@/shared/ui/AppHeader';

interface SellerDashboardHeaderProps {
  shopName: string;
  onOpenProfile: () => void;
}

export function SellerDashboardHeader({ shopName, onOpenProfile }: Readonly<SellerDashboardHeaderProps>) {
  return (
    <AppHeader
      className="[&>div]:py-1 sm:[&>div]:py-1.5 [&_.grid]:min-h-10 sm:[&_.grid]:min-h-11 shadow-none border-b border-[var(--bg,#000000)]"
      left={<div className="w-8 h-8 sm:w-9 sm:h-9" />}
      center={
        <h1 className="text-sm sm:text-lg font-semibold text-slate-900 dark:text-white tracking-tight truncate">
          {shopName}
        </h1>
      }
      right={
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="Open profile"
          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-white/12"
        >
          <UserRound className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      }
    />
  );
}
