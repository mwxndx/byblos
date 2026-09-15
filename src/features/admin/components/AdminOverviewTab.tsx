import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { StatCard } from '@/shared/ui/stat-card';
import { AlertTriangle, Package, Store, WalletCards } from 'lucide-react';
import {
  ChartContainer,
  GeoDistributionChart,
  ProductStatusChart,
  RevenueChart,
  SalesChart,
  UserGrowthChart
} from './AdminDashboardCharts';

interface AdminOverviewTabProps {
  dashboardState: {
    analytics?: Record<string, unknown>,
    topShops?: Record<string, unknown>[],
    sellers?: Record<string, unknown>[],
    systemStats?: Record<string, unknown>
  };
  safeFormatDate: (dateString: string | null | undefined, formatStr?: string) => string;
  onShowSellers: () => void;
}

export function AdminOverviewTab({ dashboardState, safeFormatDate, onShowSellers }: AdminOverviewTabProps) {
  const analytics = (dashboardState.analytics ?? {}) as Record<string, unknown>;
  const asChartData = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

  const operatingCards = [
    {
      label: 'Open paid orders',
      value: analytics.activeOrders || 0,
      detail: 'Needs fulfillment or buyer confirmation',
      icon: <Package className="h-4 w-4 text-blue-400" />
    },
    {
      label: 'Pending withdrawals',
      value: analytics.pendingWithdrawals || 0,
      detail: 'Needs payout monitoring',
      icon: <WalletCards className="h-4 w-4 text-emerald-400" />
    },
    {
      label: 'Low stock products',
      value: analytics.lowStockProducts || 0,
      detail: 'Inventory attention',
      icon: <AlertTriangle className="h-4 w-4 text-amber-400" />
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="col-span-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {operatingCards.map(card => {
          const hasActionItems = Number(card.value) > 0;
          return (
            <StatCard
              key={card.label}
              title={card.label}
              value={Number(card.value).toLocaleString()}
              subtitle={card.detail}
              icon={
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${hasActionItems ? 'border-amber-400/30 bg-amber-400/15' : 'border-separator bg-white/[0.04]'}`}>
                  {card.icon}
                </div>
              }
              className={`p-5 shadow-xl transition-colors duration-200 ${hasActionItems ? 'border border-amber-500/30 bg-amber-500/[0.08]' : 'border border-separator bg-surface-1'}`}
              titleClassName={hasActionItems ? 'text-amber-300/80 font-semibold' : 'text-label-3'}
              valueClassName={hasActionItems ? 'text-amber-300 font-semibold' : 'text-label'}
              subtitleClassName={hasActionItems ? 'text-amber-200/80 font-medium' : 'text-label-3'}
            />
          );
        })}
      </div>

      <SalesChart data={asChartData(analytics.salesTrends)} />
      <RevenueChart data={asChartData(analytics.revenueTrends)} />
      <UserGrowthChart data={asChartData(analytics.userGrowth)} />
      <GeoDistributionChart data={asChartData(analytics.geoDistribution)} />
      <ProductStatusChart data={asChartData(analytics.productStatus)} />

      <ChartContainer title="Top Shops" description="Highest client conversion" className="col-span-4 lg:col-span-2">
        <div className="space-y-4 h-full flex flex-col justify-center">
          {dashboardState.topShops?.length ? dashboardState.topShops.slice(0, 3).map((shop: Record<string, unknown>, index: number) => (
            <div key={String(shop.id)} className="flex items-center justify-between p-5 bg-white/[0.03] rounded-[1.5rem] border border-separator hover:bg-white/10 transition-all duration-500 group/shop">
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-semibold italic shadow-inner transition-transform group-hover/shop:scale-110 ${index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                  index === 1 ? 'bg-gray-400/20 text-label-2 border border-gray-400/30' :
                    'bg-orange-800/20 text-orange-600 border border-orange-800/30'
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <p className="text-lg font-bold text-label tracking-tight">{String(shop.shopName || shop.name || '')}</p>
                  <p className="text-[10px] text-label-3 font-semibold uppercase tracking-widest mt-1 opacity-50">{String(shop.name || '')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold text-label tracking-tight tabular-nums group-hover/shop:text-yellow-500 transition-colors">{String(shop.clientCount ?? '')}</p>
                <p className="text-[10px] text-label-3 uppercase font-semibold tracking-widest opacity-50">Clients</p>
              </div>
            </div>
          )) : (
            <p className="text-center text-sm font-semibold text-label-3">No shop conversion data yet</p>
          )}
        </div>
      </ChartContainer>

      <Card className="lg:col-span-4 bg-surface-1 border border-separator rounded-2xl overflow-hidden shadow-xl">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 md:p-8 border-b border-separator bg-white/[0.01] gap-4">
          <div>
            <CardTitle className="text-xl md:text-2xl font-semibold text-label tracking-tight">Recent sellers</CardTitle>
            <CardDescription className="text-xs md:text-sm text-label-2 font-medium">Newest sellers to join</CardDescription>
          </div>
          <Button variant="outline" className="border-separator text-yellow-500 hover:bg-yellow-500 hover:text-black rounded-xl font-semibold uppercase tracking-widest h-12 px-8 transition-all" onClick={onShowSellers}>
            View all
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-fill text-[10px] font-semibold text-label-3 uppercase tracking-widest">
                <tr>
                  <th className="px-5 md:px-10 py-4 md:py-6">Seller</th>
                  <th className="px-5 md:px-10 py-4 md:py-6 text-center hidden sm:table-cell">Status</th>
                  <th className="px-5 md:px-10 py-4 md:py-6 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {(dashboardState.sellers ?? []).slice(0, 5).map((seller: Record<string, unknown>) => (
                  <tr key={String(seller.id)} className="hover:bg-white/[0.02] transition-all group">
                    <td className="px-5 md:px-10 py-4 md:py-6">
                      <div className="flex items-center gap-3 md:gap-5">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-fill flex items-center justify-center border border-separator group-hover:border-yellow-500/30 transition-all">
                          <Store className="w-4 h-4 md:w-5 md:h-5 text-label-3 group-hover:text-yellow-500 transition-all" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm md:text-base font-bold text-label tracking-tight truncate">{String(seller.name || '')}</p>
                          <p className="text-[10px] md:text-xs text-label-2 font-medium italic truncate">{String(seller.email || '')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 md:px-10 py-4 md:py-6 text-center hidden sm:table-cell">
                      <Badge className={`px-3 md:px-5 py-1 rounded-full text-[9px] md:text-[10px] font-semibold uppercase tracking-widest border-none ${seller.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-label-2'}`}>
                        {String(seller.status || '')}
                      </Badge>
                    </td>
                    <td className="px-5 md:px-10 py-4 md:py-6 text-right text-[10px] md:text-sm font-bold text-label-2 tabular-nums">
                      {safeFormatDate(seller.createdAt as string)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
