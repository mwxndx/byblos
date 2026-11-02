import React, { useMemo, useState } from 'react';
import { LogOut, MapPin, PackageCheck, Store, Truck, RefreshCw, UserRound, CheckCircle2, List, ChevronRight } from '@/shared/ui/icons';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Skeleton } from '@/shared/ui/skeleton';
import { RequestCard } from '../components/mzigoDashboard.components';
import { requestStage, type RequestStage } from '../utils/mzigoJourney';
import { useMzigoDashboard } from '../hooks/useMzigoDashboard';
import type { LogisticsRequestCard } from '@/features/logistics/api';

type BottomTab = 'todo' | 'done' | 'account';
type SubFilter = 'all' | 'late';

const STAGES: Array<{ key: RequestStage; title: string; icon: typeof Store }> = [
  { key: 'pickup', title: 'Pick up from seller', icon: Store },
  { key: 'hub', title: 'At the hub', icon: PackageCheck },
  { key: 'deliver', title: 'Deliver to buyer', icon: Truck },
  { key: 'collect', title: 'Ready for collection', icon: MapPin },
];

const MzigoDashboardPage = () => {
  const [activeTab, setActiveTab] = useState<BottomTab>('todo');
  const [subFilter, setSubFilter] = useState<SubFilter>('all');

  const {
    now,
    updatingStatusKey,
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

  // Active requests bucketed by stage
  const stages = useMemo(() => {
    const source = subFilter === 'late' ? todo.filter((r) => r.isOverdue) : todo;
    const buckets: Record<RequestStage, LogisticsRequestCard[]> = { pickup: [], hub: [], deliver: [], collect: [] };
    for (const request of source) buckets[requestStage(request)].push(request);
    return buckets;
  }, [todo, subFilter]);

  const hasStageCards = STAGES.some((stage) => stages[stage.key].length > 0);

  return (
    <main
      className="dashboard-layout mzigo-dashboard min-h-full overflow-x-hidden bg-[#121214] text-white transition-colors duration-200"
      style={{
        height: '100%',
        overflowY: 'auto',
        overscrollBehavior: 'none',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(5.5rem + var(--sab, env(safe-area-inset-bottom, 0px)))',
      } as React.CSSProperties}
    >
      {/* ── Top Bar matching Penpot Mzigo Ego ─────────────────────────────────────────────── */}
      <AppHeader
        left={
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white sm:text-lg">Mzigo Ego</span>
              <span className="inline-flex items-center rounded-full bg-[#f5c518]/15 border border-[#f5c518]/30 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#f5c518]">
                LOGISTICS
              </span>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <NotificationBell variant="logistics" />
            <button
              type="button"
              onClick={() => requestsQuery.refetch()}
              title="Refresh requests"
              aria-label="Refresh requests"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#34343a] bg-[#27272c] text-[#a1a1a6] transition-colors hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="flex h-9 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 text-xs font-semibold text-[#ff5a52] transition hover:bg-red-500/20"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        }
      />

      <section className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
        {/* ── Tab Content: TO DO ─────────── */}
        {activeTab === 'todo' && (
          <div className="space-y-5">
            {/* Sub-filters: All vs Late */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubFilter('all')}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                    subFilter === 'all'
                      ? 'bg-white text-black shadow-sm'
                      : 'border border-[#34343a] bg-[#27272c] text-[#a1a1a6] hover:text-white'
                  }`}
                >
                  All ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSubFilter('late')}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                    subFilter === 'late'
                      ? 'bg-[#f5c518] text-black shadow-sm'
                      : overdueCount > 0
                      ? 'border border-red-500/30 bg-red-500/10 text-[#ff5a52]'
                      : 'border border-[#34343a] bg-[#27272c] text-[#a1a1a6] hover:text-white'
                  }`}
                >
                  Late ({overdueCount})
                </button>
              </div>

              <span className="text-xs text-[#a1a1a6]">
                {activeCount} assigned
              </span>
            </div>

            {/* Queue Cards */}
            {requestsQuery.isLoading ? (
              <div role="status" aria-busy="true" aria-live="polite" className="grid gap-4 lg:grid-cols-2">
                <span className="sr-only">Loading delivery requests…</span>
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} className="h-64 rounded-2xl bg-[#27272c]" />
                ))}
              </div>
            ) : !hasStageCards ? (
              <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-8 text-center text-sm text-[#a1a1a6] shadow-sm">
                {subFilter === 'late'
                  ? 'Nothing is running late right now.'
                  : 'Nothing to do right now. New deliveries appear here automatically.'}
              </div>
            ) : (
              <div className="space-y-6">
                {STAGES.map((stage) => {
                  const cards = stages[stage.key];
                  if (cards.length === 0) return null;
                  const Icon = stage.icon;
                  return (
                    <section key={stage.key} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-[#f5c518]" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">{stage.title}</h2>
                        <span className="rounded-full bg-[#121214] border border-[#34343a] px-2 py-0.5 text-xs text-[#a1a1a6]">
                          {cards.length}
                        </span>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {cards.map((request) => (
                          <RequestCard
                            key={request.id}
                            request={request}
                            tone="border-[#34343a] bg-[#27272c]"
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
          </div>
        )}

        {/* ── Tab Content: DONE ─────────── */}
        {activeTab === 'done' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Completed Deliveries</h2>
              <span className="text-xs text-[#a1a1a6]">{done.length} completed</span>
            </div>

            {done.length === 0 ? (
              <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-8 text-center text-sm text-[#a1a1a6] shadow-sm">
                No completed deliveries yet. Deliveries marked completed will appear here.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {done.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    tone="border-[#34343a] bg-[#27272c]"
                    now={now}
                    onStatusUpdate={handleStatusUpdate}
                    updatingStatusKey={updatingStatusKey}
                    readOnly
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab Content: ACCOUNT (Penpot Mzigo – Account) ─────────── */}
        {activeTab === 'account' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">Account</h2>

            {/* Courier Profile Card */}
            <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#121214] border border-[#34343a] text-xl font-bold text-[#f5c518]">
                  C
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Mzigo Courier Rider</h3>
                  <p className="text-xs text-[#a1a1a6]">rider@mzigoego.co.ke</p>
                  <span className="mt-1.5 inline-flex items-center rounded-full bg-[#30d158]/15 border border-[#30d158]/30 px-2 py-0.5 text-[10px] font-semibold text-[#30d158]">
                    Active Courier
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="overflow-hidden rounded-[16px] border border-[#34343a] bg-[#27272c] shadow-sm">
              <button
                type="button"
                onClick={() => {
                  requestsQuery.refetch();
                  setActiveTab('todo');
                }}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#121214] border border-[#34343a] text-white">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Refresh</h4>
                    <p className="text-xs text-[#a1a1a6]">Reload your delivery requests</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[#a1a1a6]" />
              </button>
            </div>

            {/* Logout Card */}
            <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-4 shadow-sm">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-bold text-[#ff5a52] transition hover:bg-red-500/20"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Penpot Fixed Bottom Nav (Mzigo Ego) ─────────────────────────────────────────── */}
      <nav
        aria-label="Mzigo bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-[62px] items-center justify-around border-t border-[#34343a] bg-[#27272c] px-4"
        style={{ paddingBottom: 'var(--sab, env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('todo')}
          className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
            activeTab === 'todo' ? 'text-[#f5c518]' : 'text-[#a1a1a6] hover:text-white'
          }`}
        >
          <div className="relative">
            <List className="h-5 w-5" />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-[#f5c518]" />
            )}
          </div>
          <span className="text-[11px] font-semibold">To do</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('done')}
          className={`flex flex-col items-center justify-center gap-1 transition-colors ${
            activeTab === 'done' ? 'text-[#f5c518]' : 'text-[#a1a1a6] hover:text-white'
          }`}
        >
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-[11px] font-semibold">Done</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex flex-col items-center justify-center gap-1 transition-colors ${
            activeTab === 'account' ? 'text-[#f5c518]' : 'text-[#a1a1a6] hover:text-white'
          }`}
        >
          <UserRound className="h-5 w-5" />
          <span className="text-[11px] font-semibold">Account</span>
        </button>
      </nav>
    </main>
  );
};

export default MzigoDashboardPage;
