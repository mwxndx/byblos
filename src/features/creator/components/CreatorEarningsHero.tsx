import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronRight, Clock, Share2, Store, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
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
    <section className="rounded-card border border-separator bg-surface-1 p-5 text-label sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-label-2">Creator · {name}</p>

        <button
          type="button"
          onClick={onGoToWithdraw}
          className="inline-flex items-center gap-1.5 self-start rounded-control text-xs font-medium text-label-2 transition-colors hover:text-label sm:self-auto sm:text-sm"
        >
          {isClearing && (availableBalance ?? 0) === 0 ? (
            <>
              <Clock className="h-3.5 w-3.5 text-sys-blue" />
              <span>Clearing {money(clearingBalance ?? 0)} · Available {nextAvailableAt ? formatSettlementDate(nextAvailableAt) : 'soon'}</span>
            </>
          ) : isClearing && (availableBalance ?? 0) > 0 ? (
            <>
              <span>Available {money(availableBalance ?? 0)} ready</span>
              <span className="text-label-3">({money(clearingBalance ?? 0)} clearing)</span>
            </>
          ) : (
            <span>Balance {money(balance)} ready</span>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {hasEarnings ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-label sm:text-3xl">
            You&apos;ve earned <span className="tabular-nums text-brand-text">KSh {Math.round(animatedEarnings).toLocaleString()}</span> so far
          </h1>
          {monthEarnings > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--sys-green)_14%,transparent)] px-2.5 py-1 text-xs font-medium text-sys-green">
              <ArrowUpRight className="h-3.5 w-3.5" />
              +{money(monthEarnings)} this month
            </span>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <h1 className="text-2xl font-semibold tracking-tight text-label sm:text-3xl">{name}, your creator earnings hub</h1>
          <p className="mt-1 text-sm text-label-2">Grow your income by inviting sellers and collaborating with registered shops.</p>
        </div>
      )}

      {(monthClicks > 0 || monthSales > 0) && (
        <p className="mt-2 text-sm text-label-2">{monthClicks.toLocaleString()} clicks · {monthSales.toLocaleString()} sales this month</p>
      )}

      {/* Seller invite link · lifetime referral */}
      <div className="mt-5 rounded-card border border-separator bg-surface-2 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-fill text-brand-text">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-label">Seller invite link</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-label-2">
              KSh 3 per sale, for life. Share with vendors, boutique owners, and entrepreneurs.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-control bg-fill p-1.5 pl-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 truncate text-xs text-label-2 sm:text-sm" title={referralLink}>{referralLink}</p>
          <Button type="button" onClick={onCopyLink} className="h-9 shrink-0 px-4 text-xs">
            <Share2 className="h-3.5 w-3.5" />
            Copy invite link
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setShowExplain(!showExplain)}
          className="mt-3 flex w-full items-center justify-between text-sm text-label-2 transition-colors hover:text-label"
        >
          <span>How it works — two ways to earn</span>
          {showExplain ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showExplain && (
          <div className="mt-4 space-y-4 border-t border-separator pt-4 text-xs animate-in fade-in duration-200">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { n: '1', t: 'Share with store owners', d: 'Send this link to business owners, wholesalers, or creatives who want to sell online.' },
                { n: '2', t: 'Permanent attribution', d: 'When they open a shop with your code, they stay linked to your creator profile.' },
                { n: '3', t: 'Earn KSh 3 on every sale', d: 'Every product they ever sell pays you KSh 3, with no time limit.' },
              ].map((s) => (
                <div key={s.n} className="rounded-control border border-separator bg-surface-1 p-3">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-label">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-semibold text-brand-on">{s.n}</span>
                    {s.t}
                  </div>
                  <p className="leading-relaxed text-label-3">{s.d}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-control border border-separator bg-surface-1 p-3.5">
              <p className="flex items-center gap-1.5 font-medium text-label">
                <Sparkles className="h-3.5 w-3.5 text-brand-text" />
                Two ways to earn as a creator
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-control bg-surface-2 p-3">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-label">
                    <Store className="h-3.5 w-3.5 text-brand-text" />
                    Add a seller (this section)
                  </div>
                  <ul className="space-y-1 leading-relaxed text-label-2">
                    <li>Audience: merchants and shop owners.</li>
                    <li>You earn: a fixed KSh 3 on every product they sell.</li>
                    <li>Duration: lifetime, no time limit.</li>
                    <li>Effort: refer once — no need to promote their items.</li>
                  </ul>
                </div>
                <div className="rounded-control bg-surface-2 p-3">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-label">
                    <Sparkles className="h-3.5 w-3.5 text-sys-green" />
                    Shop collaborations (marketplace below)
                  </div>
                  <ul className="space-y-1 leading-relaxed text-label-2">
                    <li>Audience: shoppers and your social followers.</li>
                    <li>You earn: a percentage commission (5%–20% per sale).</li>
                    <li>Duration: per approved shop collaboration.</li>
                    <li>Effort: share tracking links and earn on completed orders.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
