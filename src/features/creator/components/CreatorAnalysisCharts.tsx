import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/shared/utils/formatting';
import { money, type AnalysisPeriod, type AnalysisRow, type BusinessEarningRow } from '@/features/creator/utils/creatorDashboardUtils';

interface CreatorAnalysisChartsProps {
  analysis: AnalysisRow[];
  businessEarnings: BusinessEarningRow[];
  analysisPeriod: AnalysisPeriod;
  setAnalysisPeriod: (period: AnalysisPeriod) => void;
}

const PERIODS: AnalysisPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

const axisStroke = 'var(--label-3)';
const gridStroke = 'var(--separator)';
const tooltipStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--separator)',
  color: 'var(--label)',
  borderRadius: 12,
};

export function CreatorAnalysisCharts({ analysis, businessEarnings, analysisPeriod, setAnalysisPeriod }: CreatorAnalysisChartsProps) {
  const [selectedBusiness, setSelectedBusiness] = useState<string>('all');

  const periods = useMemo(() => analysis.map((r) => String(r.period ?? r.month ?? '')), [analysis]);

  const commissionData = useMemo(
    () => analysis.map((r) => ({ period: String(r.period ?? r.month ?? ''), commission: Number(r.commission_earnings ?? 0) })),
    [analysis]
  );

  const businesses = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of businessEarnings) map.set(String(row.seller_id), row.shop_name || `Business ${row.seller_id}`);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [businessEarnings]);

  const businessData = useMemo(() => {
    const byPeriod = new Map<string, number>();
    for (const p of periods) byPeriod.set(p, 0);
    for (const row of businessEarnings) {
      if (selectedBusiness !== 'all' && String(row.seller_id) !== selectedBusiness) continue;
      const p = String(row.period ?? '');
      if (!byPeriod.has(p)) continue;
      byPeriod.set(p, (byPeriod.get(p) || 0) + Number(row.earnings ?? 0));
    }
    return periods.map((p) => ({ period: p, earnings: Number(byPeriod.get(p) || 0) }));
  }, [periods, businessEarnings, selectedBusiness]);

  return (
    <section className="rounded-card border border-separator bg-surface-1 p-4 text-label">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold">Performance</h2>
        <div className="grid grid-cols-4 gap-1 rounded-control bg-fill p-1 text-xs font-medium">
          {PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setAnalysisPeriod(period)}
              className={cn(
                'rounded-[7px] px-2.5 py-1.5 capitalize transition-colors ease-ios',
                analysisPeriod === period ? 'bg-brand text-brand-on' : 'text-label-2 hover:text-label'
              )}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-56 rounded-control border border-separator bg-surface-2 p-3">
        <p className="mb-2 text-xs font-medium text-label-3">Commission earnings</p>
        <ResponsiveContainer width="100%" height="88%">
          <LineChart data={commissionData}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis dataKey="period" stroke={axisStroke} fontSize={11} />
            <YAxis stroke={axisStroke} fontSize={11} />
            <Tooltip formatter={(value) => money(value as number)} contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="commission" name="Commission" stroke="var(--sys-blue)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 h-64 rounded-control border border-separator bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-label-3">Invited-business earnings</p>
          <select
            value={selectedBusiness}
            onChange={(e) => setSelectedBusiness(e.target.value)}
            aria-label="Filter by business"
            className="h-8 rounded-control border border-separator-strong bg-surface-1 px-2 text-xs font-medium text-label focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
          >
            <option value="all">All businesses</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {businesses.length === 0 ? (
          <div className="flex h-[80%] items-center justify-center text-center text-xs font-medium text-label-3">
            Invite a business with your referral link to start earning KSh 3 per sale.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="82%">
            <LineChart data={businessData}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="period" stroke={axisStroke} fontSize={11} />
              <YAxis stroke={axisStroke} fontSize={11} />
              <Tooltip formatter={(value) => money(value as number)} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="earnings" name="Invited-business" stroke="var(--sys-green)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
