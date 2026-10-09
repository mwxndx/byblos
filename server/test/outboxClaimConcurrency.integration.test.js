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
});
