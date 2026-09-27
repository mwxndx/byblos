import { BarChart3, Package, Settings, ShoppingBag, Users, Wallet } from '@/shared/ui/icons';
import type { SellerTabId } from '../types';

const tabIcons = {
  overview: BarChart3,
  products: Package,
  orders: ShoppingBag,
  withdrawals: Wallet,
  creators: Users,
  settings: Settings
};

const tabs: Array<{ id: SellerTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'creators', label: 'Creators' },
  { id: 'settings', label: 'Settings' },
];

interface SellerDashboardTabsProps {
  activeTab: SellerTabId;
  hasUnreadOrders: boolean;
  pendingCreatorsCount?: number;
  onSelectTab: (tab: SellerTabId) => void;
}

// The seller tabs live in a fixed bottom navigation bar (icons + small labels),
// the same on web and the native app. It is `fixed`, so it never pushes or
// overlaps page content — the dashboard adds matching bottom padding (see
// SellerDashboard) so the last items stay above the bar.
export function SellerDashboardTabs({ activeTab, hasUnreadOrders, pendingCreatorsCount = 0, onSelectTab }: SellerDashboardTabsProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--byblos-border,rgba(255,255,255,0.1))] bg-[var(--byblos-surface,#0a0a0a)]/95 backdrop-blur shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Dashboard sections"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-around px-1 py-1.5">
        {tabs.map(({ id, label }) => {
          const Icon = tabIcons[id];
          const selected = activeTab === id;

          return (
            <button
              key={id}
              onClick={() => onSelectTab(id)}
              aria-label={label}
              aria-current={selected ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center py-1.5 px-0.5 transition-all duration-200 ${
                selected
                  ? 'text-[var(--theme-accent,#facc15)] font-bold'
                  : 'text-[var(--byblos-muted,#999999)] hover:text-[var(--byblos-text,#ffffff)] font-medium'
              }`}
            >
              <span
                className={`relative flex items-center justify-center rounded-full px-3 py-1 transition-all duration-200 ${
                  selected ? 'bg-[var(--theme-accent,#facc15)]/15 scale-105' : ''
                }`}
              >
                <Icon className="h-5 w-5" />
                {id === 'orders' && hasUnreadOrders && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--byblos-surface,#0a0a0a)] bg-red-500 animate-pulse" />
                )}
                {id === 'creators' && pendingCreatorsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--byblos-surface,#0a0a0a)] bg-yellow-400 animate-pulse" />
                )}
              </span>
              <span className="mt-1 text-[10px] leading-tight tracking-tight truncate max-w-full text-center">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
