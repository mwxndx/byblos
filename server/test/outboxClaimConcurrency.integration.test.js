import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const EventOutboxRepository = (await import('../src/application/events/outboxRepository.js')).default;

describe('Concurrency: outbox event leased atomic claims', () => {
  const createdEventIds = [];

  after(async () => {
    if (createdEventIds.length > 0) {
      await pool.query('DELETE FROM event_outbox WHERE event_id = ANY($1)', [createdEventIds]).catch(() => {});
    }
  });

  test('two concurrent claims on the same pending event yield exactly one claim winner', async () => {
    const durableEvent = await EventOutboxRepository.enqueue('payment.completed', {
      orderId: 999991,
      amount: 1500
    });
    createdEventIds.push(durableEvent.eventId);

    // Two workers racing to claim the same event concurrently
    const [claimA, claimB] = await Promise.all([
      EventOutboxRepository.claimOutboxEvent(durableEvent.eventId),
      EventOutboxRepository.claimOutboxEvent(durableEvent.eventId)
    ]);

    const claimedCount = [claimA, claimB].filter(Boolean).length;
    assert.equal(claimedCount, 1, 'Exactly one concurrent worker must claim the event');

    const winner = claimA || claimB;
    assert.equal(winner.event_id, durableEvent.eventId);
    assert.equal(winner.status, 'processing');

    // Immediate third claim while lease is active (< 5 min) must also return null
    const claimC = await EventOutboxRepository.claimOutboxEvent(durableEvent.eventId);
    assert.equal(claimC, null, 'Active lease must prevent additional claims');
  });

  test('a stale processing event (> 5 min lease) can be reclaimed', async () => {
    const durableEvent = await EventOutboxRepository.enqueue('order.fulfilled', {
      orderId: 999992
    });
    createdEventIds.push(durableEvent.eventId);

    // Claim once to enter 'processing'
    const claim1 = await EventOutboxRepository.claimOutboxEvent(durableEvent.eventId);
    assert.ok(claim1, 'Initial claim should succeed');
    assert.equal(claim1.status, 'processing');

    // Age the row so the lease expires (> 5 minutes ago)
    await pool.query(
      "UPDATE event_outbox SET updated_at = NOW() - INTERVAL '6 minutes' WHERE event_id = $1",
      [durableEvent.eventId]
    );

    // Reclaim after lease expiration
    const reclaim = await EventOutboxRepository.claimOutboxEvent(durableEvent.eventId);
    assert.ok(reclaim, 'Expired lease should allow event to be reclaimed');
    assert.equal(reclaim.event_id, durableEvent.eventId);
    assert.equal(reclaim.status, 'processing');
    assert.equal(reclaim.attempts, 2);
  });

  test('stale worker with old claim attempts cannot complete or fail a reclaimed event', async () => {
    const durableEvent = await EventOutboxRepository.enqueue('order.fulfilled', {
      orderId: 999993
    });
    createdEventIds.push(durableEvent.eventId);

    // Worker 1 claims event (attempts = 1)
    const worker1Claim = await EventOutboxRepository.claimOutboxEvent(durableEvent.eventId);
    assert.ok(worker1Claim, 'Worker 1 should claim event');
    assert.equal(worker1Claim.attempts, 1);

    // Stale timeout expires
    await pool.query(
      "UPDATE event_outbox SET updated_at = NOW() - INTERVAL '6 minutes' WHERE event_id = $1",
      [durableEvent.eventId]
    );

    // Worker 2 reclaims event (attempts = 2)
    const worker2Claim = await EventOutboxRepository.claimOutboxEvent(durableEvent.eventId);
    assert.ok(worker2Claim, 'Worker 2 should reclaim event');
    assert.equal(worker2Claim.attempts, 2);

    // Worker 1 finishes late and tries to complete attempt 1
    const worker1Success = await EventOutboxRepository.markCompleted(durableEvent.eventId, worker1Claim.attempts);
    assert.equal(worker1Success, false, 'Worker 1 with stale attempts cannot complete event');

    // Verify row status is still processing and attempts is still 2
    const checkRow = await pool.query('SELECT status, attempts FROM event_outbox WHERE event_id = $1', [durableEvent.eventId]);
    assert.equal(checkRow.rows[0].status, 'processing');
    assert.equal(checkRow.rows[0].attempts, 2);

    // Worker 2 finishes and completes attempt 2
    const worker2Success = await EventOutboxRepository.markCompleted(durableEvent.eventId, worker2Claim.attempts);
    assert.equal(worker2Success, true, 'Worker 2 with active lease completes event');

    const completedRow = await pool.query('SELECT status FROM event_outbox WHERE event_id = $1', [durableEvent.eventId]);
    assert.equal(completedRow.rows[0].status, 'completed');
  });
});
