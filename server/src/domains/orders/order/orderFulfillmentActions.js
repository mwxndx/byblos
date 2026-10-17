/**
 * orderFulfillmentActions.js
 *
 * Dedicated helper isolating order pickup, hub dropoff, and booking workflows.
 * Extracts nested error-mapping heuristics from order.controller.js.
 */
import crypto from 'node:crypto';
import paymentService from '../../payments/payments/payment.service.js';
import OrderHubDropoffService from './orderHubDropoff.service.js';
import OrderService from './OrderService.js';
import { sanitizeOrder } from '../../../shared/utils/sanitize.js';

export function safeTokenCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

export function resolvePickupStatusCode(error) {
    if (error.statusCode) return error.statusCode;
    const msg = error.message || '';
    if (msg.includes('not found')) return 404;
    if (msg.includes('already')) return 409;
    if (msg.includes('only') || msg.includes('required') || msg.includes('Valid')) return 400;
    return 500;
}

export function resolveHubStatusCode(error) {
    if (error.statusCode) return error.statusCode;
    const msg = error.message || '';
    if (msg.includes('Unauthorized') || msg.includes('not found')) return 404;
    if (msg.includes('only') || msg.includes('cannot') || msg.includes('Cannot') || msg.includes('after')) return 400;
    return 500;
}

export async function handleSellerPickupRequest({ orderId, sellerId, headers, body }) {
    const idempotencyKey = headers['idempotency-key']
        || headers['x-checkout-token']
        || body.idempotencyKey
        || body.checkout_token
        || null;

    return paymentService.initiateSellerPickupPayment({
        orderId,
        sellerId,
        pickupLocation: body.pickupLocation || body.location,
        mobilePayment: body.mobilePayment || body.phone,
        idempotencyKey
    });
}

export async function handleSelectHubDropoff({ orderId, sellerId }) {
    const updatedOrder = await OrderHubDropoffService.selectHubDropoff(orderId, sellerId);
    return sanitizeOrder(updatedOrder, 'seller');
}

export async function handleMarkDroppedAtHub({ orderId, sellerId }) {
    const updatedOrder = await OrderHubDropoffService.markDroppedAtHub(orderId, sellerId);
    return sanitizeOrder(updatedOrder, 'seller');
}

export async function handleConfirmBooking({ orderId, sellerId }) {
    const updatedOrder = await OrderService.confirmBooking(orderId, sellerId);
    return sanitizeOrder(updatedOrder, 'seller');
}

export function resolveReceiptStatusCode(error) {
    if (error.statusCode) return error.statusCode;
    const msg = error.message || '';
    if (msg.includes('Unauthorized')) return 401;
    if (msg.includes('not found')) return 404;
    return 400;
}

export function resolveLiveEtaStatusCode(error) {
    if (error.statusCode) return error.statusCode;
    const msg = error.message || '';
    if (msg.includes('Unauthorized')) return 403;
    if (msg.includes('not found')) return 404;
    return 500;
}

export function resolveOrderStatusUpdateStatusCode(error) {
    if (error.statusCode) return error.statusCode;
    const msg = error.message || '';
    if (msg.includes('Unauthorized')) return 403;
    if (msg.includes('Invalid')) return 400;
    return 500;
}

export function authorizeOrderReferenceAccess({ order, req }) {
    const clientToken = req.headers['x-checkout-token']
        || req.query.client_checkout_token
        || req.query.clientCheckoutToken;

    const isTokenAuthorized = Boolean(
        clientToken && order.clientCheckoutToken && safeTokenCompare(clientToken, order.clientCheckoutToken)
    );
    const isUserAuthorized = Boolean(
        req.user && (
            req.user.role === 'admin'
            || (req.user.buyerId && String(order.buyerId) === String(req.user.buyerId))
            || (req.user.sellerId && String(order.sellerId) === String(req.user.sellerId))
        )
    );

    return isTokenAuthorized || isUserAuthorized;
}

export default {
    resolvePickupStatusCode,
    resolveHubStatusCode,
    resolveReceiptStatusCode,
    resolveLiveEtaStatusCode,
    resolveOrderStatusUpdateStatusCode,
    authorizeOrderReferenceAccess,
    handleSellerPickupRequest,
    handleSelectHubDropoff,
    handleMarkDroppedAtHub,
    handleConfirmBooking
};
