import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalAuth } from '@/features/auth/hooks/useGlobalAuth';
import { AreaChart, Area,
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { marketingApi, type MarketingOverview, type MarketingRecord } from '../api/marketingApi';
import { StatCard } from '@/shared/ui/stat-card';
import { ChartCard } from '../components/ChartCard';
import { SectionTitle } from '../components/SectionTitle';
import { DashboardSkeleton } from '@/shared/ui/DashboardSkeleton';
import { AppHeader } from '@/shared/ui/AppHeader';

import { useAppTheme } from '@/shared/hooks/useAppTheme';

const COLORS = ['#F5C842', '#E5E5E5', '#737373', '#D4D4D4', '#F59E0B', '#A3A3A3', '#E7E5DF', '#525252'];

interface TooltipPayload {
    name: string;
    value: number | string;
    color: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
    prefix?: string;
    suffix?: string;
}

const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }: CustomTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-surface-1 border border-black/10 dark:border-separator rounded-lg p-3 text-xs shadow-xl text-slate-900 dark:text-white">
            <p className="text-slate-500 dark:text-label-2 mb-2 font-medium">{label}</p>
            {payload.map((entry) => (
                <p key={entry.name} style={{ color: entry.color }} className="mb-0.5 font-medium">
                    {entry.name}: <span className="font-bold">{prefix}{Number(entry.value).toLocaleString()}{suffix}</span>
                </p>
            ))}
        </div>
    );
};

export default function MarketingDashboard() {
    const navigate = useNavigate();
    const { theme } = useAppTheme();
    const isLight = theme === 'light' || (theme === 'system' && typeof window !== 'undefined' && !window.matchMedia('(prefers-color-scheme: dark)').matches);

    const chartTheme = {
        grid: isLight ? 'rgba(0, 0, 0, 0.08)' : '#262626',
        axis: isLight ? '#64748b' : '#9CA3AF',
        tooltip: isLight
            ? { bg: '#ffffff', border: 'rgba(0,0,0,0.1)', text: '#0f172a' }
            : { bg: '#0A0A0A', border: 'rgba(255,255,255,0.1)', text: '#F5F5F5' }
    };
    const { user: globalUser, logout } = useGlobalAuth();
    const [period, setPeriod] = useState<number>(12);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    // Data state
    const [overview, setOverview] = useState<MarketingOverview | null>(null);
    const [gmvTrend, setGmvTrend] = useState<MarketingRecord[]>([]);
    const [userGrowth, setUserGrowth] = useState<MarketingRecord[]>([]);
    const [productMix, setProductMix] = useState<MarketingRecord[] | null>(null);
    const [buyerLocations, setBuyerLocations] = useState<MarketingRecord[]>([]);
    const [sellerLocations, setSellerLocations] = useState<MarketingRecord[]>([]);
    const [topPerfs, setTopPerfs] = useState<MarketingRecord | null>(null);
    const [referrals, setReferrals] = useState<MarketingRecord | null>(null);

    const user = globalUser?.profile || JSON.parse(sessionStorage.getItem('marketing_user') || '{}');

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [ov, gmv, ug, pm, geo, tp, ref] = await Promise.all([
                marketingApi.getOverview(),
                marketingApi.getGmvTrend(period),
                marketingApi.getUserGrowth(period),
                marketingApi.getProductMix(),
                marketingApi.getGeography(),
                marketingApi.getTopPerformers(),
                marketingApi.getReferrals()
            ]);
            const extractArray = (res: unknown): MarketingRecord[] => {
                const r = res as { data?: { data?: unknown } } | undefined;
                const payload = r?.data?.data ?? r?.data;
                return Array.isArray(payload) ? (payload as MarketingRecord[]) : [];
            };

            const extractObject = (res: unknown): MarketingRecord | null => {
                const r = res as { data?: { data?: unknown } } | undefined;
                const payload = r?.data?.data ?? r?.data;
                return payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as MarketingRecord) : null;
            };

            setOverview(extractObject(ov) as MarketingOverview | null);
            setGmvTrend(extractArray(gmv));
            setUserGrowth(extractArray(ug));
            setProductMix(extractArray(pm));

            const geoPayload = (geo as { data?: { data?: unknown } } | undefined)?.data?.data ?? (geo as { data?: unknown } | undefined)?.data;
            if (geoPayload && typeof geoPayload === 'object' && !Array.isArray(geoPayload)) {
                const typedGeo = geoPayload as { buyers?: MarketingRecord[]; sellers?: MarketingRecord[] };
                setBuyerLocations(Array.isArray(typedGeo.buyers) ? typedGeo.buyers : []);
                setSellerLocations(Array.isArray(typedGeo.sellers) ? typedGeo.sellers : []);
            } else if (Array.isArray(geoPayload)) {
                setBuyerLocations(geoPayload as MarketingRecord[]);
                setSellerLocations([]);
            }

            setTopPerfs(extractObject(tp));
            setReferrals(extractObject(ref));
        } catch (err) {
            setError('Failed to load dashboard data. Please refresh.');
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    if (loading) return <DashboardSkeleton />;

    if (error) return (
        <div className="flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-[var(--bg)] p-4">
            <div className="text-red-400 text-center rounded-3xl border border-separator bg-surface-1 p-8 shadow-xl">
                <p>{error}</p>
                <button onClick={fetchAll} className="mt-4 text-yellow-500 underline text-sm">Try again</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-[100svh] overflow-x-hidden bg-[var(--bg)] text-label selection:bg-yellow-500/30">
            <AppHeader
                className="!bg-white border-b border-gray-200"
                left={
                    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                        <img
                            src="/byblos-mark-light.png"
                            alt="Byblos"
                            className="h-7 w-7 sm:h-8 sm:w-8 object-contain shrink-0"
                        />
                        <h1 className="truncate text-sm sm:text-base md:text-lg font-semibold tracking-tight text-black">Marketing<span className="text-yellow-500">.</span></h1>
                    </div>
                }
                right={
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <select
                            value={period}
                            onChange={(e) => setPeriod(Number(e.target.value))}
                            className="cursor-pointer rounded-xl border border-gray-200 bg-white px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-semibold text-gray-800 shadow-sm transition-colors focus:border-yellow-500 focus:outline-none"
                        >
                            <option value={3}>Last 3 Months</option>
                            <option value={6}>Last 6 Months</option>
                            <option value={12}>Last 12 Months</option>
                        </select>
                        <button
                            onClick={async () => {
                                await logout();
                                navigate('/admin/marketing/login');
                            }}
                            className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 shrink-0"
                        >
                            Sign out
                        </button>
                    </div>
                }
            />
            <div className="p-3 sm:p-4 md:p-8 lg:p-12 space-y-6 md:space-y-12">

            {/* Overview Stat Cards */}
            {overview && (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-4 md:gap-6">
                    <StatCard
                        title="Total Registered Users"
                        value={Number(overview.totalUsers || 0).toLocaleString()}
                        trend={overview.userGrowthMoM}
                        label="MoM growth"
                        color="yellow"
                        className="p-3.5 sm:p-5"
                    />
                    <StatCard
                        title="Registered Buyers"
                        value={Number(overview.totalBuyers || 0).toLocaleString()}
                        sub={overview.newBuyersThisMonth !== undefined ? `${overview.newBuyersThisMonth} joined this month` : undefined}
                        color="gray"
                        className="p-3.5 sm:p-5"
                    />
                    <StatCard
                        title="Active Sellers"
                        value={Number(overview.activeSellers || 0).toLocaleString()}
                        sub={`${overview.pendingSellers || 0} pending verification`}
                        color="gray"
                        className="p-3.5 sm:p-5"
                    />
                    <StatCard
                        title="Active Creators"
                        value={Number(overview.activeCreators || 0).toLocaleString()}
                        sub={`KSh ${Number(overview.creatorEarningsTotalKsh || 0).toLocaleString()} paid out`}
                        color="gray"
                        className="p-3.5 sm:p-5"
                    />
                    <StatCard
                        title="Gross Merchandise Value"
                        value={`KSh ${Number((overview.totalGmvCents || 0) / 100).toLocaleString()}`}
                        trend={typeof overview.gmvGrowthMoM === 'number' || typeof overview.gmvGrowthMoM === 'string' ? overview.gmvGrowthMoM : undefined}
                        label="MoM growth"
                        color="yellow"
                        className="p-3.5 sm:p-5 col-span-2 sm:col-span-1 xl:col-span-1"
                    />
                </div>
            )}

            {/* Charts Section 1: GMV & User Growth Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                <ChartCard title="GMV Trend (KSh)" subtitle="Gross merchandise value over time">
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={gmvTrend}>
                            <defs>
                                <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F5C842" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#F5C842" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                            <XAxis dataKey="month" stroke={chartTheme.axis} tick={{ fontSize: 11 }} />
                            <YAxis stroke={chartTheme.axis} tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip prefix="KSh " />} />
                            <Area type="monotone" dataKey="gmvKsh" name="GMV" stroke="#F5C842" fillOpacity={1} fill="url(#gmvGrad)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="User Acquisition" subtitle="New buyer, seller, and creator signups">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={userGrowth}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                            <XAxis dataKey="month" stroke={chartTheme.axis} tick={{ fontSize: 11 }} />
                            <YAxis stroke={chartTheme.axis} tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="buyers" name="Buyers" fill="#F5C842" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="sellers" name="Sellers" fill="#737373" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="creators" name="Creators" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Charts Section 2: Product Mix & Geographic Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {Array.isArray(productMix) && productMix.length > 0 && (
                    <ChartCard title="Product Mix" subtitle="Orders by category">
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={productMix}
                                    dataKey="count"
                                    nameKey="category"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label={({ category }) => category}
                                >
                                    {productMix.map((_entry: MarketingRecord, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {Array.isArray(sellerLocations) && sellerLocations.length > 0 && (
                    <ChartCard title="Top Seller Locations" subtitle="Geographic distribution">
                        <div className="space-y-3 pt-2">
                            {sellerLocations.map((item: MarketingRecord, i: number) => (
                                <div key={String(item.city || i)} className="flex items-center justify-between border-b border-separator pb-2 gap-2">
                                    <span className="text-xs font-medium text-label-2 truncate">{String(item.city || '')}</span>
                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                        <div className="w-16 sm:w-24 bg-white/10 h-2 rounded-full overflow-hidden">
                                            <div className="bg-yellow-400 h-full rounded-full" style={{ width: `${Number(item.percentage || 0)}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-label w-8 sm:w-10 text-right">{Number(item.percentage || 0)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ChartCard>
                )}

                {Array.isArray(buyerLocations) && buyerLocations.length > 0 && (
                    <ChartCard title="Top Buyer Locations" subtitle="Geographic distribution">
                        <div className="space-y-3 pt-2">
                            {buyerLocations.map((item: MarketingRecord, i: number) => (
                                <div key={String(item.city || i)} className="flex items-center justify-between border-b border-separator pb-2 gap-2">
                                    <span className="text-xs font-medium text-label-2 truncate">{String(item.city || '')}</span>
                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                        <div className="w-16 sm:w-24 bg-white/10 h-2 rounded-full overflow-hidden">
                                            <div className="bg-yellow-400 h-full rounded-full" style={{ width: `${Number(item.percentage || 0)}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-label w-8 sm:w-10 text-right">{Number(item.percentage || 0)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ChartCard>
                )}
            </div>

            {/* Section 3: Top Performers & Referrals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                {Array.isArray(topPerfs?.sellers) && (topPerfs.sellers as MarketingRecord[]).length > 0 && (
                    <div className="bg-surface-1 border border-separator rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-xl">
                        <SectionTitle title="Top Performing Shops" subtitle="Highest GMV sellers this month" />
                        <div className="divide-y divide-separator">
                            {(topPerfs.sellers as MarketingRecord[]).map((s: MarketingRecord, idx: number) => (
                                <div key={String(s.id || idx)} className="py-2.5 sm:py-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                        <span className="text-xs font-bold text-yellow-500 w-5 shrink-0">#{idx + 1}</span>
                                        <div className="min-w-0">
                                            <p className="text-xs sm:text-sm font-semibold text-label truncate">{String(s.shopName || s.name || '')}</p>
                                            <p className="text-[11px] sm:text-xs text-label-2 truncate">{String(s.category || 'General')}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs sm:text-sm font-bold text-label shrink-0">KSh {Number(s.gmvKsh || 0).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {Array.isArray(referrals?.creators) && (referrals.creators as MarketingRecord[]).length > 0 && (
                    <div className="bg-surface-1 border border-separator rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-xl">
                        <SectionTitle title="Creator Referrals" subtitle="Top performing creators" />
                        <div className="divide-y divide-separator">
                            {(referrals.creators as MarketingRecord[]).map((c: MarketingRecord, idx: number) => (
                                <div key={String(c.id || idx)} className="py-2.5 sm:py-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                        <span className="text-xs font-bold text-yellow-500 w-5 shrink-0">#{idx + 1}</span>
                                        <div className="min-w-0">
                                            <p className="text-xs sm:text-sm font-semibold text-label truncate">{String(c.name || '')}</p>
                                            <p className="text-[11px] sm:text-xs text-label-2 truncate">{Number(c.referredSellersCount || 0)} sellers invited</p>
                                        </div>
                                    </div>
                                    <span className="text-xs sm:text-sm font-bold text-yellow-400 shrink-0">KSh {Number(c.earnedKsh || 0).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}
