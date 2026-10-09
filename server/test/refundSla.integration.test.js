import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import { calculateSla, enrichRequestWithSla } from '../src/domains/payments/refunds/refundSla.service.js';
import * as refundRequestRepository from '../src/domains/orders/repositories/refundRequest.repository.js';
import ReconciliationEngine from '../src/application/cron/reconciliationEngine.js';
import {
  createUser,
  createBuyer,
  createRefundRequest,
  cleanupBuyer,
  cleanupUser
} from './helpers/factories.js';

describe('Refund Admin Review SLA & Escalation Timer (integration)', () => {
  after(async () => {
    await pool.end().catch(() => {});
  });

  test('calculateSla accurately evaluates on-track, warning, and breached states', () => {
    const now = Date.now();

    // 1. Fresh request (1 hour ago) -> on_track
    const fresh = calculateSla({
      requestedAt: new Date(now - 1 * 3600 * 1000).toISOString(),
      status: 'pending'
    });
    assert.equal(fresh.isBreached, false);
    assert.equal(fresh.slaStatus, 'on_track');
    assert.ok(fresh.hoursRemaining >= 46 && fresh.hoursRemaining <= 48);

    // 2. Approaching deadline (40 hours ago, 8h left <= 12h threshold) -> warning
    const warning = calculateSla({
      requestedAt: new Date(now - 40 * 3600 * 1000).toISOString(),
      status: 'manual_review'
    });
    assert.equal(warning.isBreached, false);
    assert.equal(warning.slaStatus, 'warning');
    assert.ok(warning.hoursRemaining > 0 && warning.hoursRemaining <= 12);

    // 3. Overdue request (55 hours ago) -> breached
    const breached = calculateSla({
      requestedAt: new Date(now - 55 * 3600 * 1000).toISOString(),
      status: 'pending'
    });
    assert.equal(breached.isBreached, true);
    assert.equal(breached.slaStatus, 'breached');
    assert.ok(breached.hoursOverdue >= 6 && breached.hoursOverdue <= 8);
    assert.equal(breached.isEscalated, true);
  });

  test('enrichRequestWithSla attaches SLA metrics to row', () => {
    const rawRow = {
      id: 101,
      requested_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      status: 'pending',
      amount: '500.00',
      payment_details: {}
    };

    const enriched = enrichRequestWithSla(rawRow);
    assert.ok(enriched.sla);
    assert.equal(enriched.sla.slaStatus, 'on_track');
    assert.equal(enriched.is_sla_breached, false);
    assert.ok(enriched.sla_deadline);
  });

  test('ReconciliationEngine escalates overdue refund requests and stamps payment_details.sla', async (t) => {
    let buyer;
    const createdRefunds = [];

    t.after(async () => {
      for (const id of createdRefunds) {
        await pool.query('DELETE FROM refund_requests WHERE id = $1', [id]).catch(() => {});
      }
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});

    // Seed 1: Overdue request created 52 hours ago (SLA breached)
    const overdueRes = await pool.query(
      `INSERT INTO refund_requests (buyer_id, amount, status, requested_at, payment_method, payment_details)
       VALUES ($1, $2, 'pending', NOW() - INTERVAL '52 hours', 'mpesa', '{}'::jsonb)
       RETURNING id`,
      [buyer.id, 1200]
    );
    const overdueId = overdueRes.rows[0].id;
    createdRefunds.push(overdueId);

    // Seed 2: Recent request created 2 hours ago (On track)
    const recentRes = await pool.query(
      `INSERT INTO refund_requests (buyer_id, amount, status, requested_at, payment_method, payment_details)
       VALUES ($1, $2, 'manual_review', NOW() - INTERVAL '2 hours', 'mpesa', '{}'::jsonb)
       RETURNING id`,
      [buyer.id, 800]
    );
    const recentId = recentRes.rows[0].id;
    createdRefunds.push(recentId);

    // Run escalation worker
    await ReconciliationEngine.handleOverdueRefundRequests();

    // Verify overdue request was updated with escalation metadata
    const { rows: [escalatedRow] } = await pool.query(
      `SELECT payment_details, status FROM refund_requests WHERE id = $1`,
      [overdueId]
    );
    assert.equal(escalatedRow.payment_details?.sla?.is_breached, true);
    assert.ok(escalatedRow.payment_details?.sla?.escalated_at);
    assert.equal(escalatedRow.payment_details?.sla?.escalation_level, 1);

    // Verify recent request was NOT modified
    const { rows: [recentRow] } = await pool.query(
      `SELECT payment_details FROM refund_requests WHERE id = $1`,
      [recentId]
    );
    assert.equal(recentRow.payment_details?.sla?.is_breached, undefined);
  });

  test('repository supports overdueOnly filter and urgency-first sorting', async (t) => {
    let buyer;
    const createdRefunds = [];

    t.after(async () => {
      for (const id of createdRefunds) {
        await pool.query('DELETE FROM refund_requests WHERE id = $1', [id]).catch(() => {});
      }
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});

    // Overdue request (breached)
    const res1 = await pool.query(
      `INSERT INTO refund_requests (buyer_id, amount, status, requested_at, payment_method, payment_details)
       VALUES ($1, $2, 'pending', NOW() - INTERVAL '60 hours', 'mpesa', '{}'::jsonb)
       RETURNING id`,
      [buyer.id, 500]
    );
    createdRefunds.push(res1.rows[0].id);

    // Fresh request (on track)
    const res2 = await pool.query(
      `INSERT INTO refund_requests (buyer_id, amount, status, requested_at, payment_method, payment_details)
       VALUES ($1, $2, 'pending', NOW() - INTERVAL '30 minutes', 'mpesa', '{}'::jsonb)
       RETURNING id`,
      [buyer.id, 900]
    );
    createdRefunds.push(res2.rows[0].id);

    // Test overdueOnly filter
    const overdueList = await refundRequestRepository.findAllWithBuyer({
      status: 'pending',
      overdueOnly: true,
      limit: 10,
      offset: 0
    });
    const overdueIds = overdueList.map(r => r.id);
    assert.ok(overdueIds.includes(res1.rows[0].id), 'Overdue request should be included in overdueOnly');
    assert.ok(!overdueIds.includes(res2.rows[0].id), 'Fresh request should NOT be included in overdueOnly');

    // Test urgency sorting (overdue request should appear before fresh request)
    const urgencyList = await refundRequestRepository.findAllWithBuyer({
      status: 'pending',
      sortBy: 'urgency',
      limit: 10,
      offset: 0
    });
    const indexOverdue = urgencyList.findIndex(r => r.id === res1.rows[0].id);
    const indexFresh = urgencyList.findIndex(r => r.id === res2.rows[0].id);
    assert.ok(indexOverdue < indexFresh, 'Overdue request must rank ahead of fresh request under urgency sorting');
  });
});
