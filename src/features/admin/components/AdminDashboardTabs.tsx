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
    <div className="bg-surface-1 border border-separator rounded-2xl p-1 sticky top-2 z-40">
      <TabsList className="bg-transparent border-0 p-0 h-auto flex flex-nowrap overflow-x-auto no-scrollbar gap-1 touch-pan-x scroll-smooth overscroll-x-contain">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id] ?? 0;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex-shrink-0 md:flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 text-xs md:text-sm font-semibold whitespace-nowrap transition-all
              data-[state=active]:!bg-white data-[state=active]:!text-black data-[state=active]:border data-[state=active]:border-gray-200 data-[state=active]:shadow-sm
              data-[state=inactive]:text-label-2 data-[state=inactive]:hover:text-label data-[state=inactive]:hover:bg-white/10"
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-500 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:border data-[state=active]:border-red-200">
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
