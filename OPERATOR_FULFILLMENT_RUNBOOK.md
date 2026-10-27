# BYBLOS — OPERATOR RUNBOOK: FULFILLMENT DEAD-LETTER RECOVERY & TRIAGE

**Domain:** Order Fulfillment & Queue Reliability (DIST-03)  
**Audience:** Site Reliability Engineers (SRE), Backend Engineers, Operations / Tier 2 Support  
**Applies To:** All environments (Production, Staging, Local)  
**Last Updated:** October 2026  

---

## 1. Overview & Architecture

When an order payment succeeds (e.g., via Paystack or M-Pesa webhook), Byblos records the order in `product_orders` with `status = 'PAID'` and enqueues a row in `fulfillment_jobs` with `status = 'PENDING'`.

The `FulfillmentWorker` crons poll `fulfillment_jobs` and execute fulfillment via `FulfillmentQueueService.processJobs()`:
- **Digital goods**: Grants access to the digital file in `digital_downloads`, releases escrow to the seller's balance, and notifies buyer/seller.
- **Physical goods**: Finalizes reserved inventory, transitions order to `AWAITING_SELLER_ACTION`, and creates delivery or drop-off requests.
- **Service bookings**: Confirms the booking schedule and notifies the provider.

### The Dead-Letter Problem (DIST-03)
If transient or permanent errors occur during fulfillment (e.g. storage failure, malformed product metadata, warehouse stockout, or external provider downtime):
1. The worker retries the job up to `max_attempts` (default: 5) with exponential backoff (`INTERVAL '1 minute' * POWER(2, attempts)`).
2. When `attempts >= max_attempts`, the job enters a terminal `FAILED` status and writes an error entry to `system_issues`.
3. The automated self-healing worker (`ReconciliationEngine.handleDeadLetterFulfillmentJobs`) immediately identifies orders stuck in this condition and safely transitions the order from `PAID` to `MANUAL_REVIEW`.
4. This runbook details how an on-call engineer or operator inspects, diagnoses, retries, or refunds the stuck order.

---

## 2. Detection & Alerts

### 2.1 Automated Alerts
A high-severity alert is raised via `system_issues` and logged when:
- A fulfillment job reaches `attempts >= max_attempts`:
  ```json
  {
    "order_id": 5845,
    "issue_type": "FULFILLMENT_FAILURE",
    "severity": "HIGH",
    "resolved": false,
    "details": {
      "error": "Failed to upload digital download license",
      "job_id": 311,
      "attempts": 5
    }
  }
  ```
- Application logs contain:
  `[SYSTEM-ISSUE] FULFILLMENT_FAILURE for Order <id>: <error>`
  `[RECON] Found dead-letter fulfillment job <job_id> for order <order_id>. Transitioning order to MANUAL_REVIEW.`

### 2.2 Forensic SQL Queries

#### Check for all dead-letter jobs requiring operator review
```sql
SELECT 
    fj.id AS job_id,
    fj.order_id,
    fj.attempts,
    fj.max_attempts,
    fj.error_message,
    fj.last_attempt_at,
    po.order_number,
    po.status AS order_status,
    po.total_amount,
    po.order_type,
    po.buyer_id,
    po.buyer_email,
    po.seller_id,
    si.id AS issue_id,
    si.created_at AS issue_created_at
FROM fulfillment_jobs fj
JOIN product_orders po ON po.id = fj.order_id
LEFT JOIN system_issues si ON si.order_id = po.id 
    AND si.issue_type = 'FULFILLMENT_FAILURE' 
    AND si.resolved = FALSE
WHERE fj.status = 'FAILED' 
  AND fj.attempts >= fj.max_attempts
ORDER BY fj.updated_at DESC;
```

#### Check orders stuck in MANUAL_REVIEW
```sql
SELECT id, order_number, total_amount, payment_status, created_at, updated_at
FROM product_orders
WHERE status = 'MANUAL_REVIEW'
ORDER BY updated_at DESC;
```

---

## 3. Operator Triage & Resolution Procedures

Operators can inspect and remediate dead-letter fulfillment jobs either through programmatic CLI commands or directly via authoritative Node.js services.

### Scenario A: Transient / Remediated Error (Retry Job)
**Use when:** The underlying cause was transient (e.g. Redis connection blip, database lock contention, temporary network failure to Cloudinary or AWS S3), or an admin has updated missing product data.

#### Step 1: Execute Programmatic Retry via Node CLI
Run from the `server/` directory:
```bash
node -e "
const FulfillmentQueueService = (await import('./src/domains/orders/fulfillment/fulfillmentQueue.service.js')).default;
const jobId = 311; // Replace with target job_id
const job = await FulfillmentQueueService.retryFailedJob(jobId, { operatorId: 'ops-engineer' });
console.log('Job retried successfully:', job);
process.exit(0);
"
```

#### Step 2: What happens automatically:
1. `fulfillment_jobs`: `status` is set to `'PENDING'`, `attempts` is reset to `0`, `error_message` is set to `NULL`.
2. `product_orders`: `status` is transitioned from `'MANUAL_REVIEW'` back to `'PAID'`.
3. `system_issues`: Open issue for this order is marked `resolved = TRUE`.
4. The background fulfillment worker will claim the job within 30 seconds and fulfill the order.

#### Step 3: Verify Successful Processing
```sql
SELECT id, order_id, status, attempts, error_message, updated_at
FROM fulfillment_jobs
WHERE id = 311;

SELECT id, status, fulfillment_type, updated_at
FROM product_orders
WHERE id = (SELECT order_id FROM fulfillment_jobs WHERE id = 311);
```
Expected: `fulfillment_jobs.status = 'COMPLETED'` and `product_orders.status` in `['AWAITING_SELLER_ACTION', 'COMPLETED', 'READY_FOR_BUYER']`.

---

### Scenario B: Permanent / Unrecoverable Failure (Cancel & Full Wallet Refund)
**Use when:** The product is permanently discontinued, the seller cannot fulfill the order, the digital asset was deleted and cannot be recovered, or the buyer requests a refund for the stalled order.

#### Step 1: Execute Programmatic Cancellation & Refund
Run from the `server/` directory:
```bash
node -e "
const FulfillmentQueueService = (await import('./src/domains/orders/fulfillment/fulfillmentQueue.service.js')).default;
const orderId = 5845; // Replace with target order_id
const result = await FulfillmentQueueService.cancelAndRefundDeadLetter(orderId, {
  reason: 'Product discontinued by merchant - dead letter refund',
  operatorId: 'ops-engineer'
});
console.log('Order cancelled and buyer refunded:', result);
process.exit(0);
"
```

#### Step 2: What happens automatically:
1. `product_orders`: Authoritatively transitioned to `status = 'CANCELLED'`.
2. `buyers`: The buyer's wallet refund balance (`refunds` column) is credited with the authoritative captured amount.
3. `refund_requests`: A complete ledger row is inserted (`status = 'completed'`, `payment_method = 'wallet'`).
4. `fulfillment_jobs`: Marked as terminal `status = 'CANCELLED'`.
5. `system_issues`: Marked `resolved = TRUE`.

#### Step 3: Verify Financial Invariant & Buyer Wallet
```sql
-- 1. Check order status
SELECT id, status, total_amount, updated_at 
FROM product_orders 
WHERE id = 5845;

-- 2. Check refund request ledger
SELECT id, order_id, buyer_id, amount, status, payment_method, processed_at
FROM refund_requests
WHERE order_id = 5845;

-- 3. Check buyer wallet balance
SELECT id, full_name, email, refunds 
FROM buyers 
WHERE id = (SELECT buyer_id FROM product_orders WHERE id = 5845);
```

---

## 4. Operational Best Practices

1. **Daily Dead-Letter Sweep**: Verify `SELECT count(*) FROM fulfillment_jobs WHERE status = 'FAILED' AND attempts >= max_attempts;` returns `0`.
2. **Never Directly UPDATE Order Status**: Always use `FulfillmentQueueService.retryFailedJob()` or `FulfillmentQueueService.cancelAndRefundDeadLetter()` so financial events, inventory releases, wallet balances, and system issues remain strictly synchronized.
3. **Audit Logging**: Always pass `operatorId` in options so the audit log preserves who took remediation actions.
