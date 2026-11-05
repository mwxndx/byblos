import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import EventDispatcher from '../src/application/events/eventDispatcher.js';

describe('EventDispatcher outbox replay and row dispatch contract', () => {
  test('dispatchOutboxRow executes listener and marks completed when successful', async () => {
    let listenerCalled = false;
    let listenerPayload = null;

    const listenersMap = new Map();
    listenersMap.set('test.event', [
      (payload) => {
        listenerCalled = true;
        listenerPayload = payload;
      }
    ]);

    const dispatcher = new EventDispatcher(event => listenersMap.get(event) || []);

    let completedEventId = null;
    dispatcher.markOutboxCompleted = async (eventId) => {
      completedEventId = eventId;
    };

    const row = {
      event_id: 'evt-123',
      event_name: 'test.event',
      payload: { foo: 'bar' },
      attempts: 1
    };

    const result = await dispatcher.dispatchOutboxRow(row);

    assert.equal(listenerCalled, true);
    assert.equal(listenerPayload?.foo, 'bar');
    assert.equal(listenerPayload?.eventId, 'evt-123');
    assert.equal(completedEventId, 'evt-123');
    assert.deepEqual(result, { completed: 1, failed: 0 });
  });

  test('dispatchOutboxRow marks failed when listener throws', async () => {
    const listenersMap = new Map();
    listenersMap.set('fail.event', [
      () => {
        throw new Error('Simulation failure');
      }
    ]);

    const dispatcher = new EventDispatcher(event => listenersMap.get(event) || []);

    let failedEventId = null;
    let failureError = null;
    dispatcher.markOutboxFailed = async (eventId, err) => {
      failedEventId = eventId;
      failureError = err;
    };

    const row = {
      event_id: 'evt-456',
      event_name: 'fail.event',
      payload: {},
      attempts: 2
    };

    const result = await dispatcher.dispatchOutboxRow(row);

    assert.equal(failedEventId, 'evt-456');
    assert.equal(failureError?.message, 'Simulation failure');
    assert.deepEqual(result, { completed: 0, failed: 1 });
  });
});
