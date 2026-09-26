import { ArrowLeft, LogOut, MapPin, PackageCheck, RefreshCw, Store, Truck } from '@/shared/ui/icons';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { RequestCard } from '../components/mzigoDashboard.components';
import { requestStage, type RequestStage } from '../utils/mzigoJourney';
import { useMzigoDashboard } from '../hooks/useMzigoDashboard';
import type { LogisticsRequestCard } from '@/features/logistics/api';

const BTN_SECONDARY = 'border border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.05] text-slate-800 dark:text-white hover:bg-black/[0.08] dark:hover:bg-white/10';

type View = 'todo' | 'late' | 'done';

// Ordered by how a courier actually works a package through the day.
const STAGES: Array<{ key: RequestStage; title: string; icon: typeof Store }> = [
  { key: 'pickup', title: 'Pick up from seller', icon: Store },
  { key: 'hub', title: 'At the hub', icon: PackageCheck },
  { key: 'deliver', title: 'Deliver to buyer', icon: Truck },
  { key: 'collect', title: 'Ready for collection', icon: MapPin },
];

const MzigoDashboardPage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('todo');
  const {
    now,
    updatingStatusKey,
    partner,
    dashboard,
    grouped,
    activeCount,
    overdueCount,
    handleLogout,
    handleStatusUpdate,
    requestsQuery,
  } = useMzigoDashboard();

  const todo = useMemo(
    () => (dashboard?.requests || []).filter(
      (request) => !(request.isCompleted || request.status === 'completed' || request.group === 'completed'),
    ),
    [dashboard?.requests],
  );
  const done = grouped.completed;

  // Active requests bucketed by real-world stage, honouring the Late filter.
  const stages = useMemo(() => {
    const source = view === 'late' ? todo.filter((r) => r.isOverdue) : todo;
    const buckets: Record<RequestStage, LogisticsRequestCard[]> = { pickup: [], hub: [], deliver: [], collect: [] };
    for (const request of source) buckets[requestStage(request)].push(request);
    return buckets;
  }, [todo, view]);

  const hasStageCards = STAGES.some((stage) => stages[stage.key].length > 0);

  const FILTERS: Array<{ value: View; label: string; count: number; tone: string }> = [
    { value: 'late', label: 'Late', count: overdueCount, tone: overdueCount > 0 ? 'border-red-400/40 bg-red-400/10 text-red-600 dark:text-red-300' : `${BTN_SECONDARY}` },
    { value: 'todo', label: 'To do', count: activeCount, tone: 'border-yellow-500/30 bg-yellow-400/10 text-yellow-700 dark:text-yellow-300' },
    { value: 'done', label: 'Done', count: done.length, tone: `${BTN_SECONDARY}` },
  ];

  return (
    <main className="dashboard-layout mzigo-light-dashboard min-h-[100svh] overflow-x-hidden bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#f5f5f5)] transition-colors duration-200" style={{ height: '100svh', overflowY: 'auto', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(2rem + var(--sab, 16px))' } as React.CSSProperties}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-black/10 dark:border-separator bg-white/80 dark:bg-black/80 px-4 pb-3 pt-safe-top backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {!isNativeApp() && (
              <button
                type="button"
                onClick={() => navigate('/')}
                aria-label="Home"
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm ${BTN_SECONDARY}`}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-500 dark:text-yellow-400">Mzigo Ego</p>
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{partner?.name || 'Logistics partner'}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => requestsQuery.refetch()}
              aria-label="Refresh"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm ${BTN_SECONDARY}`}
            >
              <RefreshCw size={15} />
            </button>
            <NotificationBell variant="logistics" />
          </div>
        </div>
      </header>

      <section className="w-full px-4 py-5 sm:px-6 lg:px-8">
        {/* ── Status / filter bar (Late · To do · Done) ─────────── */}
        <div className="mb-6 flex gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setView(filter.value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                view === filter.value ? filter.tone : `${BTN_SECONDARY} opacity-80`
              }`}
            >
              {filter.label}
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                view === filter.value ? 'bg-black/10 dark:bg-white/15' : 'bg-black/10 dark:bg-white/10'
              }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Queue ─────────────────────────────────────────────── */}
        {requestsQuery.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-2xl border border-black/10 dark:border-separator bg-slate-100 dark:bg-white/[0.03]" />
            ))}
          </div>
        ) : view === 'done' ? (
          done.length === 0 ? (
            <div className="rounded-2xl border border-black/10 dark:border-separator bg-white dark:bg-white/[0.03] p-6 text-sm text-slate-500 dark:text-white/50 shadow-sm">
              No completed deliveries yet.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {done.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  tone="border-emerald-500/20 bg-emerald-50/30 dark:bg-white/[0.02] shadow-sm"
                  now={now}
                  onStatusUpdate={handleStatusUpdate}
                  updatingStatusKey={updatingStatusKey}
                  readOnly
                />
              ))}
            </div>
          )
        ) : !hasStageCards ? (
          <div className="rounded-2xl border border-black/10 dark:border-separator bg-white dark:bg-white/[0.03] p-6 text-sm text-slate-500 dark:text-white/50 shadow-sm">
            {view === 'late' ? 'Nothing is running late right now.' : 'Nothing to do right now. New deliveries appear here automatically.'}
          </div>
        ) : (
          <div className="space-y-8">
            {STAGES.map((stage) => {
              const cards = stages[stage.key];
              if (cards.length === 0) return null;
              const Icon = stage.icon;
              return (
                <section key={stage.key}>
                  <div className="mb-3 flex items-center gap-2">
                    <Icon size={17} className="text-yellow-500 dark:text-yellow-400" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">{stage.title}</h2>
                    <span className="text-sm text-slate-400 dark:text-white/40">{cards.length}</span>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    {cards.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        tone="border-black/10 dark:border-separator bg-white dark:bg-white/[0.03] shadow-sm"
                        now={now}
                        onStatusUpdate={handleStatusUpdate}
                        updatingStatusKey={updatingStatusKey}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Account ──────────────────────────────────────────── */}
      <section className="w-full px-4 pb-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-300 transition hover:bg-red-500/20"
        >
          <LogOut size={16} />
          Logout
        </button>
      </section>
    </main>
  );
};

export default MzigoDashboardPage;
