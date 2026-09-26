import { TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Activity, RefreshCw, Shield, Store, Truck, UserCircle, UserPlus, WalletCards } from '@/shared/ui/icons';
import type { ComponentType } from 'react';

type TabId = 'overview' | 'withdrawals' | 'refunds' | 'detections' | 'logistics' | 'sellers' | 'creators' | 'buyers';

// Operations first (queues an admin works), then the directory tabs.
const ADMIN_TABS: Array<{ id: TabId; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'withdrawals', label: 'Payouts', icon: WalletCards },
  { id: 'refunds', label: 'Refunds', icon: RefreshCw },
  { id: 'detections', label: 'Detections', icon: Shield },
  { id: 'logistics', label: 'Logistics', icon: Truck },
  { id: 'sellers', label: 'Sellers', icon: Store },
  { id: 'creators', label: 'Creators', icon: UserPlus },
  { id: 'buyers', label: 'Buyers', icon: UserCircle },
];

interface AdminDashboardTabsProps {
  // Pending-work counts per operations tab; a badge shows only when > 0.
  counts?: Partial<Record<TabId, number>>;
}

export function AdminDashboardTabs({ counts = {} }: AdminDashboardTabsProps) {
  return (
    <div className="bg-surface-1 border border-separator rounded-2xl p-1 sticky top-2 z-40 overflow-hidden">
      <TabsList className="bg-transparent border-0 p-0 h-auto flex flex-nowrap overflow-x-auto no-scrollbar gap-1">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id] ?? 0;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex-shrink-0 md:flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 md:px-4 py-2.5 text-xs md:text-sm font-semibold transition-colors
              data-[state=active]:bg-yellow-400 data-[state=active]:text-black
              data-[state=inactive]:text-label-2 data-[state=inactive]:hover:text-label data-[state=inactive]:hover:bg-fill"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-400 data-[state=active]:bg-black/15">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
