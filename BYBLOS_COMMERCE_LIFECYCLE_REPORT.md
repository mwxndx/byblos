# BYBLOS — COMMERCE LIFECYCLE VERIFICATION REPORT

**Audit Date:** November 14, 2026  
**Auditor / Role:** Senior QA Architect & Business Workflow Analyst  
**Environment:** Staging / Isolated Test Environment (`byblos_test` on PostgreSQL 17 localhost:3001)  
**Execution Standard:** Continuous Verification Policy (`AGENTS.md`)  

---

## 1. Commerce Lifecycle Architecture

The Byblos commerce engine implements a multi-party escrow model connecting Buyers, Sellers, Creators, Logistics Couriers (Mzigo Ego), and Payment Providers. The end-to-end lifecycle spans 8 critical phases:

```
[1. Product Discovery] -> [2. Bag & Authoritative Pricing] -> [3. Stock Reservation]
                                                                     │
[6. Fulfillment Matrix] <- [5. Paystack Webhook / Escrow Hold] <- [4. Payment Initiation]
    ├─ Physical + Mzigo
    ├─ Physical + Shop Pickup
    ├─ Digital Instant Access
    └─ Service Appointment
          │
[7. Completion / Delivery] -> [8. Dual-Phase Settlement & Payout]
```

---

## 2. Phase-by-Phase Verification Matrix

### Phase 1: Product Discovery & Variant Inventory
- **Verified Behavior:** Product items and multi-variant stock are persisted in `products` and `product_variants` tables. Product queries filter out inactive/suspended sellers automatically.
- **Evidence:** Verified by `gate1-core-commerce.journey.test.js` (Test 1–3) and live public catalog queries (`/api/public/products`).

### Phase 2: Bag Checkout & Authoritative Pricing
- **Constraint:** Single-seller checkout restriction. A buyer cart cannot mix items from multiple distinct sellers.
- **Verification:**
  - Multi-item bag checkout with items from the same seller creates a single order with correct `order_items` records.
  - Multi-seller bag rejected with HTTP 400 Bad Request (`bagCheckout.integration.test.js` Subtest 4).
  - Client-submitted price tampering is completely discarded; line prices are resolved directly from database snapshots.

### Phase 3: Inventory Reservation & Deadlock Prevention
- **Mechanism:** Inventory reservation uses pessimistic row-level locking (`SELECT ... FOR UPDATE` ordered by product ID) to prevent concurrent race conditions or overselling.
- **Verification:** Two simultaneous checkout requests against the last remaining stock item result in exactly one order created and one rejected with out-of-stock. Verified in `gate1-core-commerce.journey.test.js` and `concurrency.integration.test.js`.

### Phase 4: Payment Initiation & Webhook Ingestion
- **Provider:** Paystack HMAC SHA512 signature-validated webhooks.
- **Resilience:**
  - Webhooks require valid signature header; unsigned or tampered requests are rejected with HTTP 401.
  - Duplicate webhook delivery idempotency: Two identical incoming webhook deliveries racing against each other process payment exactly once; fulfillment is enqueued exactly once (`concurrency.integration.test.js` Subtest 1).

### Phase 5: Escrow Hold & Financial Invariants
- **Accounting Rules:**
  - When payment succeeds, order gross amount is held in `escrow_held`.
  - Creator referral commission (if attributed) is calculated against seller net earnings (or tiered platform flat fee), never inflating buyer price.
  - Platform fee is held in escrow until delivery completion.
- **Verification:** Verified by `gate3-financial-workflows.journey.test.js` and `bagCheckout.integration.test.js`.

### Phase 6: Fulfillment Matrix & Product Types
The platform supports 4 distinct fulfillment combinations, all verified in `fulfillment.deep-matrix.integration.test.js`:
1. **Combination 1: PHYSICAL + COURIER (Mzigo Dispatch Lifecycle)**
   - Seller prepares parcel -> Courier accepts assignment -> Picked up -> In transit -> Delivered -> Settlement.
   - Status: **PASS** (Subtest 1).
2. **Combination 2: PHYSICAL + BUYER_TO_SELLER (Shop Pickup)**
   - Seller prepares order -> Buyer presents pickup token at shop -> Seller confirms pickup -> Settlement.
   - Status: **PASS** (Subtest 2).
3. **Combination 3: DIGITAL + DIGITAL (Immediate Fulfillment)**
   - Payment confirmed -> Secure download access token instantly generated -> Escrow released to pending settlement immediately.
   - Status: **PASS** (Subtest 3).
4. **Combination 4: SERVICE + BUYER_TO_SELLER (Appointment Booking)**
   - Payment confirmed -> Service booking slot locked -> Customer attends appointment -> Completion confirmed.
   - Status: **PASS** (Subtest 4).

### Phase 7: Order Completion & Settlement
- **Escrow Release:** Upon transition to `DELIVERED` or `COMPLETED`, funds move from `escrow_held` to seller `available_balance`.
- **Creator Earnings:** Creator commission moves to creator `available_balance` unless flagged for self-dealing review.

### Phase 8: Payouts & Concurrency Row Locking
- **Withdrawal Requests:** Seller/Creator requests withdrawal to bank or mobile money.
- **Concurrency Guard:** Deducts from balance inside `SELECT ... FOR UPDATE`. Concurrent simultaneous withdrawals exceeding available balance are rejected (`withdrawals.concurrency.integration.test.js`).
- **Provider Resilience:** Transient payout failures trigger exponential backoff retry; permanent failures rollback funds to user balance.

---

## 3. Commerce Lifecycle Summary Verdict

The end-to-end commerce lifecycle has been completely verified across all 4 product types and fulfillment channels. Financial invariants, stock reservations, idempotent webhooks, and payout concurrency controls operate reliably without leaks or state corruption.

