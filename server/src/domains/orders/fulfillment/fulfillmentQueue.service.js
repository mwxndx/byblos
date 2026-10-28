import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import eventBus, { AppEvents } from '../../../application/events/eventBus.js';
import OrderFulfillmentTransitionService from '../order/orderFulfillmentTransition.service.js';
import OrderCancellationService from '../order/orderCancellation.service.js';
import { AppError } from '../../../shared/utils/errorHandler.js';

class FulfillmentQueueService {
    /**
     * Enqueue a new fulfillment job after payment success.
     */
    static async enqueue(client, orderId) {
        const query = `
            INSERT INTO fulfillment_jobs (order_id, status)
            VALUES ($1, 'PENDING')
            ON CONFLICT (order_id) DO UPDATE
            SET status = 'PENDING',
                attempts = CASE
                    WHEN fulfillment_jobs.status = 'FAILED' THEN 0
                    ELSE fulfillment_jobs.attempts
                END,
                error_message = NULL,
                updated_at = NOW()
            WHERE fulfillment_jobs.status IN ('PENDING', 'FAILED')
               OR (
                    fulfillment_jobs.status = 'PROCESSING'
                    AND fulfillment_jobs.updated_at < NOW() - INTERVAL '10 minutes'
                  )
            RETURNING *
        `;
        const executor = client || pool;
        const { rows } = await executor.query(query, [orderId]);
        if (rows.length > 0) {
            logger.info(`[QUEUE] Enqueued fulfillment job for order ${orderId}`);
            return rows[0];
        }

        const { rows: existingRows } = await executor.query(
            `SELECT id, order_id, status, attempts, max_attempts, created_at, updated_at
             FROM fulfillment_jobs 
             WHERE order_id = $1`,
            [orderId]
        );
        logger.info(`[QUEUE] Fulfillment job for order ${orderId} already terminal or actively processing.`);
        return existingRows[0];
    }

    /**
     * Pick and process the next batch of jobs.
     * Designed to be called by a cron or loop.
     */
    static async processJobs(limit = 5) {
        const claimQuery = `
            WITH claimed AS (
                SELECT id
                FROM fulfillment_jobs
                WHERE (
                    status IN ('PENDING', 'FAILED')
                    OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '10 minutes')
                  )
                  AND attempts < max_attempts
                  AND (last_attempt_at IS NULL OR last_attempt_at < NOW() - INTERVAL '1 minute' * POWER(2, attempts))
                ORDER BY created_at ASC
                LIMIT $1
                FOR UPDATE SKIP LOCKED
            )
            UPDATE fulfillment_jobs fj
            SET status = 'PROCESSING',
                last_attempt_at = NOW(),
                attempts = attempts + 1,
                updated_at = NOW()
            FROM claimed
            WHERE fj.id = claimed.id
            RETURNING fj.*
        `;

        const { rows: jobs } = await pool.query(claimQuery, [limit]);
        if (jobs.length === 0) return;

        logger.info(`[QUEUE] Found ${jobs.length} jobs to process`);

        const concurrency = Math.max(1, Number.parseInt(process.env.FULFILLMENT_WORKER_CONCURRENCY || '5', 10));
        for (let i = 0; i < jobs.length; i += concurrency) {
            const batch = jobs.slice(i, i + concurrency);
            const results = await Promise.allSettled(batch.map(job => this.processJob(job)));
            for (const result of results) {
                if (result.status === 'rejected') {
                    logger.error('[QUEUE] Fulfillment job processing promise rejected:', result.reason);
                }
            }
        }
    }

    static async processJob(job) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Verify this claimed job is still processing under a row lock.
            const { rows: claimedJobs } = await client.query(
                `SELECT id, order_id, status, attempts, max_attempts, created_at, updated_at
                 FROM fulfillment_jobs
                 WHERE id = $1
                   AND status = 'PROCESSING'
                 FOR UPDATE`,
                [job.id]
            );

            if (claimedJobs.length === 0) {
                await client.query('ROLLBACK');
                logger.info(`[QUEUE] Job ${job.id} was already claimed or is no longer eligible.`);
                return;
            }
            job = claimedJobs[0];

            // 3. Fetch Order details
            const { rows: orders } = await client.query(
                `SELECT id, order_number, status, payment_status, total_amount, platform_fee_amount,
                        seller_payout_amount, seller_id, buyer_id, fulfillment_type, order_type,
                        delivery_location, shipping_address, metadata, created_at, updated_at
                 FROM product_orders 
                 WHERE id = $1 
                 FOR UPDATE`,
                [job.order_id]
            );

            if (orders.length === 0) {
                throw new Error(`Order ${job.order_id} not found`);
            }

            let order = orders[0];
            let fulfilledItems = [];

            logger.info(`[QUEUE] Processing fulfillment for Order ${order.id} (Type: ${order.order_type})`);

            await OrderFulfillmentTransitionService.executeFulfillment(client, order);
            const { rows: [updatedOrder] } = await client.query(
                `SELECT id, order_number, status, payment_status, total_amount, platform_fee_amount,
                        seller_payout_amount, seller_id, buyer_id, fulfillment_type, order_type,
                        delivery_location, shipping_address, metadata, created_at, updated_at
                 FROM product_orders 
                 WHERE id = $1`,
                [order.id]
            );
            order = updatedOrder || order;

            const { rows: items } = await client.query(
                `SELECT oi.*, p.product_type::text as product_type, p.is_digital
                 FROM order_items oi
                 LEFT JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id = $1`,
                [order.id]
            );
            fulfilledItems = items;

            // 5. Mark job as completed
            await client.query(
                `UPDATE fulfillment_jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
                [job.id]
            );

            const durableEvent = await eventBus.enqueueInTransaction(client, AppEvents.ORDER.FULFILLED, {
                eventId: `order.fulfilled:${order.id}`,
                order,
                items: fulfilledItems
            });

            await client.query('COMMIT');
            logger.info(`[QUEUE] Job ${job.id} (Order ${order.id}) COMPLETED`);

            eventBus.dispatchAfterCommit(durableEvent.eventId, 'FulfillmentQueueService.processJob');

        } catch (err) {
            await client.query('ROLLBACK');
            logger.error(`[QUEUE] Job ${job.id} FAILED:`, err.message);

            // Update job status to FAILED
            await pool.query(
                `UPDATE fulfillment_jobs 
                 SET status = 'FAILED', 
                     error_message = $1, 
                     updated_at = NOW() 
                 WHERE id = $2`,
                [err.message, job.id]
            );

            // If max attempts reached, log a system issue and transition order to MANUAL_REVIEW
            if (job.attempts >= job.max_attempts) {
                await this.logSystemIssue(job.order_id, 'FULFILLMENT_FAILURE', 'HIGH', {
                    error: err.message,
                    job_id: job.id,
                    attempts: job.attempts
                });
                try {
                    await pool.query(
                        `UPDATE product_orders
                         SET status = 'MANUAL_REVIEW', updated_at = NOW()
                         WHERE id = $1 AND status = 'PAID'`,
                        [job.order_id]
                    );
                    logger.warn(`[QUEUE] Order ${job.order_id} reached max attempts (${job.attempts}). Transitioned to MANUAL_REVIEW.`);
                } catch (transitionErr) {
                    logger.error(`[QUEUE] Could not transition order ${job.order_id} to MANUAL_REVIEW:`, transitionErr.message);
                }
            }
        } finally {
            client.release();
        }
    }

    static async logSystemIssue(orderId, type, severity, details) {
        const query = `
            INSERT INTO system_issues (order_id, issue_type, severity, details)
            VALUES ($1, $2, $3, $4)
        `;
        await pool.query(query, [orderId, type, severity, JSON.stringify(details)]);
        logger.error(`[SYSTEM-ISSUE] ${type} for Order ${orderId}: ${details.error}`);
    }

    /**
     * Operator method: Reset and retry a failed or dead-letter fulfillment job.
     * Resets status to PENDING and returns order from MANUAL_REVIEW to PAID.
     */
    static async retryFailedJob(jobId, operatorOptions = {}) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { rows: jobs } = await client.query(
                `SELECT id, order_id, attempts, max_attempts, status, error_message,
                        last_attempt_at, created_at, updated_at
                 FROM fulfillment_jobs WHERE id = $1 FOR UPDATE`,
                [jobId]
            );
            if (jobs.length === 0) {
                throw new AppError('Fulfillment job not found', 404, 'JOB_NOT_FOUND');
            }
            const job = jobs[0];

            // Concurrency & state guards:
            if (job.status === 'COMPLETED') {
                throw new AppError('Fulfillment job has already completed successfully', 409, 'JOB_ALREADY_COMPLETED');
            }
            if (job.status === 'PENDING') {
                throw new AppError('Fulfillment job is already pending retry', 409, 'JOB_ALREADY_PENDING');
            }
            if (job.status === 'CANCELLED') {
                throw new AppError('Cannot retry a cancelled fulfillment job', 409, 'JOB_CANCELLED');
            }
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            if (job.status === 'PROCESSING' && job.updated_at && new Date(job.updated_at) > tenMinutesAgo) {
                throw new AppError('Fulfillment job is currently being processed by an active worker', 409, 'JOB_ACTIVELY_PROCESSING');
            }

            // Reset job to PENDING
            const { rows: [updatedJob] } = await client.query(
                `UPDATE fulfillment_jobs
                 SET status = 'PENDING',
                     attempts = 0,
                     error_message = NULL,
                     last_attempt_at = NULL,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [jobId]
            );

            // Return order from MANUAL_REVIEW to PAID
            await client.query(
                `UPDATE product_orders
                 SET status = 'PAID', updated_at = NOW()
                 WHERE id = $1 AND status = 'MANUAL_REVIEW'`,
                [job.order_id]
            );

            // Resolve any open system issue
            await client.query(
                `UPDATE system_issues
                 SET resolved = TRUE, updated_at = NOW()
                 WHERE order_id = $1 AND issue_type = 'FULFILLMENT_FAILURE' AND resolved = FALSE`,
                [job.order_id]
            );

            await client.query('COMMIT');
            logger.info(`[OPERATOR] Retried fulfillment job ${jobId} for order ${job.order_id} (operator: ${operatorOptions.operatorId || 'system'})`);
            return updatedJob;
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Operator method: Cancel order and refund buyer when fulfillment cannot be completed.
     */
    static async cancelAndRefundDeadLetter(orderId, options = {}) {
        const { reason = 'Fulfillment permanently failed — cancelled by operator', operatorId = null } = options;

        let result;
        try {
            // Authoritatively cancel order and process wallet refund
            result = await OrderCancellationService.cancelOrder(orderId, reason);
        } catch (err) {
            if (err.code === 'ORDER_ALREADY_CANCELLED') {
                logger.info(`[OPERATOR] Dead-letter order ${orderId} was already cancelled.`);
                result = { orderId, status: 'cancelled', alreadyCancelled: true };
            } else {
                throw err;
            }
        }

        // Mark fulfillment job as terminal CANCELLED
        await pool.query(
            `UPDATE fulfillment_jobs
             SET status = 'CANCELLED',
                 error_message = $1,
                 updated_at = NOW()
             WHERE order_id = $2`,
            [reason, orderId]
        );

        // Mark open system issue as resolved
        await pool.query(
            `UPDATE system_issues
             SET resolved = TRUE, updated_at = NOW()
             WHERE order_id = $1 AND issue_type = 'FULFILLMENT_FAILURE' AND resolved = FALSE`,
            [orderId]
        );

        logger.info(`[OPERATOR] Dead-letter order ${orderId} cancelled and refunded (operator: ${operatorId || 'system'})`);
        return result;
    }

    /**
     * Operator query: Retrieve dead-letter fulfillment jobs requiring review.
     */
    static async getDeadLetterJobs(options = {}) {
        const { limit = 50, offset = 0 } = options;
        const query = `
            SELECT fj.id as job_id, fj.order_id, fj.attempts, fj.max_attempts, fj.status as job_status,
                   fj.error_message, fj.last_attempt_at, fj.created_at as job_created_at,
                   po.order_number, po.status as order_status, po.total_amount, po.order_type,
                   po.buyer_id, po.buyer_email, po.seller_id,
                   si.id as issue_id, si.severity as issue_severity, si.resolved as issue_resolved
            FROM fulfillment_jobs fj
            JOIN product_orders po ON po.id = fj.order_id
            LEFT JOIN system_issues si ON si.order_id = po.id AND si.issue_type = 'FULFILLMENT_FAILURE' AND si.resolved = FALSE
            WHERE fj.status = 'FAILED' AND fj.attempts >= fj.max_attempts
            ORDER BY fj.updated_at DESC
            LIMIT $1 OFFSET $2
        `;
        const { rows } = await pool.query(query, [limit, offset]);
        return rows;
    }
}


export default FulfillmentQueueService;
