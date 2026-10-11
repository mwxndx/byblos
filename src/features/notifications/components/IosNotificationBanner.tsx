import { Bell, Loader2, X } from '@/shared/ui/icons';
import { cn } from '@/shared/utils/formatting';
import type { UserRole } from '@/shared/types';
import { useIosNotificationPermission } from '../hooks/useIosNotificationPermission';

interface IosNotificationBannerProps {
  className?: string;
  role?: UserRole;
}

/**
 * Banner shown exclusively on iOS (Home Screen PWA / WebKit) when push
 * notifications have not yet been granted.
 *
 * Provides a direct, 1-tap user gesture required by iOS to display Apple's
 * native notification permission dialog.
 */
export function IosNotificationBanner({ className, role }: IosNotificationBannerProps) {
  const { shouldShowPrompt, isRequesting, requestPermission, dismissPrompt } = useIosNotificationPermission(role);

  if (!shouldShowPrompt) return null;

  return (
    <div
      role="region"
      aria-label="iOS Notifications Setup"
      className={cn(
        'rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-slate-900 dark:text-white shadow-sm transition-all',
        className ?? 'mx-3 my-2.5'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
          <Bell className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-tight text-slate-950 dark:text-white">
            Enable iOS Notifications
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-white/70">
            Get instant alerts for your orders, courier deliveries, and payments directly on your device.
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void requestPermission()}
              disabled={isRequesting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5C518] px-3 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-300 disabled:opacity-50"
            >
              {isRequesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Requesting…</span>
                </>
              ) : (
                <span>Enable Notifications</span>
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismissPrompt}
          aria-label="Dismiss banner"
          className="shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default IosNotificationBanner;
