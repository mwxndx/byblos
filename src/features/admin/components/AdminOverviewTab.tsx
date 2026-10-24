import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { UploadCloud, Send } from '@/shared/ui/icons';
import {
  ChartContainer,
  GeoDistributionChart,
  ProductStatusChart,
  CategoryDistributionChart,
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
  onOpenBroadcastModal?: () => void;
}

export function AdminOverviewTab({ dashboardState, onOpenBroadcastModal }: AdminOverviewTabProps) {
  const analytics = (dashboardState.analytics ?? {}) as Record<string, unknown>;
  const asChartData = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

  return (
    <div className="space-y-6">
      {/* App Release Management Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-surface-1 rounded-2xl border border-separator shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 shrink-0">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-label">Android Release v1.0.70</h3>
              <Badge className="bg-green-500/10 text-green-400 border-none text-[10px] uppercase font-semibold">
                Active Gate (Code: 70)
              </Badge>
            </div>
            <p className="text-xs text-label-2 mt-0.5">
              Remote force-update gate active. Broadcast FCM push notifications and in-app alerts directly to outdated devices without SSH.
            </p>
          </div>
        </div>
        {onOpenBroadcastModal && (
          <Button
            onClick={onOpenBroadcastModal}
            className="bg-white hover:bg-gray-100 text-black border border-gray-200 font-semibold text-xs sm:text-sm h-10 px-5 rounded-xl flex items-center gap-2 transition-all w-full sm:w-auto justify-center shrink-0 shadow-sm"
          >
            <Send className="h-4 w-4" />
            Broadcast Update
          </Button>
        )}
      </div>

      {/* Analytics */}
      <div>
        <p className="mb-3 text-sm font-semibold text-label-2">Analytics</p>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <SalesChart data={asChartData(analytics.salesTrends)} />
          <RevenueChart data={asChartData(analytics.revenueTrends)} />
          <UserGrowthChart data={asChartData(analytics.userGrowth)} />
          <GeoDistributionChart data={asChartData(analytics.geoDistribution)} />
          <ProductStatusChart data={asChartData(analytics.productStatus)} />
          <CategoryDistributionChart data={asChartData(analytics.categoryDistribution)} />
        </div>
      </div>

      {/* Top Shops — positioned below Product & Category Distribution, showing top 6 */}
      <div>
        <ChartContainer title="Top Shops" description="Highest total sales (Top 6 shops)" className="col-span-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
            {dashboardState.topShops?.length ? dashboardState.topShops.slice(0, 6).map((shop: Record<string, unknown>, index: number) => (
              <div key={String(shop.id || index)} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-separator hover:bg-white/10 transition-all duration-300 group/shop">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-semibold italic shadow-inner shrink-0 ${
                    index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                    index === 1 ? 'bg-gray-400/20 text-label-2 border border-gray-400/30' :
                    index === 2 ? 'bg-orange-800/20 text-orange-600 border border-orange-800/30' :
                    'bg-white/5 text-label-3 border border-separator'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-label tracking-tight truncate">{String(shop.shopName || shop.name || '')}</p>
                    <p className="text-[10px] text-label-3 font-semibold uppercase tracking-widest truncate opacity-50">{String(shop.name || '')}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-semibold text-label tracking-tight tabular-nums group-hover/shop:text-yellow-500 transition-colors">
                    {`KES ${Number(shop.totalSales ?? 0).toLocaleString()}`}
                  </p>
                  <p className="text-[9px] text-label-3 uppercase font-semibold tracking-widest opacity-50">Sales</p>
                </div>
              </div>
            )) : (
              <div className="col-span-full flex items-center justify-center h-40">
                <p className="text-center text-sm font-semibold text-label-3">No shop conversion data yet</p>
              </div>
            )}
          </div>
        </ChartContainer>
      </div>
    </div>
  );
}
