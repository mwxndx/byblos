import { Bell, Check, Loader2 } from '@/shared/ui/icons';
import { useIosNotificationPermission } from '../hooks/useIosNotificationPermission';

/**
 * Settings / Profile row for iOS push notifications.
 * Rendered exclusively on iOS web/PWA sessions.
 *
 * Provides a dedicated tap target to prompt for notification permissions,
 * or displays current permission status.
 */
export function IosNotificationProfileRow() {
  const { isIos, isSupported, permission, isRequesting, requestPermission, isSafariWithoutNotification } = useIosNotificationPermission();

  if (!isIos || !isSupported) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-separator bg-slate-100/70 dark:bg-white/[0.04] p-3 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-white/70">
          <Bell className="h-3.5 w-3.5 text-[#F5C518]" />
          <span>iOS Push Notifications</span>
        </div>

        {permission === 'granted' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" />
            Enabled
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-600 dark:text-white/70">
          {permission === 'granted' && 'Notifications are active on this device.'}
          {isSafariWithoutNotification && 'Add to Home Screen in Safari to enable push alerts.'}
          {!isSafariWithoutNotification && permission === 'default' && 'Receive alerts for order status, deliveries, and updates.'}
          {permission === 'denied' && (
            <span className="text-amber-600 dark:text-amber-400">
              Blocked. Enable in iOS Settings &gt; Safari / Byblos.
            </span>
          )}
        </div>

        {!isSafariWithoutNotification && permission === 'default' && (
          <button
            type="button"
            onClick={() => void requestPermission()}
            disabled={isRequesting}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#F5C518] px-3 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-300 disabled:opacity-50"
          >
            {isRequesting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Enabling…</span>
              </>
            ) : (
              <span>Enable Alerts</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default IosNotificationProfileRow;
