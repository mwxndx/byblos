import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import requestId from '../src/application/middleware/requestId.js';
import domainEventDispatcher, {
    eventBus,
    AppEvents,
    DomainEvents
} from '../src/shared/core/domainEventDispatcher.js';
import { DomainEvents as AliasedEvents } from '../src/shared/core/domainEvents.js';
import rawEventBus from '../src/application/events/eventBus.js';

describe('Track 2: Pipeline, Middleware & Security Hardening', () => {
    describe('requestId middleware', () => {
        test('preserves incoming x-request-id header and propagates it to req.id and response', () => {
            const req = {
                headers: { 'x-request-id': 'req-upstream-trace-12345' }
            };
            let setHeaderKey = null;
            let setHeaderVal = null;
            const res = {
                setHeader: (k, v) => {
                    setHeaderKey = k;
                    setHeaderVal = v;
                }
            };
            let nextCalled = false;

            requestId(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true);
            assert.equal(req.id, 'req-upstream-trace-12345');
            assert.equal(setHeaderKey, 'X-Request-ID');
            assert.equal(setHeaderVal, 'req-upstream-trace-12345');
        });

        test('preserves incoming x-correlation-id when x-request-id is omitted', () => {
            const req = {
                headers: { 'x-correlation-id': 'corr-upstream-trace-67890' }
            };
            let setHeaderVal = null;
            const res = {
                setHeader: (k, v) => { setHeaderVal = v; }
            };

            requestId(req, res, () => {});

            assert.equal(req.id, 'corr-upstream-trace-67890');
            assert.equal(setHeaderVal, 'corr-upstream-trace-67890');
        });

        test('generates valid RFC 4122 v4 UUID when no trace header is supplied', () => {
            const req = { headers: {} };
            let setHeaderVal = null;
            const res = {
                setHeader: (k, v) => { setHeaderVal = v; }
            };

            requestId(req, res, () => {});

            assert.ok(typeof req.id === 'string' && req.id.length === 36);
            assert.match(req.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            assert.equal(setHeaderVal, req.id);
        });
    });

    describe('domainEventDispatcher compatibility seam', () => {
        test('re-exports real eventBus as default and named export', () => {
            assert.equal(domainEventDispatcher, rawEventBus);
            assert.equal(eventBus, rawEventBus);
        });

        test('exports AppEvents and DomainEvents identical to application event types', () => {
            assert.ok(AppEvents);
            assert.equal(DomainEvents, AppEvents);
            assert.equal(AliasedEvents, AppEvents);
            assert.equal(AppEvents.ORDER.PAID, 'order.paid');
            assert.equal(AppEvents.WITHDRAWAL.CREATED, 'withdrawal.created');
        });
    });
});
