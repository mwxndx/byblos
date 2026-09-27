import { BarChart3, Package, ShoppingBag, Users, Wallet, type LucideIcon } from '@/shared/ui/icons';
import type { SellerTabId } from '../types';

type SellerNavTabId = Exclude<SellerTabId, 'settings'>;

const tabIcons: Record<SellerNavTabId, LucideIcon> = {
  overview: BarChart3,
  products: Package,
  orders: ShoppingBag,
  withdrawals: Wallet,
  creators: Users,
};

// Settings/profile is reached from the header profile icon, not the nav.
const tabs: Array<{ id: SellerNavTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'creators', label: 'Creators' },
];

interface SellerDashboardTabsProps {
  activeTab: SellerTabId;
  hasUnreadOrders: boolean;
  pendingCreatorsCount?: number;
  onSelectTab: (tab: SellerTabId) => void;
}

// Fixed bottom navigation, styled identically to the buyer bottom nav
// (BuyerBottomNav): plain icons with a colour-only active state, a dot for
// unread orders and a count pill for pending creators.
export function SellerDashboardTabs({ activeTab, hasUnreadOrders, pendingCreatorsCount = 0, onSelectTab }: SellerDashboardTabsProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--byblos-border,rgba(255,255,255,0.1))] bg-[var(--byblos-surface,#000000)]/95 backdrop-blur transition-colors duration-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Dashboard sections"
    >
      <div className="flex h-14 items-center justify-around px-1">
        {tabs.map(({ id, label }) => {
          const Icon = tabIcons[id];
          const isActive = activeTab === id;
          const showDot = id === 'orders' && hasUnreadOrders;
          const count = id === 'creators' ? pendingCreatorsCount : 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 border-none bg-transparent py-1.5 transition-opacity duration-150 active:scale-95"
            >
              <Icon
                size={18}
                className={isActive ? 'text-[#F5C518]' : 'text-slate-500 transition-colors dark:text-white/50'}
              />
              <span className={`text-[10px] font-semibold transition-colors ${isActive ? 'font-bold text-[#F5C518]' : 'text-slate-500 dark:text-white/50'}`}>
                {label}
              </span>
              {count > 0 ? (
                <span className="absolute top-1 right-[50%] flex h-[15px] min-w-[15px] translate-x-[12px] items-center justify-center rounded-full bg-[#F5C518] px-1 text-[9px] font-semibold text-black shadow-sm">
                  {count > 99 ? '99+' : count}
                </span>
              ) : showDot ? (
                <div className="absolute top-1.5 right-[50%] h-2 w-2 translate-x-[10px] rounded-full bg-[#F5C518] ring-2 ring-black" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
