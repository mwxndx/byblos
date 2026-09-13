// Regression test for the buyer self-delete refund-balance guard.
//
// The Google-Play-mandated self-service delete (buyer.controller deleteAccount ->
// Buyer.softDeleteAccount) anonymises the buyer row (nulls the M-Pesa number) and
// deactivates the linked users row. Before the guard it did this unconditionally,
// so a buyer holding refund money — `refunds` (withdrawable) or
// `refund_withdrawal_reserved_balance` (reserved against an in-flight refund
// withdrawal) — could delete their account and strand that money with no recovery
// path once the payout destination was destroyed. This mirrors the seller flow,
// which already blocks deletion while a balance is outstanding.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const Buyer = (await import('../src/domains/commerce/buyers/buyer.model.js')).default;
const { createUser, createBuyer, cleanupBuyer, cleanupUser } = await import('./helpers/factories.js');

const buyerIds = [];
const userIds = [];

async function seedBuyer({ refunds = 0, reserved = 0 } = {}) {
  const user = await createUser({ role: 'buyer' });
  const buyer = await createBuyer({ userId: user.id });
  userIds.push(user.id);
  buyerIds.push(buyer.id);
  await pool.query(
    'UPDATE buyers SET refunds = $1, refund_withdrawal_reserved_balance = $2 WHERE id = $3',
    [refunds, reserved, buyer.id]
  );
  return { user, buyer };
}

async function readBuyerAndUser(buyerId, userId) {
  const b = (await pool.query('SELECT full_name, mobile_payment, refunds FROM buyers WHERE id = $1', [buyerId])).rows[0];
  const u = (await pool.query('SELECT is_active FROM users WHERE id = $1', [userId])).rows[0];
  return { b, u };
}

describe('Buyer.softDeleteAccount — refund-balance guard', () => {
  after(async () => {
    for (const id of buyerIds) await cleanupBuyer(id).catch(() => {});
    for (const id of userIds) await cleanupUser(id).catch(() => {});
  });

  test('rejects deletion while a withdrawable refund balance is outstanding, leaving the account intact', async () => {
    const { user, buyer } = await seedBuyer({ refunds: 500 });

    await assert.rejects(
      Buyer.softDeleteAccount(buyer.id, user.id),
      (err) => {
        assert.match(err.message, /pending refund balance/i);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // The row must NOT have been tombstoned and the user must remain active.
    const { b, u } = await readBuyerAndUser(buyer.id, user.id);
    assert.equal(b.full_name, 'Test Buyer', 'buyer row must be untouched after a blocked delete');
    assert.notEqual(b.mobile_payment, 'deleted', 'M-Pesa number must not be destroyed');
    assert.equal(u.is_active, true, 'user account must stay active');
  });

  test('rejects deletion while refund money is reserved against an in-flight withdrawal', async () => {
    const { user, buyer } = await seedBuyer({ refunds: 0, reserved: 300 });

    await assert.rejects(
      Buyer.softDeleteAccount(buyer.id, user.id),
      (err) => {
        assert.match(err.message, /pending refund balance/i);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    const { b, u } = await readBuyerAndUser(buyer.id, user.id);
    assert.equal(b.full_name, 'Test Buyer', 'buyer row must be untouched after a blocked delete');
    assert.equal(u.is_active, true, 'user account must stay active');
  });

  test('allows deletion when no refund money is attached, tombstoning the row and deactivating the user', async () => {
    const { user, buyer } = await seedBuyer({ refunds: 0, reserved: 0 });

    const result = await Buyer.softDeleteAccount(buyer.id, user.id);
    assert.equal(result, true);

    const { b, u } = await readBuyerAndUser(buyer.id, user.id);
    assert.equal(b.full_name, 'Deleted user', 'buyer row must be tombstoned');
    assert.equal(b.mobile_payment, 'deleted', 'M-Pesa number must be cleared on delete');
    assert.equal(u.is_active, false, 'user account must be deactivated');
  });
});
