/**
 * order.controller.js
 *
 * Delegates runtime order actions to OrderService.
 *
 * Architecture:
 *   OrderController -> OrderService (hardened order module)
 *
 * OrderService owns durable order lifecycle outbox events so WhatsApp and
 * other side effects are fully decoupled from the transaction.
 */
import OrderService from './OrderService.js';
import Order from './order.model.js';
import logger from '../../../shared/utils/logger.js';
import * as digitalDownloadRepository from '../../commerce/repositories/digitalDownload.repository.js';
import path from 'path';
import { sanitizeOrder } from '../../../shared/utils/sanitize.js';
import { isCloudinaryAssetUrl } from '../../../shared/utils/assetUrlGuard.js';
import paymentService from '../../payments/payments/payment.service.js';
import OrderHubDropoffService from './orderHubDropoff.service.js';
import LogisticsEtaService from '../../logistics/logisticsEta.service.js';
import { handleDigitalProductDownload } from './digitalDownloadStreamer.js';
import {
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
} from './orderFulfillmentActions.js';

export const getSellerOrders = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        const { page, limit, status } = req.query;

        const result = await Order.findBySellerId(sellerId, {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            status
        });

        // Sellers can see buyer contact info and fee breakdown — sanitizeOrder with 'seller' context
        const sanitized = result.data.map(order => sanitizeOrder(order, 'seller'));

        res.status(200).json({
            status: 'success',
            data: sanitized,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Error fetching seller orders:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch orders'
        });
    }
};

export const createOrder = async (req, res) => {
    return res.status(410).json({
        status: 'error',
        code: 'DIRECT_ORDER_CREATION_RETIRED',
        message: 'Direct order creation is retired. Start checkout through /api/payments/initiate-product so order, payment, inventory, and fulfillment stay on the protected pipeline.'
    });
};

export const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userType = req.user.userType || req.user.role;

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ status: 'error', message: 'Order not found' });
        }

        // Allow access if requester is the seller OR the buyer on this order
        const isSeller = (req.user.sellerId && order.sellerId === req.user.sellerId);
        const isBuyer = (req.user.buyerId && order.buyerId === req.user.buyerId);

        if (!isSeller && !isBuyer) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }

        // Sanitize based on who is asking — buyers don't see fee data
        res.status(200).json({
            status: 'success',
            data: sanitizeOrder(order, userType)
        });
    } catch (error) {
        logger.error('Error fetching order by ID:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch order' });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Pass req.user (which contains role/id) to service for auth check
        const updatedOrder = await OrderService.updateOrderStatus(id, req.user, status);

        const userType = req.user.userType || req.user.role;
        res.status(200).json({
            status: 'success',
            data: sanitizeOrder(updatedOrder, userType)
        });
    } catch (error) {
        logger.error('Error updating order status:', error);
        const statusCode = resolveOrderStatusUpdateStatusCode(error);

        res.status(statusCode).json({
            status: 'error',
            message: error.message,
            ...(error.code ? { code: error.code } : {})
        });
    }
};

export const requestSellerPickup = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        if (!sellerId) {
            return res.status(403).json({ status: 'error', message: 'Seller profile is required' });
        }

        const result = await handleSellerPickupRequest({
            orderId: req.params.id,
            sellerId,
            headers: req.headers,
            body: req.body
        });

        res.status(200).json({
            status: 'success',
            message: result.alreadyPending
                ? 'Pickup payment is already pending confirmation.'
                : 'Pickup payment initiated. Check your phone.',
            data: result
        });
    } catch (error) {
        logger.error('Error requesting seller pickup:', error);
        const statusCode = resolvePickupStatusCode(error);
        res.status(statusCode).json({
            status: 'error',
            message: error.message || 'Failed to request pickup'
        });
    }
};

export const selectHubDropoff = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        if (!sellerId) {
            return res.status(403).json({ status: 'error', message: 'Seller profile is required' });
        }

        const sanitizedOrder = await handleSelectHubDropoff({ orderId: req.params.id, sellerId });
        res.status(200).json({
            status: 'success',
            message: 'Hub drop-off selected. Drop the package at the hub within 24 hours.',
            data: sanitizedOrder
        });
    } catch (error) {
        logger.error('Error selecting hub drop-off:', error);
        const statusCode = resolveHubStatusCode(error);
        res.status(statusCode).json({ status: 'error', message: error.message || 'Failed to select hub drop-off' });
    }
};

export const markDroppedAtHub = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        if (!sellerId) {
            return res.status(403).json({ status: 'error', message: 'Seller profile is required' });
        }

        const sanitizedOrder = await handleMarkDroppedAtHub({ orderId: req.params.id, sellerId });
        res.status(200).json({
            status: 'success',
            message: 'Package marked as dropped at the hub.',
            data: sanitizedOrder
        });
    } catch (error) {
        logger.error('Error marking dropped at hub:', error);
        const statusCode = resolveHubStatusCode(error);
        res.status(statusCode).json({ status: 'error', message: error.message || 'Failed to mark package dropped at hub' });
    }
};

export const confirmBooking = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        if (!sellerId) {
            return res.status(403).json({ status: 'error', message: 'Seller profile is required' });
        }

        const sanitizedOrder = await handleConfirmBooking({ orderId: req.params.id, sellerId });
        res.status(200).json({
            status: 'success',
            message: 'Booking confirmed.',
            data: sanitizedOrder
        });
    } catch (error) {
        logger.error('Error confirming booking:', error);
        const statusCode = resolveHubStatusCode(error);
        res.status(statusCode).json({ status: 'error', message: error.message || 'Failed to confirm booking' });
    }
};

export const getUserOrders = async (req, res) => {
    try {
        // CROSS-ROLE FIX
        const buyerId = req.user.buyerId;

        if (!buyerId) {
            return res.status(200).json({ success: true, status: 'success', data: [], pagination: {} });
        }
        const { page, limit, status } = req.query;

        const result = await Order.findByBuyerId(buyerId, {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            status
        });

        const sanitized = result.data.map(order => sanitizeOrder(order, 'buyer'));

        res.status(200).json({
            success: true, // Match route schema
            status: 'success',
            data: sanitized,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Error fetching user orders:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch orders'
        });
    }
};

export const confirmReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const buyerId = req.user.buyerId;  // buyers.id

        if (!buyerId) {
            return res.status(403).json({ status: 'error', message: 'No buyer profile found' });
        }

        const updatedOrder = await OrderService.confirmOrderReceipt(id, buyerId);
        res.status(200).json({
            status: 'success',
            message: 'Order receipt confirmed',
            data: sanitizeOrder(updatedOrder, 'buyer')
        });
    } catch (error) {
        logger.error('Error confirming receipt:', error);
        const status = resolveReceiptStatusCode(error);
        res.status(status).json({ status: 'error', message: error.message });
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const buyerId = req.user.buyerId;  // must be this, not req.user.id

        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
        if (String(order.buyer_id || order.buyerId) !== String(buyerId)) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const updatedOrder = await OrderService.cancelOrder(id, 'Buyer requested cancellation');
        res.status(200).json({ status: 'success', message: 'Order cancelled', data: { order: sanitizeOrder(updatedOrder, 'buyer') } });
    } catch (error) {
        logger.error('Error cancelling order:', error);
        const statusCode = error.statusCode || 400;
        res.status(statusCode).json({
            status: 'error',
            error: error.code || 'ORDER_CANCELLATION_FAILED',
            message: error.message
        });
    }
};

export const getByReference = async (req, res) => {
    try {
        const { reference } = req.params;
        const order = await Order.findByReference(reference);

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found for this reference'
            });
        }

        if (!authorizeOrderReferenceAccess({ order, req })) {
            return res.status(403).json({
                status: 'error',
                code: 'UNAUTHORIZED_ORDER_ACCESS',
                message: 'Access denied: valid checkout capability token or authenticated ownership required.'
            });
        }

        // Return a structure compatible with CheckoutPage.tsx
        res.status(200).json({
            success: true,
            status: 'success',
            data: {
                orderNumber: order.orderNumber,
                status: order.status.toLowerCase(),
                message: `Order status is ${order.status}`,
                paymentStatus: order.paymentStatus
            }
        });
    } catch (error) {
        logger.error('Error fetching order by reference:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch order by reference'
        });
    }
};

export const sellerCancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const sellerProfileId = req.user.sellerId;  // sellers.id from crossRoles

        if (!sellerProfileId) {
            return res.status(403).json({ status: 'error', message: 'No seller profile found' });
        }

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ status: 'error', message: 'Order not found' });
        }

        // Compare sellers.id with sellers.id
        if (String(order.seller_id || order.sellerId) !== String(sellerProfileId)) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }

        const updatedOrder = await OrderService.cancelOrder(id, 'Seller requested cancellation');
        res.status(200).json({
            status: 'success',
            message: 'Order cancelled',
            data: { order: sanitizeOrder(updatedOrder, 'seller') }
        });
    } catch (error) {
        logger.error('Error cancelling order (seller):', error);
        const statusCode = error.statusCode || 400;
        res.status(statusCode).json({
            status: 'error',
            error: error.code || 'ORDER_CANCELLATION_FAILED',
            message: error.message
        });
    }
};

export const downloadDigitalProduct = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const buyerProfileId = req.user?.buyerId;
        const clientCheckoutToken = req.headers['x-checkout-token']
            || req.query.client_checkout_token
            || req.query.clientCheckoutToken;

        if (!buyerProfileId && !clientCheckoutToken) {
            return res.status(401).json({
                status: 'error',
                message: 'Authentication or checkout token is required to download this product'
            });
        }

        await handleDigitalProductDownload({ orderId, productId, buyerProfileId, clientCheckoutToken, res });
    } catch (error) {
        logger.error('Error in downloadDigitalProduct:', error);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Download failed' });
        }
    }
};
export const locationPreview = async (req, res) => {
    try {
        const { latitude, longitude, fullAddress } = req.body;

        // Basic validation
        if (!latitude || !longitude) {
            return res.status(400).json({
                status: 'error',
                message: 'Latitude and longitude are required for location preview'
            });
        }

        // Return the parsed location data for front-end preview
        res.status(200).json({
            status: 'success',
            data: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                fullAddress: fullAddress || 'Address not provided',
                mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`
            }
        });
    } catch (error) {
        logger.error('Error in location preview:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process location preview'
        });
    }
};
export const getOrderLiveEta = async (req, res) => {
    try {
        const { id } = req.params;
        const clientCheckoutToken = req.headers['x-checkout-token']
            || req.query.client_checkout_token
            || req.query.clientCheckoutToken;

        const result = await LogisticsEtaService.getOrderLiveEta({
            orderId: id,
            user: req.user,
            clientCheckoutToken
        });

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        logger.error('Error fetching order live ETA:', error);
        const statusCode = resolveLiveEtaStatusCode(error);
        res.status(statusCode).json({
            status: 'error',
            message: error.message
        });
    }
};
