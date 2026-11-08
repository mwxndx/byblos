import { BellSimple, Store, TrendingUp, Wallet, type LucideIcon } from '@/shared/ui/icons';

export type CreatorTabId = 'performance' | 'withdrawals' | 'shops' | 'notifications';

const tabIcons: Record<CreatorTabId, LucideIcon> = {
  performance: TrendingUp,
  withdrawals: Wallet,
  shops: Store,
  notifications: BellSimple,
};

const tabs: Array<{ id: CreatorTabId; label: string }> = [
  { id: 'performance', label: 'Performance' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'shops', label: 'Shops' },
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
    <nav
      className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] rounded-2xl sm:rounded-full border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md shadow-xl dark:shadow-2xl px-2 py-1.5 transition-colors duration-200"
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
              className={`relative flex flex-1 cursor-pointer items-center justify-center rounded-xl py-2 transition-all duration-150 active:scale-95 ${
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
                <span className="absolute top-1 right-[50%] flex h-[15px] min-w-[15px] translate-x-[12px] items-center justify-center rounded-full bg-white text-black dark:bg-white dark:text-black [data-theme=light]_&:bg-black [data-theme=light]_&:text-white px-1 text-[9px] font-semibold shadow-sm">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
