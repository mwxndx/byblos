/**
 * paymentOrderCompletionHelper.js
 *
 * Dedicated helper to handle compensation order updates, late-payment auto-refunds,
 * custom production SLA calculations, and failure rollbacks.
 * Decouples complex nested branches from CorePaymentService.js completeVerifiedPayment.
 */
import logger from '../../../shared/utils/logger.js';
import { reportAlert } from '../../../shared/utils/alerting.js';
import refundPolicyService from '../refunds/refundPolicy.service.js';
import refundExecutionService from '../refunds/refundExecution.service.js';
import FulfillmentQueueService from '../../orders/fulfillment/fulfillmentQueue.service.js';
import { releaseOrderReservations } from '../../../shared/utils/reservationRelease.js';

export const FULFILLABLE_ORDER_STATUSES = new Set(['CREATED', 'RESERVED', 'HELD', 'PAYMENT_PENDING', 'PENDING']);
export const PAID_TERMINAL_ORDER_STATUSES = new Set([
    'PAID',
    'AWAITING_SELLER_ACTION',
    'FULFILLING',
    'READY_FOR_BUYER',
    'PROCESSING',
    'FULFILLMENT_PENDING',
    'FULFILLED',
    'DELIVERED',
    'BOOKED',
    'COMPLETED'
]);
export const CANNOT_FULFILL_ORDER_STATUSES = new Set(['CANCELLED', 'EXPIRED', 'REFUNDED', 'FAILED', 'MANUAL_REVIEW', 'COMPENSATION_REQUIRED']);

export function parseJson(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

export function resolveCustomProductionPatch(orderRow = {}, paidAt = new Date()) {
    const metadata = parseJson(orderRow.metadata);
    const customProduct = metadata.custom_product || {};
    const preHandoffSla = metadata.pre_handoff_sla || null;
    const hasCustomProduct = customProduct.is_custom_product === true;
    const hasPreHandoffSla = preHandoffSla?.type === 'custom_production' || preHandoffSla?.type === 'import_waiting';
    if (!hasCustomProduct && !hasPreHandoffSla) return null;

    const readyDays = Number.parseInt(
        preHandoffSla?.ready_days
        || preHandoffSla?.production_days
        || preHandoffSla?.import_days
        || customProduct.production_days,
        10
    );
    if (!Number.isInteger(readyDays) || readyDays < 1 || readyDays > 30) return null;

    const productionDeadline = new Date(paidAt.getTime() + readyDays * 24 * 60 * 60 * 1000);
    const graceDeadline = new Date(productionDeadline.getTime() + 24 * 60 * 60 * 1000);
    const nextPreHandoffSla = preHandoffSla ? {
        ...preHandoffSla,
        ready_deadline_at: productionDeadline.toISOString(),
        ready_grace_deadline_at: graceDeadline.toISOString()
    } : null;

    return {
        productionDeadline,
        graceDeadline,
        metadataPatch: {
            ...(nextPreHandoffSla ? { pre_handoff_sla: nextPreHandoffSla } : {}),
            custom_product: hasCustomProduct ? {
                ...customProduct,
                production_deadline_at: productionDeadline.toISOString(),
                production_grace_deadline_at: graceDeadline.toISOString()
            } : customProduct
        }
    };
}

export async function handleLatePaymentCompensation({ client, orderId, orderRow, paymentRow, providerReference, receipt, source }) {
    const currentStatus = String(orderRow.status || '').toUpperCase();

    const { rows: latePaymentRows } = await client.query(
        `UPDATE product_orders
         SET status = 'COMPENSATION_REQUIRED'::order_status,
             payment_status = 'completed'::payment_status,
             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [orderId, JSON.stringify({
            late_payment: {
                payment_id: paymentRow.id,
                previous_status: currentStatus,
                source,
                received_at: new Date().toISOString()
            }
        })]
    );
    const updatedOrderRow = latePaymentRows[0];
    logger.error('[CorePaymentService] Late payment needs compensation review', {
        paymentId: paymentRow.id,
        orderId,
        previousStatus: currentStatus
    });

    if (updatedOrderRow?.buyer_id) {
        try {
            const policyResult = await refundPolicyService.evaluateRefundEligibility(client, {
                orderId,
                buyerId: updatedOrderRow.buyer_id,
                amount: paymentRow.amount,
                reason: 'late_payment_on_cancelled_order'
            });

            const paymentDetailsPayload = {
                payment_id: paymentRow.id,
                order_id: orderId,
                order_number: updatedOrderRow.order_number,
                provider_reference: providerReference,
                receipt,
                reason: 'late_payment_on_cancelled_order',
                policy_decision: policyResult.decision,
                policy_reason: policyResult.reason,
                policy_version: policyResult.policyVersion
            };

            if (policyResult.decision === 'AUTO_APPROVE') {
                logger.info('[CorePaymentService] Auto-approving late payment refund', {
                    orderId,
                    buyerId: updatedOrderRow.buyer_id,
                    amount: paymentRow.amount,
                    reason: policyResult.reason
                });

                const autoRefund = await refundExecutionService.createAndExecuteAutoRefundWithClient(client, {
                    buyerId: updatedOrderRow.buyer_id,
                    orderId,
                    amount: paymentRow.amount,
                    paymentMethod: paymentRow.payment_method || 'mpesa',
                    paymentDetails: paymentDetailsPayload,
                    reason: policyResult.reason,
                    source: 'auto_policy_late_payment'
                });

                const buyerName = updatedOrderRow.customer_name || null;
                const buyerPhone = updatedOrderRow.customer_phone || null;
                refundExecutionService.dispatchRefundCompletedEvent({
                    refundRequestId: autoRefund.id,
                    buyerId: updatedOrderRow.buyer_id,
                    amount: Number.parseFloat(paymentRow.amount),
                    adminNotes: `Auto-approved by policy: ${policyResult.reason}`,
                    buyerName,
                    buyerPhone
                }).catch(evtErr => logger.warn('[CorePaymentService] Event dispatch failed for auto-refund:', evtErr.message));
            } else {
                logger.info('[CorePaymentService] Routing late payment refund to manual review', {
                    orderId,
                    buyerId: updatedOrderRow.buyer_id,
                    amount: paymentRow.amount,
                    reason: policyResult.reason
                });

                await client.query(
                    `INSERT INTO refund_requests (buyer_id, order_id, amount, status, notes, payment_method, payment_details)
                     VALUES ($1, $2, $3, 'manual_review', $4, $5, $6::jsonb)`,
                    [
                        updatedOrderRow.buyer_id,
                        orderId,
                        paymentRow.amount,
                        `Late payment of ${paymentRow.amount} KES received for cancelled order #${updatedOrderRow.order_number || orderId}. Manual review: ${policyResult.reason}`,
                        paymentRow.payment_method || 'mpesa',
                        JSON.stringify(paymentDetailsPayload)
                    ]
                );
            }
        } catch (err) {
            logger.error('[CorePaymentService] Failed to record/process late payment refund:', err.message);
            reportAlert({
                level: 'error',
                title: 'Late-payment compensation refund handling failed',
                message: `Order ${orderId} is COMPENSATION_REQUIRED but its refund processing failed (${err.message}).`,
                context: { orderId, paymentId: paymentRow.id }
            });
        }
    }

    return updatedOrderRow;
}

export async function handlePaidOrderTransition({ client, orderId, orderRow, completedAt }) {
    const currentStatus = String(orderRow.status || '').toUpperCase();
    const customProductionPatch = resolveCustomProductionPatch(orderRow, completedAt);
    let updatedOrder = orderRow;

    if (!PAID_TERMINAL_ORDER_STATUSES.has(currentStatus)) {
        const { rows: paidOrders } = await client.query(
            `UPDATE product_orders
             SET status = 'PAID'::order_status,
                 payment_status = 'completed'::payment_status,
                 custom_production_deadline_at = COALESCE(custom_production_deadline_at, $2),
                 custom_production_grace_deadline_at = COALESCE(custom_production_grace_deadline_at, $3),
                 metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [
                orderId,
                customProductionPatch?.productionDeadline || null,
                customProductionPatch?.graceDeadline || null,
                JSON.stringify(customProductionPatch?.metadataPatch || {})
            ]
        );
        updatedOrder = paidOrders[0];
    } else if (customProductionPatch && !orderRow.custom_production_deadline_at) {
        const { rows: updatedCustomRows } = await client.query(
            `UPDATE product_orders
             SET custom_production_deadline_at = $2,
                 custom_production_grace_deadline_at = $3,
                 metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [
                orderId,
                customProductionPatch.productionDeadline,
                customProductionPatch.graceDeadline,
                JSON.stringify(customProductionPatch.metadataPatch)
            ]
        );
        updatedOrder = updatedCustomRows[0] || orderRow;
    }

    await FulfillmentQueueService.enqueue(client, orderId);
    return updatedOrder;
}

export async function handleFailedOrderTransition({ client, orderId, paymentRow, source, providerStatus }) {
    const releaseResult = await releaseOrderReservations(client, orderId);
    const { rows: failedOrders } = await client.query(
        `UPDATE product_orders
         SET status = 'FAILED'::order_status,
             payment_status = 'failed'::payment_status,
             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [orderId, JSON.stringify({
            payment_failure: {
                payment_id: paymentRow.id,
                source,
                provider_status: providerStatus,
                released_inventory: releaseResult.releasedInventory,
                released_slots: releaseResult.releasedSlots,
                failed_at: new Date().toISOString()
            }
        })]
    );
    return failedOrders[0];
}

export default {
    CANNOT_FULFILL_ORDER_STATUSES,
    PAID_TERMINAL_ORDER_STATUSES,
    FULFILLABLE_ORDER_STATUSES,
    parseJson,
    resolveCustomProductionPatch,
    handleLatePaymentCompensation,
    handlePaidOrderTransition,
    handleFailedOrderTransition
};
