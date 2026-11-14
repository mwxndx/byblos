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
  hidden?: boolean;
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
  hidden = false,
}: Readonly<SellerDashboardTabsProps>) {
  if (hidden) return null;

  return (
    <nav
      className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] rounded-[48px] sm:rounded-full border border-slate-300 dark:border-white/20 dashboard-floating-nav bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md px-2 py-1.5 transition-colors duration-200"
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
              className={`relative flex flex-1 cursor-pointer items-center justify-center rounded-full py-2 transition-all duration-150 active:scale-95 ${
                isActive ? 'text-black dark:text-white font-bold' : 'text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white'
              }`}
            >
              <Icon
                size={22}
                weight={isActive ? "fill" : "regular"}
                className={isActive ? 'text-black dark:text-white' : 'text-current transition-colors'}
              />
              <span className="sr-only">
                {label}
              </span>

              {count > 0 ? (
                <span className={`absolute top-0 right-[50%] translate-x-[14px] text-[10px] font-bold leading-none ${id === 'notifications' ? 'text-red-600 dark:text-red-500 [data-theme=light]_&:text-red-600 [data-theme=dark]_&:text-red-500' : 'text-black dark:text-white [data-theme=light]_&:text-black [data-theme=dark]_&:text-white'}`}>
                  {count > 99 ? '99+' : count}
                </span>
              ) : showDot ? (
                <div className="absolute top-1.5 right-[50%] h-1.5 w-1.5 translate-x-[10px] rounded-full bg-black dark:bg-white [data-theme=light]_&:bg-black [data-theme=dark]_&:bg-white" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
