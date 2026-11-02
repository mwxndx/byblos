import { useEffect, useState } from 'react';
import { ChevronRight, Clock, Share2, Store, ChevronDown, ChevronUp, Sparkles } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import { money, formatSettlementDate } from '@/features/creator/utils/creatorDashboardUtils';

interface CreatorEarningsHeroProps {
  firstName?: string;
  totalEarnings: number;
  balance: number;
  availableBalance?: number;
  clearingBalance?: number;
  nextAvailableAt?: string | null;
  isClearing?: boolean;
  monthEarnings: number;
  monthSales: number;
  monthClicks: number;
  referralLink: string;
  onCopyLink: () => void;
  onGoToWithdraw: () => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Count up to `target` on mount; snaps straight to it when reduced motion is on. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

/**
 * The creator dashboard's hero — pairs overall creator earnings proof with
 * the permanent seller-referral engine, cash-out quick link, and a single
 * (consolidated) "how it works" explainer.
 */
export function CreatorEarningsHero({
  firstName,
  totalEarnings,
  balance,
  availableBalance,
  clearingBalance,
  nextAvailableAt,
  isClearing,
  monthEarnings,
  monthSales,
  monthClicks,
  referralLink,
  onCopyLink,
  onGoToWithdraw,
}: CreatorEarningsHeroProps) {
  const animatedEarnings = useCountUp(totalEarnings);
  const hasEarnings = totalEarnings > 0;
  const name = firstName || 'Creator';
  const [showExplain, setShowExplain] = useState(false);

  return (
    <div className="space-y-4">
      {/* Penpot Earnings hero card */}
      <section className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-5 text-white sm:p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a1a1a6]">Available balance</p>
          <button
            type="button"
            onClick={onGoToWithdraw}
            className="inline-flex items-center gap-1.5 self-start rounded-md text-xs font-medium text-[#a1a1a6] transition-colors hover:text-white sm:self-auto sm:text-sm"
          >
            {isClearing && (availableBalance ?? 0) === 0 ? (
              <>
                <Clock className="h-3.5 w-3.5 text-sys-blue" />
                <span>Clearing {money(clearingBalance ?? 0)} · Available {nextAvailableAt ? formatSettlementDate(nextAvailableAt) : 'soon'}</span>
              </>
            ) : isClearing && (availableBalance ?? 0) > 0 ? (
              <>
                <span>Available {money(availableBalance ?? 0)} ready</span>
                <span className="text-[#a1a1a6]">({money(clearingBalance ?? 0)} clearing)</span>
              </>
            ) : (
              <span>Balance {money(balance)} ready</span>
            )}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight text-white tabular-nums sm:text-4xl">
            {money(availableBalance ?? balance)}
          </h1>
          {hasEarnings && (
            <span className="text-xs text-[#a1a1a6]">
              Total earned: <span className="text-white font-medium">KSh {Math.round(animatedEarnings).toLocaleString()}</span>
            </span>
          )}
        </div>

        {/* Inset Sub-metrics box */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[#34343a] bg-[#121214] p-3 px-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#a1a1a6]">Clearing (T+2)</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
              {money(clearingBalance ?? 0)}
            </p>
          </div>
          <div className="h-8 w-px bg-[#34343a]" />
          <div className="min-w-0 text-right">
            <p className="text-[11px] font-medium text-[#a1a1a6]">This month</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
              {money(monthEarnings)}
            </p>
          </div>
        </div>

        {/* Withdraw to M-Pesa primary button */}
        <div className="mt-4">
          <button
            type="button"
            onClick={onGoToWithdraw}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-white font-semibold text-black transition-all hover:bg-neutral-200 active:scale-[0.99] shadow-sm"
          >
            Withdraw to M-Pesa
          </button>
        </div>

        {(monthClicks > 0 || monthSales > 0) && (
          <p className="mt-3 text-center text-xs text-[#a1a1a6]">
            {monthClicks.toLocaleString()} clicks · {monthSales.toLocaleString()} sales this month
          </p>
        )}
      </section>

      {/* Seller invite link · lifetime referral */}
      <section className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#121214] border border-[#34343a] text-[#f5c518]">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Seller invite link</h2>
              <p className="mt-0.5 text-xs text-[#a1a1a6]">
                Share with store owners
              </p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-[#f5c518]/15 border border-[#f5c518]/30 px-2.5 py-0.5 text-[11px] font-semibold text-[#f5c518]">
            Permanent attribution
          </span>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[#a1a1a6]">
          KSh 3 per sale, for life. Share with vendors, boutique owners, and entrepreneurs.
        </p>

        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[#34343a] bg-[#121214] p-2 pl-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 truncate text-xs text-white/90 font-mono sm:text-sm" title={referralLink}>{referralLink}</p>
          <Button
            type="button"
            onClick={onCopyLink}
            className="h-8 shrink-0 rounded-lg bg-[#f5c518] hover:bg-[#e0b415] text-black font-semibold px-3 text-xs"
          >
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Copy invite link
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setShowExplain(!showExplain)}
          className="mt-3 flex w-full items-center justify-between text-sm text-[#a1a1a6] transition-colors hover:text-white"
        >
          <span>How it works — two ways to earn</span>
          {showExplain ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showExplain && (
          <div className="mt-4 space-y-4 border-t border-[#34343a] pt-4 text-xs animate-in fade-in duration-200">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { n: '1', t: 'Share with store owners', d: 'Send this link to business owners, wholesalers, or creatives who want to sell online.' },
                { n: '2', t: 'Permanent attribution', d: 'When they open a shop with your code, they stay linked to your creator profile.' },
                { n: '3', t: 'Earn KSh 3 on every sale', d: 'Every product they ever sell pays you KSh 3, with no time limit.' },
              ].map((s) => (
                <div key={s.n} className="rounded-xl border border-[#34343a] bg-[#121214] p-3">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-white">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f5c518] text-[9px] font-semibold text-black">{s.n}</span>
                    {s.t}
                  </div>
                  <p className="leading-relaxed text-[#a1a1a6]">{s.d}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-xl border border-[#34343a] bg-[#121214] p-3.5">
              <p className="flex items-center gap-1.5 font-medium text-white">
                <Sparkles className="h-3.5 w-3.5 text-[#f5c518]" />
                Two ways to earn as a creator
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-[#27272c] border border-[#34343a] p-3">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-white">
                    <Store className="h-3.5 w-3.5 text-[#f5c518]" />
                    Add a seller (this section)
                  </div>
                  <ul className="space-y-1 leading-relaxed text-[#a1a1a6]">
                    <li>Audience: merchants and shop owners.</li>
                    <li>You earn: a fixed KSh 3 on every product they sell.</li>
                    <li>Duration: lifetime, no time limit.</li>
                    <li>Effort: refer once — no need to promote their items.</li>
                  </ul>
                </div>
                <div className="rounded-xl bg-[#27272c] border border-[#34343a] p-3">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-white">
                    <Sparkles className="h-3.5 w-3.5 text-[#30d158]" />
                    Shop collaborations (marketplace below)
                  </div>
                  <ul className="space-y-1 leading-relaxed text-[#a1a1a6]">
                    <li>Audience: shoppers and your social followers.</li>
                    <li>You earn: a commission rate set by the seller (1%–30% per sale).</li>
                    <li>Duration: per approved shop collaboration.</li>
                    <li>Effort: share tracking links and earn on completed orders.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
