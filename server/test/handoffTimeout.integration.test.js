// Slice C: the 48h buyer-confirmation backstop. When Mzigo has confirmed the
// buyer has the package (handoff_confirmed_at set) but the buyer never taps
// confirm, the sweep auto-completes the order to the seller so escrow is never
// stranded. Drives the real sweep against a real database.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import OrderDeadlineService from '../src/domains/orders/order/orderDeadline.service.js';
import {
  createBuyer,
  createSeller,
  createCompletedOrder,
  createPayment,
  cleanupOrder,
  cleanupSeller,
  cleanupBuyer,
} from './helpers/factories.js';

describe('checkExpiredHandoffConfirmations (integration, 48h backstop)', () => {
  test('auto-completes a stale READY_FOR_BUYER order and pays the seller; leaves a fresh one alone', async (t) => {
    let buyer, seller, staleOrder, freshOrder;
    t.after(async () => {
      if (staleOrder) await cleanupOrder(staleOrder.id).catch(() => {});
      if (freshOrder) await cleanupOrder(freshOrder.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});

    // Handoff confirmed 49h ago, buyer never confirmed → should auto-complete.
    staleOrder = await createCompletedOrder({
      buyerId: buyer.id, sellerId: seller.id, totalAmount: 1000, sellerPayoutAmount: 940, status: 'READY_FOR_BUYER',
    });
    await createPayment({ orderId: staleOrder.id, amount: 1000 });
    await pool.query(`UPDATE product_orders SET handoff_confirmed_at = NOW() - INTERVAL '49 hours' WHERE id = $1`, [staleOrder.id]);

    // Handoff confirmed 1h ago → still inside the window, must not be touched.
    freshOrder = await createCompletedOrder({
      buyerId: buyer.id, sellerId: seller.id, totalAmount: 500, sellerPayoutAmount: 470, status: 'READY_FOR_BUYER',
    });
    await createPayment({ orderId: freshOrder.id, amount: 500 });
    await pool.query(`UPDATE product_orders SET handoff_confirmed_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, [freshOrder.id]);

    const before = await pool.query('SELECT pending_settlement_balance FROM sellers WHERE id = $1', [seller.id]);

    const result = await OrderDeadlineService.checkExpiredHandoffConfirmations();
    assert.ok(result.processedCount >= 1, 'the stale order should be processed');

    const staleAfter = await pool.query('SELECT status FROM product_orders WHERE id = $1', [staleOrder.id]);
    assert.equal(staleAfter.rows[0].status, 'COMPLETED', 'stale order auto-completed to the seller');

    const freshAfter = await pool.query('SELECT status FROM product_orders WHERE id = $1', [freshOrder.id]);
    assert.equal(freshAfter.rows[0].status, 'READY_FOR_BUYER', 'fresh order left untouched inside the 48h window');

    const after = await pool.query('SELECT pending_settlement_balance FROM sellers WHERE id = $1', [seller.id]);
    assert.ok(
      Number(after.rows[0].pending_settlement_balance) > Number(before.rows[0].pending_settlement_balance),
      'seller pending settlement balance increased (escrow released)'
    );
  });
});
