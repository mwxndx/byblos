import { Home, Package, ShoppingBag, Users, Wallet, type LucideIcon } from '@/shared/ui/icons';
import type { SellerTabId } from '../types';

type SellerNavTabId = Exclude<SellerTabId, 'settings'>;

const tabIcons: Record<SellerNavTabId, LucideIcon> = {
  overview: Home,
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

// Fixed bottom navigation matching Penpot design system:
// Solid #27272c container with #34343a border, 62px height,
// gold active states (#f5c518) and muted inactive states (#a1a1a6).
export function SellerDashboardTabs({ activeTab, hasUnreadOrders, pendingCreatorsCount = 0, onSelectTab }: Readonly<SellerDashboardTabsProps>) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#34343a] bg-[#27272c] pb-safe-bottom transition-colors duration-200"
      aria-label="Dashboard sections"
    >
      <div className="flex h-[62px] items-center justify-around px-2 max-w-lg mx-auto">
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
              className="relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-none bg-transparent py-1 transition-transform active:scale-95"
            >
              <Icon
                size={20}
                className={isActive ? 'text-[#f5c518]' : 'text-[#a1a1a6]'}
              />
              <span className={`text-[11px] font-medium transition-colors ${isActive ? 'font-semibold text-[#f5c518]' : 'text-[#a1a1a6]'}`}>
                {label}
              </span>
              {count > 0 ? (
                <span className="absolute top-1.5 right-[50%] flex h-[16px] min-w-[16px] translate-x-[14px] items-center justify-center rounded-full bg-[#f5c518] px-1 text-[9px] font-bold text-black shadow-sm">
                  {count > 99 ? '99+' : count}
                </span>
              ) : showDot ? (
                <div className="absolute top-2 right-[50%] h-2 w-2 translate-x-[12px] rounded-full bg-[#f5c518] ring-2 ring-[#27272c]" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

