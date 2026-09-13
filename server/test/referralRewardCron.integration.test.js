// Regression test for processMonthlyReferralRewards per-row transaction isolation.
//
// The cron used to wrap its whole loop in one BEGIN..COMMIT, so a single failing
// row rolled back every seller's reward for the run (and held a write lock on
// every credited seller until the final COMMIT) — even though the
// ON CONFLICT DO NOTHING idempotency key was designed for per-row retries. The fix
// commits each referral in its own transaction. These tests pin (A) that every
// valid referral is credited and a re-run is idempotent, and (B) that one poison
// row fails in isolation while a good row in the same run still commits — the
// exact property the batch transaction broke.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const ReferralService = (await import('../src/domains/growth/referrals/referral.service.js')).default;
const { createSeller, createBuyer, createCompletedOrder, cleanupSeller, cleanupBuyer, cleanupOrder } = await import('./helpers/factories.js');

const YEAR = 2026;
const MONTH = 1; // January 2026
const PAID_AT = '2026-01-15T00:00:00.000Z';       // inside [periodStart, periodEnd)
const ACTIVE_UNTIL = '2026-02-01T00:00:00.000Z';   // >= periodStart and >= paid_at
const REWARD_PER_PRODUCT = 3;
const NUMERIC_12_2_MAX = '9999999999.99'; // sellers.balance is numeric(12,2)

const sellerIds = [];
const buyerIds = [];
const orderIds = [];

async function seedReferral({ units, referrerBalance = 0 }) {
  const referrer = await createSeller({});
  const referred = await createSeller({});
  const buyer = await createBuyer({});
  sellerIds.push(referrer.id, referred.id);
  buyerIds.push(buyer.id);
  await pool.query(
    'UPDATE sellers SET referred_by_seller_id = $1, referral_active_until = $2 WHERE id = $3',
    [referrer.id, ACTIVE_UNTIL, referred.id]
  );
  await pool.query('UPDATE sellers SET balance = $1 WHERE id = $2', [referrerBalance, referrer.id]);
  const order = await createCompletedOrder({
    buyerId: buyer.id, sellerId: referred.id, totalAmount: 100, sellerPayoutAmount: 90, totalQuantity: units
  });
  // createCompletedOrder does not set paid_at, which the cron filters on.
  await pool.query('UPDATE product_orders SET paid_at = $1 WHERE id = $2', [PAID_AT, order.id]);
  orderIds.push(order.id);
  return { referrer, referred };
}

async function balanceOf(sellerId) {
  const { rows } = await pool.query('SELECT balance FROM sellers WHERE id = $1', [sellerId]);
  return Number(rows[0].balance);
}
async function logCount(referrerId, referredId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM referral_earnings_log WHERE referrer_seller_id = $1 AND referred_seller_id = $2',
    [referrerId, referredId]
  );
  return rows[0].n;
}

describe('processMonthlyReferralRewards — per-row transaction isolation', () => {
  after(async () => {
    if (sellerIds.length) {
      await pool.query('DELETE FROM referral_earnings_log WHERE referrer_seller_id = ANY($1) OR referred_seller_id = ANY($1)', [sellerIds]);
    }
    for (const id of orderIds) await cleanupOrder(id).catch(() => {});
    for (const id of sellerIds) await cleanupSeller(id).catch(() => {});
    for (const id of buyerIds) await cleanupBuyer(id).catch(() => {});
  });

  test('credits every valid referral and is idempotent on re-run', async () => {
    const a = await seedReferral({ units: 2 });
    const b = await seedReferral({ units: 5 });

    const r1 = await ReferralService.processMonthlyReferralRewards(YEAR, MONTH);
    // Only assert on our own referrals — the shared DB may hold others.
    assert.equal(await logCount(a.referrer.id, a.referred.id), 1);
    assert.equal(await logCount(b.referrer.id, b.referred.id), 1);
    assert.equal(await balanceOf(a.referrer.id), 2 * REWARD_PER_PRODUCT); // 6
    assert.equal(await balanceOf(b.referrer.id), 5 * REWARD_PER_PRODUCT); // 15
    assert.ok(r1.processed >= 2 && r1.failed === 0, 'both processed, none failed');

    // Re-run: ON CONFLICT DO NOTHING makes it a no-op for these rows.
    await ReferralService.processMonthlyReferralRewards(YEAR, MONTH);
    assert.equal(await logCount(a.referrer.id, a.referred.id), 1, 'no duplicate log row');
    assert.equal(await balanceOf(a.referrer.id), 6, 'balance not double-credited');
    assert.equal(await balanceOf(b.referrer.id), 15, 'balance not double-credited');
  });

  test('a poison row fails in isolation while a good row in the same run still commits', async () => {
    const good = await seedReferral({ units: 2 });
    // Poison: referrer balance at the numeric(12,2) ceiling, so `balance + reward`
    // overflows on the credit UPDATE — a real, deterministic per-row DB error.
    const poison = await seedReferral({ units: 1, referrerBalance: NUMERIC_12_2_MAX });

    const result = await ReferralService.processMonthlyReferralRewards(YEAR, MONTH);

    // The good row committed independently...
    assert.equal(await logCount(good.referrer.id, good.referred.id), 1, 'good row must be credited');
    assert.equal(await balanceOf(good.referrer.id), 2 * REWARD_PER_PRODUCT, 'good referrer credited KES 6');
    // ...the poison row rolled back only itself.
    assert.equal(await logCount(poison.referrer.id, poison.referred.id), 0, 'poison row must not be logged');
    assert.equal(await balanceOf(poison.referrer.id), Number(NUMERIC_12_2_MAX), 'poison referrer balance unchanged');
    assert.ok(result.failed >= 1, 'the poison row is reported as failed');
    assert.ok(result.processed >= 1, 'the good row is still processed');
  });
});
