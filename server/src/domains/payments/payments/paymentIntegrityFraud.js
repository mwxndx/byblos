/**
 * paymentIntegrityFraud.js
 *
 * Dedicated helper to encapsulate fraud event recording and real-time alert dispatching.
 * Isolates error alerting and database logging from CorePaymentService.js.
 */
import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import { reportAlert } from '../../../shared/utils/alerting.js';

export async function recordFraudEvent(event) {
    try {
        await pool.query(
            `INSERT INTO fraud_events (
                 payment_id,
                 order_id,
                 provider_reference,
                 event_type,
                 expected_amount,
                 provider_amount,
                 payload,
                 details
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
            [
                event.paymentId || null,
                event.orderId || null,
                event.providerReference || null,
                event.eventType,
                event.expectedAmount ?? null,
                event.providerAmount ?? null,
                JSON.stringify(event.payload || {}),
                JSON.stringify(event.details || {})
            ]
        );

        reportAlert({
            level: 'error',
            title: `Payment fraud event: ${event.eventType}`,
            message: `A ${event.eventType} fraud event was recorded on a payment.`,
            context: {
                eventType: event.eventType,
                orderId: event.orderId ?? null,
                paymentId: event.paymentId ?? null,
                providerReference: event.providerReference ?? null,
                expectedAmount: event.expectedAmount ?? null,
                providerAmount: event.providerAmount ?? null
            }
        });
    } catch (error) {
        logger.error('[CorePaymentService] Failed to persist fraud event', {
            original: event,
            error: error.message
        });
    }
}

export async function transitionToManualReview(client, { paymentId, providerReference, reason, details }) {
    const manualReviewMetadata = {
        requires_manual_review: true,
        manual_review_reason: reason,
        completion_blocked: details
    };
    const { rows: reviewRows } = await client.query(
        `UPDATE payments
         SET status = 'manual_review_required'::payment_status,
             provider_reference = COALESCE($1, provider_reference),
             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [
            providerReference,
            JSON.stringify(manualReviewMetadata),
            paymentId
        ]
    );
    return reviewRows[0];
}

export async function handleAmountMismatch(client, { paymentRow, providerReference, providerStatus, providerAmount, dbAmount, source, providerPayload }) {
    const orderId = resolveOrderIdFromMetadata(paymentRow.metadata);
    const fraudEvent = {
        paymentId: paymentRow.id,
        orderId,
        providerReference,
        eventType: 'amount_mismatch',
        expectedAmount: dbAmount,
        providerAmount,
        payload: providerPayload,
        details: {
            source,
            db_amount: dbAmount,
            provider_amount: providerAmount,
            detected_at: new Date().toISOString()
        }
    };
    const details = {
        source,
        provider_status: providerStatus,
        provider_reference: providerReference,
        db_amount: dbAmount,
        provider_amount: providerAmount,
        provider_payload: providerPayload,
        blocked_at: new Date().toISOString()
    };
    const updatedPayment = await transitionToManualReview(client, {
        paymentId: paymentRow.id,
        providerReference,
        reason: 'amount_mismatch',
        details
    });
    logger.error('[CorePaymentService] Payment amount mismatch rejected', {
        paymentId: paymentRow.id,
        reference: providerReference,
        dbAmount,
        providerAmount,
        source
    });
    return { updatedPayment: updatedPayment || paymentRow, fraudEvent, orderId };
}

export async function handleMissingOrderReference(client, { paymentRow, providerReference, providerStatus, isSuccess, providerAmount, source, providerPayload }) {
    const details = {
        source,
        provider_status: providerStatus,
        provider_reference: providerReference,
        provider_payload: providerPayload,
        blocked_at: new Date().toISOString()
    };
    const updatedPayment = await transitionToManualReview(client, {
        paymentId: paymentRow.id,
        providerReference,
        reason: 'missing_order_reference',
        details
    });
    const fraudEvent = {
        paymentId: paymentRow.id,
        orderId: null,
        providerReference,
        eventType: 'missing_order_reference',
        expectedAmount: Number.parseFloat(paymentRow.amount || 0),
        providerAmount: isSuccess ? providerAmount : null,
        payload: providerPayload,
        details: {
            source,
            provider_status: providerStatus,
            allowed_metadata_keys: ['order_id', 'product_order_id'],
            detected_at: new Date().toISOString()
        }
    };
    logger.error('[CorePaymentService] Payment completion blocked for missing order reference', {
        paymentId: paymentRow.id,
        reference: providerReference,
        source
    });
    return { updatedPayment: updatedPayment || paymentRow, fraudEvent };
}

function resolveOrderIdFromMetadata(metadata = {}) {
    if (!metadata) return null;
    const meta = typeof metadata === 'object' ? metadata : JSON.parse(metadata || '{}');
    const rawOrderId = meta.order_id ?? meta.product_order_id ?? null;
    if (rawOrderId === null || rawOrderId === undefined || rawOrderId === '') {
        return null;
    }
    const orderId = Number.parseInt(rawOrderId, 10);
    return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
}

export default {
    recordFraudEvent,
    transitionToManualReview,
    handleAmountMismatch,
    handleMissingOrderReference
};
