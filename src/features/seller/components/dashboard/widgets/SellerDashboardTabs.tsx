import { BellSimple, Receipt, Tote, UsersThree, Wallet, type LucideIcon } from '@/shared/ui/icons';
import type { SellerTabId } from '../types';

type SellerNavTabId = Exclude<SellerTabId, 'settings'>;

const tabIcons: Record<SellerNavTabId, LucideIcon> = {
  products: Tote,
  orders: Receipt,
  withdrawals: Wallet,
  creators: UsersThree,
  notifications: BellSimple,
};

// Settings/profile is reached from the header profile icon, not the nav.
const tabs: Array<{ id: SellerNavTabId; label: string }> = [
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'creators', label: 'Creators' },
  { id: 'notifications', label: 'Notifications' },
];

interface SellerDashboardTabsProps {
  activeTab: SellerTabId;
  hasUnreadOrders: boolean;
  pendingCreatorsCount?: number;
  unreadNotificationsCount?: number;
  onSelectTab: (tab: SellerTabId) => void;
}

/**
 * Floating bottom navigation bar with rounded corners and identical fixed width
 * across both desktop and mobile viewports.
 */
export function SellerDashboardTabs({
  activeTab,
  hasUnreadOrders,
  pendingCreatorsCount = 0,
  unreadNotificationsCount = 0,
  onSelectTab,
}: Readonly<SellerDashboardTabsProps>) {
  return (
    <nav
      className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] rounded-2xl sm:rounded-full border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md shadow-xl dark:shadow-2xl px-2 py-1.5 transition-all duration-200"
      aria-label="Dashboard sections"
    >
      <div className="flex h-12 sm:h-13 items-center justify-between w-full">
        {tabs.map(({ id, label }) => {
          const Icon = tabIcons[id];
          const isActive = activeTab === id;
          const showDot = id === 'orders' && hasUnreadOrders;
          const count =
            id === 'creators'
              ? pendingCreatorsCount
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
              className={`relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-all duration-150 active:scale-95 ${
                isActive ? 'text-black dark:text-white font-bold' : 'text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white'
              }`}
            >
              <Icon
                size={18}
                weight={isActive ? "fill" : "regular"}
                className={isActive ? 'text-black dark:text-white' : 'text-current transition-colors'}
              />
              <span
                className={`text-[10px] font-semibold transition-colors ${
                  isActive ? 'font-bold text-black dark:text-white' : 'text-slate-500 dark:text-white/50'
                }`}
              >
                {label}
              </span>

              {count > 0 ? (
                <span className="absolute top-0.5 right-[50%] flex h-[15px] min-w-[15px] translate-x-[13px] items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black px-1 text-[9px] font-semibold shadow-sm">
                  {count > 99 ? '99+' : count}
                </span>
              ) : showDot ? (
                <div className="absolute top-1 right-[50%] h-2 w-2 translate-x-[10px] rounded-full bg-black dark:bg-white ring-2 ring-white dark:ring-[#121212]" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
