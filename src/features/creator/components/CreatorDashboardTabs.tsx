import { BellSimple, Store, TrendingUp, Wallet, type LucideIcon } from '@/shared/ui/icons';

export type CreatorTabId = 'performance' | 'withdrawals' | 'shops' | 'notifications';

const tabIcons: Record<CreatorTabId, LucideIcon> = {
  performance: TrendingUp,
  withdrawals: Wallet,
  shops: Store,
  notifications: BellSimple,
};

const tabs: Array<{ id: CreatorTabId; label: string }> = [
  { id: 'shops', label: 'Shops' },
  { id: 'performance', label: 'Performance' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'notifications', label: 'Notifications' },
];

interface CreatorDashboardTabsProps {
  activeTab: CreatorTabId;
  shopRequestsCount?: number;
  unreadNotificationsCount?: number;
  onSelectTab: (tab: CreatorTabId) => void;
  hidden?: boolean;
}

/**
 * Floating bottom navigation bar matching buyer and seller dashboard styles.
 */
export function CreatorDashboardTabs({
  activeTab,
  shopRequestsCount = 0,
  unreadNotificationsCount = 0,
  onSelectTab,
  hidden = false,
}: Readonly<CreatorDashboardTabsProps>) {
  if (hidden) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
        style={{
          height: 'calc(4.25rem + var(--sab, env(safe-area-inset-bottom, 0px)))',
          background: 'linear-gradient(to top, var(--byblos-bg, #000000) 0%, transparent 100%)',
        }}
      />
      <nav
        className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] rounded-[48px] sm:rounded-full border border-separator dashboard-floating-nav bg-surface-1/95 backdrop-blur-md px-2 py-1.5 transition-colors duration-200"
        style={{ bottom: 'calc(0.5rem + var(--sab, env(safe-area-inset-bottom, 0px)))' }}
        aria-label="Creator navigation"
      >
      <div className="flex h-12 sm:h-13 items-center justify-between w-full">
        {tabs.map(({ id, label }) => {
          const Icon = tabIcons[id];
          const isActive = activeTab === id;
          const count =
            id === 'shops'
              ? shopRequestsCount
              : id === 'notifications'
              ? unreadNotificationsCount
              : 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-1 cursor-pointer items-center justify-center rounded-full py-2 transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 active:scale-95 ${
                isActive
                  ? 'text-black dark:text-white font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white'
              }`}
            >
              <Icon
                size={22}
                className={isActive ? 'text-black dark:text-white' : 'text-current transition-colors'}
              />
              <span className="sr-only">{label}</span>

              {count > 0 ? (
                <span className={`absolute top-0 right-[50%] translate-x-[14px] text-[10px] font-bold leading-none ${id === 'notifications' ? 'text-red-600 dark:text-red-500 [data-theme=light]_&:text-red-600 [data-theme=dark]_&:text-red-500' : 'text-black dark:text-white [data-theme=light]_&:text-black [data-theme=dark]_&:text-white'}`}>
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      </nav>
    </>
  );
}

