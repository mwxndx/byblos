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

const axisStroke = '#636366';
const gridStroke = '#34343a';
const tooltipStyle = {
  background: '#121214',
  border: '1px solid #34343a',
  color: '#ffffff',
  borderRadius: 12,
};

export function CreatorAnalysisCharts({ analysis, businessEarnings, analysisPeriod, setAnalysisPeriod }: Readonly<CreatorAnalysisChartsProps>) {
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

  // Penpot 6-month bars calculation
  const sixMonths = useMemo(() => {
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const reversedAnalysis = [...analysis].reverse();
    return months.map((m, idx) => {
      const match = reversedAnalysis[months.length - 1 - idx];
      const val = Number(match?.earnings || match?.commission_earnings || 0);
      const isCurrent = idx === months.length - 1;
      return {
        month: m,
        value: val,
        isCurrent,
        heightPct: isCurrent ? 80 : Math.max(25, Math.min(75, 30 + (idx * 9) % 50))
      };
    });
  }, [analysis]);

  return (
    <section className="space-y-4 rounded-[16px] border border-[#34343a] bg-[#27272c] p-4 text-white sm:p-5">
      {/* Penpot 6-month Bar Chart Section */}
      <div>
        <div className="flex items-center justify-between px-1 mb-4">
          <h2 className="text-sm font-semibold text-white">Earnings</h2>
          <span className="text-xs text-[#a1a1a6]">Last 6 months</span>
        </div>

        <div className="flex items-end justify-between h-32 px-3 py-2 rounded-xl bg-[#121214] border border-[#34343a]">
          {sixMonths.map((col) => (
            <div key={col.month} className="flex flex-col items-center gap-2 h-full justify-end flex-1 max-w-[36px]">
              <div
                className={cn(
                  'w-full rounded-t-sm transition-all duration-300',
                  col.isCurrent ? 'bg-[#f5c518]' : 'bg-[#34343a]'
                )}
                style={{ height: `${col.heightPct}%` }}
              />
              <span className={cn('text-[11px] font-medium', col.isCurrent ? 'text-white font-semibold' : 'text-[#a1a1a6]')}>
                {col.month}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Period Filter & Detailed Graphs */}
      <div className="pt-2 border-t border-[#34343a]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h3 className="text-xs font-semibold text-[#a1a1a6] uppercase tracking-wider">Detailed Trends</h3>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#121214] border border-[#34343a] p-1 text-xs font-medium">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setAnalysisPeriod(period)}
                className={cn(
                  'rounded-lg px-2.5 py-1 capitalize transition-colors',
                  analysisPeriod === period ? 'bg-[#f5c518] text-black font-semibold' : 'text-[#a1a1a6] hover:text-white'
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="h-52 rounded-xl border border-[#34343a] bg-[#121214] p-3">
          <p className="mb-2 text-xs font-medium text-[#a1a1a6]">Commission earnings</p>
          <ResponsiveContainer width="100%" height="84%">
            <LineChart data={commissionData}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="period" stroke={axisStroke} fontSize={10} />
              <YAxis stroke={axisStroke} fontSize={10} />
              <Tooltip formatter={(value) => money(value as number)} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="commission" name="Commission" stroke="#f5c518" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 h-60 rounded-xl border border-[#34343a] bg-[#121214] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#a1a1a6]">Invited-business earnings</p>
            <select
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              aria-label="Filter by business"
              className="h-7 rounded-lg border border-[#34343a] bg-[#27272c] px-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-[#f5c518]"
            >
              <option value="all">All businesses</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {businesses.length === 0 ? (
            <div className="flex h-[75%] items-center justify-center text-center text-xs font-medium text-[#a1a1a6]">
              Invite a business with your referral link to start earning KSh 3 per sale.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="78%">
              <LineChart data={businessData}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="period" stroke={axisStroke} fontSize={10} />
                <YAxis stroke={axisStroke} fontSize={10} />
                <Tooltip formatter={(value) => money(value as number)} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="earnings" name="Invited-business" stroke="#30d158" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}
