// Regression test for the seller self-delete money guard.
//
// softDeleteSeller tombstones the seller row (status='deleted', identity fields
// nulled) and deactivates the linked users row, so a deleted seller can no longer
// authenticate to withdraw. The original guard only blocked while the immediately
// -available `balance` was > 0, ignoring two other columns that also represent
// money owed to the seller:
//   - pending_settlement_balance: escrow earned but still in the T+2 clearing hold
//     (becomes withdrawable `balance` once the settlement job runs)
//   - withdrawal_reserved_balance: funds reserved against a withdrawal already in
//     flight (a failed payout refunds them to `balance`)
// A seller could delete while either was > 0 and strand that money. This test pins
// the guard to all three. (refund_reserved_balance is intentionally NOT a blocker:
// it funds a buyer-refund obligation processed without the seller authenticating.)
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const { softDeleteSeller } = await import('../src/domains/commerce/sellers/seller.model.js');
const { createUser, createSeller, cleanupSeller, cleanupUser } = await import('./helpers/factories.js');

const sellerIds = [];
const userIds = [];

async function seedSeller({ balance = 0, pending = 0, reserved = 0, refundReserved = 0 } = {}) {
  const user = await createUser({ role: 'seller' });
  const seller = await createSeller({ userId: user.id });
  userIds.push(user.id);
  sellerIds.push(seller.id);
  await pool.query(
    `UPDATE sellers SET balance = $1, pending_settlement_balance = $2,
       withdrawal_reserved_balance = $3, refund_reserved_balance = $4 WHERE id = $5`,
    [balance, pending, reserved, refundReserved, seller.id]
  );
  return { user, seller };
}

async function readSellerAndUser(sellerId, userId) {
  const s = (await pool.query('SELECT status, full_name FROM sellers WHERE id = $1', [sellerId])).rows[0];
  const u = (await pool.query('SELECT is_active FROM users WHERE id = $1', [userId])).rows[0];
  return { s, u };
}

async function assertBlocked(seller, user) {
  await assert.rejects(
    softDeleteSeller(seller.id, user.id),
    (err) => {
      assert.match(err.message, /still has funds|withdraw your balance/i);
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
  const { s, u } = await readSellerAndUser(seller.id, user.id);
  assert.notEqual(s.status, 'deleted', 'seller row must not be tombstoned after a blocked delete');
  assert.equal(s.full_name, 'Test Seller', 'seller identity must be untouched after a blocked delete');
  assert.equal(u.is_active, true, 'user account must stay active');
}

describe('softDeleteSeller — money guard', () => {
  after(async () => {
    for (const id of sellerIds) await cleanupSeller(id).catch(() => {});
    for (const id of userIds) await cleanupUser(id).catch(() => {});
  });

  test('rejects deletion while available balance is outstanding', async () => {
    const { user, seller } = await seedSeller({ balance: 500 });
    await assertBlocked(seller, user);
  });

  test('rejects deletion while escrow is still clearing (pending_settlement_balance)', async () => {
    const { user, seller } = await seedSeller({ pending: 400 });
    await assertBlocked(seller, user);
  });

  test('rejects deletion while a withdrawal is in flight (withdrawal_reserved_balance)', async () => {
    const { user, seller } = await seedSeller({ reserved: 300 });
    await assertBlocked(seller, user);
  });

  test('allows deletion when only a refund reserve is held (not money owed to the seller)', async () => {
    // refund_reserved_balance is a buyer-refund obligation, not stranded by deletion.
    const { user, seller } = await seedSeller({ refundReserved: 250 });
    const result = await softDeleteSeller(seller.id, user.id);
    assert.equal(result, true);
    const { s, u } = await readSellerAndUser(seller.id, user.id);
    assert.equal(s.status, 'deleted');
    assert.equal(u.is_active, false);
  });

  test('allows deletion when no money is attached, tombstoning the row and deactivating the user', async () => {
    const { user, seller } = await seedSeller({});
    const result = await softDeleteSeller(seller.id, user.id);
    assert.equal(result, true);
    const { s, u } = await readSellerAndUser(seller.id, user.id);
    assert.equal(s.status, 'deleted', 'seller row must be tombstoned');
    assert.equal(s.full_name, 'Deleted user');
    assert.equal(u.is_active, false, 'user account must be deactivated');
  });
});
