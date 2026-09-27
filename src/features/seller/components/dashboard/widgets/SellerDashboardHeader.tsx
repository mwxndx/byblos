import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { UserRound } from '@/shared/ui/icons';
import { AppHeader } from '@/shared/ui/AppHeader';

interface SellerDashboardHeaderProps {
  sellerFirstName: string;
  onOpenProfile: () => void;
}

export function SellerDashboardHeader({ sellerFirstName, onOpenProfile }: SellerDashboardHeaderProps) {
  return (
    <AppHeader
      left={<NotificationBell />}
      center={
        <h1 className="text-sm sm:text-lg font-semibold text-slate-900 dark:text-white tracking-tight truncate">
          Welcome, {sellerFirstName}
        </h1>
      }
      right={
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="Open profile"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-white/12"
        >
          <UserRound className="h-5 w-5" />
        </button>
      }
    />
  );
}
