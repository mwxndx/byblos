# Byblos Forensic Code Audit

**Audit date:** 2026-10-09  
**Revision reviewed:** `4a9ba68e`  
**Method:** Static end-to-end trace of checkout, payment confirmation, refunds,
withdrawals, escrow settlement, event outbox, route registration, and the
frontend API clients. This is not a penetration test against a running
deployment, so configuration-dependent controls and production data were not
verified.

## Executive summary

The platform has solid foundations: money columns use `NUMERIC`, the major
money mutations are usually transactional and row-locked, Paystack webhooks
are HMAC-verified from the raw body, and the critical event listener check is
called by both entry points. `npm run typecheck` and `server/npm run lint`
pass.

The uncomfortable conclusion is that the frontend currently reports a payment
as terminally successful as soon as it receives any successful HTTP envelope,
and the durable event dispatcher can concurrently deliver an already-processing
event. Those are material correctness risks in the checkout and notification /
fulfilment paths.

| Severity | Confirmed findings |
| --- | ---: |
| Critical | 0 |
| High | 2 |
| Medium | 3 |
| Low / cleanup | 4 |

## High severity findings

### H-01 — Payment polling stops before payment completes

**Evidence:** `src/features/payments/api/publicPayments.ts:12-18`; backend
envelope at `server/src/domains/payments/payments/payment.controller.js:173-194`.

The backend always returns the transport envelope `status: 'success'` for a
valid poll, even when `data.status` is `pending`. The frontend reads
`response.data.status` and treats `success` as terminal. Therefore the first
successful poll resolves immediately rather than continuing until the nested
payment state becomes successful or failed.

**Trigger:** Start an M-Pesa checkout, then call `pollPaymentStatus` before the
webhook/payment cron has completed the payment.

**Impact:** The UI can tell a buyer that checkout is complete while payment is
still pending, and stops the only retry/poll loop. This creates stranded or
misrepresented orders after ordinary asynchronous M-Pesa latency.

**Patch:** Parse `response.data.data.status`, normalize it, and only resolve on
provider terminal states. Add a unit test for `{ status: 'success', data:
{ status: 'pending' } }` that asserts a second request is scheduled.

### H-02 — Outbox permits concurrent delivery of an event already in progress

**Evidence:** `server/src/application/events/outboxRepository.js:101-117`;
dispatch call path at `server/src/application/events/eventBus.js:131-156`.

`claimOutboxEvent` updates a row whenever its status is `pending`, `failed`,
**or `processing`**. It does not require the `processing` lease to be stale and
does not lock-and-test ownership. Two `dispatchAfterCommit` calls, or an
immediate dispatch racing a replay worker, can both update the same row, commit,
and invoke listeners.

**Trigger:** Invoke `dispatchOutboxEvent(eventId)` twice before the first
listener completes; a horizontally scaled worker makes this more likely.

**Impact:** A single payment/refund/withdrawal/logistics event can execute its
listener twice. Recipient delivery has its own guard, but event listeners also
activate fulfilment and mutate workflow state; the outbox itself does not give
the exactly-once protection its API implies.

**Patch:** Claim only `pending`/due `failed` rows, or only reclaim `processing`
rows after a recorded lease timeout. Do the state predicate and transition in
one `UPDATE ... WHERE` and return no row for an active lease. Persist a claim
token if completion/failure needs ownership validation. Add a two-client
concurrency integration test.

## Medium severity findings

### M-01 — Public order-reference endpoint enables order-status enumeration

**Evidence:** public mount at `server/src/application/routes/order.routes.js:28-31`;
response at `server/src/domains/orders/order/order.controller.js:316-339`.

`GET /api/orders/reference/:reference` is unauthenticated and exposes order ID,
order number, order lifecycle status, and payment status. It has no checkout
token, buyer authentication, or unguessable bearer capability. The route is
also rate limited only by the general public limiter.

**Impact:** Anyone who obtains or guesses a reference can track a buyer's order
and use the numeric ID as input to other probing attempts. Even if references
are normally high entropy, this endpoint turns an order reference disclosed in
a receipt, screenshot, or log into a standing tracking token.

**Patch:** Remove the route, require authenticated ownership, or require the
existing `client_checkout_token` and return only the minimal public checkout
projection. Add per-reference abuse controls and a negative authorization test.

### M-02 — Checkout binds a logged-in buyer to a profile selected by a body phone number

**Evidence:** `server/src/shared/utils/order.utils.js:57-88` and `:113-124`.

`normalizeOrderInput` looks up a buyer by the client-supplied `mobilePayment`
before resolving the authenticated buyer. When a matching profile exists,
`buyerId` remains that profile's ID; the logged-in buyer's own profile is used
only when no phone lookup matched. The checkout then persists this `buyer.id`
to `product_orders` (`server/src/domains/payments/payments/productCheckout.service.js:411-439`).

**Impact:** A session can associate a newly-created order with another buyer
profile by supplying that profile's registered phone number. Usually the victim
would receive the payment prompt, which limits direct theft, but ownership,
history, refunds, notifications, and digital entitlement are now attached to
the wrong account if payment subsequently succeeds.

**Patch:** For authenticated requests, resolve `buyerId` exclusively from
`req.user.buyerId`/server-side user lookup and reject a conflicting payment
phone unless an explicit verified-contact-change flow is used. Guest checkout
must not adopt an existing account merely because a phone number matches.

### M-03 — Monetary calculations convert database numerics to IEEE-754 numbers

**Evidence:** escrow conversion at
`server/src/domains/orders/escrow/EscrowManager.js:58-60`; settlement reversal
at `server/src/domains/orders/escrow/settlement.service.js:144-170`; payout
callback conversion at
`server/src/domains/payments/payouts/payoutCallbackStateMachine.service.js:49,129`.

Despite `NUMERIC(15,2)` database columns, financial arithmetic repeatedly uses
`Number.parseFloat` and `Math.round`. Two-decimal rounding bounds most drift,
but proportions such as partial refunds are calculated from binary floating
point. The balance of an order is also tracked in JSON metadata, not with a
database invariant.

**Impact:** A sequence of partial refunds/reversals can accumulate or lose a
cent relative to provider or ledger amounts. The current clamping avoids
negative balances but can conceal a ledger discrepancy rather than flagging it.

**Patch:** Perform all money arithmetic in integer minor units (or a decimal
library) from checkout through callbacks, persist each allocation in a
normalized ledger, and enforce `sum(refunds) <= payment.amount` in the locked
transaction. Add property tests for split/refund totals.

## Low severity and cleanup findings

### L-01 — Two redundant checkout-token unique indexes

**Evidence:** `server/test/schema.sql:4964-4974`.

Both `product_orders_client_checkout_token_unique` (partial) and
`product_orders_client_checkout_token_unique_all` enforce the same uniqueness
for a column that is now `NOT NULL` (`server/test/schema.sql:1766`). The partial
index adds write cost without providing distinct semantics.

**Patch:** Confirm the live constraint/index names, then ship a forward-only
migration dropping the redundant partial index.

### L-02 — Obsolete direct-order endpoints remain mounted

**Evidence:** `server/src/application/routes/order.routes.js:45-50` and
`server/src/application/routes/seller.routes.js:103-106`; handler at
`server/src/domains/orders/order/order.controller.js:56-62` always returns 410.

Two reachable POST endpoints are documented and protected by idempotency but
cannot create an order. They increase API surface and repeatedly attract stale
clients.

**Patch:** Remove after a compatibility window, or expose one explicitly
versioned deprecation endpoint with telemetry.

### L-03 — Broken unused facade methods

**Evidence:** `server/src/shared/core/CoreOrderService.js:24-30` delegates to
`OrderService.getOrders` and `OrderService.getOrderById`; neither implementation
exists in `server/src/domains/orders/order/OrderService.js`.

These methods currently fail with `TypeError` if called. Repository search found
no production callers, so this is dead code today but a delayed runtime fault.

**Patch:** Delete the facade methods or implement them and test the public
contract.

### L-04 — Placeholder balance check always authorizes

**Evidence:** `server/src/domains/payments/payments/payment.service.js:316-320`.

`hasSufficientBalance` computes a threshold and unconditionally returns
`true`. It currently has no production caller, but leaving an apparently
security-relevant helper with fail-open semantics is hazardous.

**Patch:** Delete it or implement the real provider/balance check before any
future caller can rely on it.

## Controls that were verified present

- Paystack webhook routes capture the raw request body and verify SHA-512 HMAC
  before controller execution: `server/src/application/bootstrap/express.js:147-154`
  and `server/src/application/middleware/paystackWebhookSecurity.js:139-171`.
- The major withdrawal path locks the owner row, checks the balance, reserves
  funds, and inserts the request in one transaction:
  `server/src/domains/payments/withdrawals/withdrawal.service.js:437-620`.
- Payment completion and buyer completion use transactions and row locks:
  `server/src/domains/payments/payments/CorePaymentService.js:771-803` and
  `server/src/domains/orders/order/OrderService.js:80-123`.
- Required event listeners are loaded and checked before workers start in both
  `server/src/index.js:43-49` and `server/src/worker.js:25-30`.

## Prioritized action plan

1. **P0 / immediate:** Fix H-01 and add the polling contract test. This is a
   deterministic user-facing checkout failure.
2. **P0 / immediate:** Fix H-02 with a leased atomic outbox claim and a
   multi-worker concurrency test; audit each listener for idempotent mutation.
3. **P1:** Require ownership or a checkout capability token for M-01.
4. **P1:** Make authenticated and guest buyer-profile resolution safe (M-02).
5. **P1:** Convert allocation/refund math to integer minor units and introduce
   a ledger invariant (M-03).
6. **P2:** Remove redundant indexes and retired routes; delete or repair stale
   facades/helpers.

## Verification performed

- `npm run typecheck` — passed.
- `npm run lint` in `server/` — passed.
- No production code was changed by this audit; this report is the only
  workspace modification.
