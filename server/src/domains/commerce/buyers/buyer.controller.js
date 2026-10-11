import BuyerService from './buyer.service.js';
import Buyer from './buyer.model.js';
import User from '../../identity/users/user.model.js';
import { AppError } from '../../../shared/utils/errorHandler.js';
import { sanitizeBuyer, sanitizeOrder, sanitizeWithdrawalRequest } from '../../../shared/utils/sanitize.js';
import logger from '../../../shared/utils/logger.js';
import AuthService from '../../identity/auth/auth.service.js';
import { setAuthCookie } from '../../../shared/utils/cookie.utils.js';
import { signToken, verifyToken } from '../../../shared/utils/jwt.js';
import { generateRefreshToken } from '../../../shared/utils/refreshToken.js';
import { revokeSessionTokens, clearAuthCookies } from '../../../shared/utils/sessionRevocation.js';
import OrderModel from "../../orders/order/order.model.js";
import { OrderStatus } from "../../../shared/constants/enums.js";
import WithdrawalService from '../../payments/withdrawals/withdrawal.service.js';
import { pool } from '../../../infrastructure/database/database.js';
import { addBusinessDays } from '../../orders/escrow/settlement.service.js';
import Fees from '../../../shared/config/fees.js';

import {
  createSendToken,
  autoProvisionBuyerProfile,
  updateBuyerProfileHelper,
  registerBuyerHandler,
  handleLoginError,
  verifyEmailHelper,
  resolveBuyerProfile
} from './buyerAuthHelper.js';

export const logout = async (req, res) => {
  // Revoke BOTH the access token and the refresh token so the session truly ends.
  await revokeSessionTokens(req);
  clearAuthCookies(res);
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
};

export const register = async (req, res, next) => {
  try {
    const outcome = await registerBuyerHandler({ body: req.body, res, next });
    if (outcome.isPending) {
      return res.status(200).json(outcome.response);
    }
    return createSendToken(outcome.loginData, 201, req, res);
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    const data = await AuthService.login(email, password, 'buyer', req.body.acceptTerms === true);
    if (!data) {
      return next(new AppError('Invalid email or password', 401));
    }

    createSendToken(data, 200, req, res, next);
  } catch (error) {
    handleLoginError(error, res, next);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide an email address'
      });
    }

    await AuthService.forgotPassword(email, 'buyer');

    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email, you will receive a password reset link.'
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while processing your request'
    });
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword, email } = req.body; // Added email

    // 1) Validate input
    if (!token || !newPassword || !email) {
      return next(new AppError('Token, email, and new password are required', 400));
    }

    // 2) Reset password using AuthService
    try {
      await AuthService.resetPassword(email, token, newPassword);
    } catch (err) {
      return next(new AppError(err.message || 'Invalid or expired token', 400));
    }

    // 3) Log the buyer in, send JWT
    const data = await AuthService.login(email, newPassword, 'buyer');

    createSendToken(data, 200, req, res);
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.query;
    const { message, data } = await verifyEmailHelper({ token, email, res });

    return res.status(200).json({
      status: 'success',
      message,
      data
    });
  } catch (error) {
    logger.error('Email verification failed:', error.message);
    return res.status(error.statusCode || 400).json({
      status: 'error',
      message: error.message
    });
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    await AuthService.resendVerificationEmail(email.toLowerCase().trim(), 'buyer');

    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email and is unverified, a new verification link has been sent.'
    });
  } catch (error) {
    logger.error('Resend verification failed:', error.message);
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email and is unverified, a new verification link has been sent.'
    });
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const buyer = await resolveBuyerProfile(req.user);

    if (!buyer) {
      return next(new AppError('No buyer profile found for this account', 404));
    }

    buyer.is_verified = req.user.is_verified;

    res.status(200).json({
      status: 'success',
      data: { buyer: sanitizeBuyer(buyer) }
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { password, passwordConfirm, ...rawUpdateData } = req.body;
    const { message, buyer } = await updateBuyerProfileHelper({
      buyerId: req.user.buyerId,
      userId: req.user.id,
      rawUpdateData,
      password,
      passwordConfirm
    });

    res.status(200).json({
      status: 'success',
      message,
      data: {
        buyer: sanitizeBuyer(buyer),
      },
    });
  } catch (error) {
    logger.error('Error in updateProfile:', error);
    next(error);
  }
};

// Save buyer information (for guest checkouts) - Public endpoint
// Helper function to normalize phone numbers
const normalizePhoneNumber = (phone) => {
  if (!phone) return null;

  // Remove all spaces, dashes, and parentheses
  let normalized = phone.replace(/[\s\-\(\)]/g, '');

  // Remove leading + if present
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }

  // Remove leading 254 if present (Kenya country code)
  if (normalized.startsWith('254')) {
    normalized = '0' + normalized.substring(3);
  }

  // Ensure it starts with 0
  if (!normalized.startsWith('0')) {
    normalized = '0' + normalized;
  }


  return normalized;
};

// Check if buyer exists by phone number (public endpoint)
export const checkBuyerByPhone = async (req, res, next) => {
  try {
    const { phone } = req.body;



    // Validate required field
    if (!phone) {
      return next(new AppError('Phone number is required', 400));
    }

    // Check if buyer exists by phone number (let model handle variations)
    const existingBuyer = await Buyer.findByPhone(phone);

    if (existingBuyer) {
      // Buyer exists - return buyer info BUT NO TOKEN
      // logger.info('Buyer found with phone');

      // SECURITY FIX: Do not generate token here
      // const token = signToken(existingBuyer.id, 'buyer');

      res.status(200).json({
        status: 'success',
        data: {
          exists: true,
          buyer: {
            hasEmail: !!existingBuyer.email,
          }
        }
      });
    } else {
      res.status(200).json({
        status: 'success',
        data: {
          exists: false
        }
      });
    }
  } catch (error) {
    logger.error('Error in checkBuyerByPhone:', error);
    next(error);
  }
};

import { getBuyerRefundClearance, processBuyerRefundRequest } from './buyerRefund.service.js';
export { getBuyerRefundClearance };

/**
 * Get buyer's pending refund requests and T+2 clearance status
 */
export const getPendingRefundRequests = async (req, res, next) => {
  try {
    const buyerId = req.user.buyerId;
    const [pendingWithdrawalsResult, clearance] = await Promise.all([
      WithdrawalService.getRefundWithdrawalsForBuyer(buyerId, {
        status: 'processing',
        limit: 50
      }),
      getBuyerRefundClearance(buyerId)
    ]);

    const pendingRequests = pendingWithdrawalsResult.rows;

    res.status(200).json({
      status: 'success',
      data: {
        pendingRequests: pendingRequests.map(request => sanitizeWithdrawalRequest(request)),
        hasPending: pendingRequests.length > 0,
        ...clearance
      }
    });
  } catch (error) {
    logger.error('Error fetching pending refund requests:', error);
    next(error);
  }
};

/**
 * Get the buyer's full refund withdrawal history (all statuses: processing,
 * completed, failed, …). Read-only — powers the Refunds tab history list.
 */
export const getRefundHistory = async (req, res, next) => {
  try {
    const buyerId = req.user.buyerId;
    // status omitted → all statuses (getRefundWithdrawalsForBuyer defaults status to null)
    const { rows } = await WithdrawalService.getRefundWithdrawalsForBuyer(buyerId, { limit: 100 });
    res.status(200).json({
      status: 'success',
      data: {
        requests: rows.map(request => sanitizeWithdrawalRequest(request))
      }
    });
  } catch (error) {
    logger.error('Error fetching refund history:', error);
    next(error);
  }
};

/**
 * Request refund withdrawal
 * Enforces minimum withdrawal amount (KSh 50), withdrawal charges, and T+2 clearance.
 */
export const requestRefund = async (req, res, next) => {
  try {
    const { amount, mpesaNumber, mpesaName } = req.body;
    const buyerId = req.user.buyerId;
    const idempotencyKey = req.get('Idempotency-Key') || req.body.idempotencyKey || null;

    const { request, withdrawalFee, totalDeducted, withdrawalAmount } = await processBuyerRefundRequest({
      buyerId,
      amount,
      mpesaNumber,
      mpesaName,
      idempotencyKey
    });

    logger.info(`Refund withdrawal request created: ${request.id} for buyer ${buyerId}, amount: ${withdrawalAmount}, fee: ${withdrawalFee}, total: ${totalDeducted}`);

    res.status(201).json({
      status: 'success',
      message: 'Refund withdrawal submitted successfully. You will be notified once processed.',
      data: {
        requestId: request.id,
        withdrawal: sanitizeWithdrawalRequest(request),
        withdrawalFee,
        totalDeducted
      }
    });
  } catch (error) {
    logger.error('Error in requestRefund:', error);
    next(error);
  }
};

import { z } from 'zod';

const buyerInfoSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  mobilePayment: z.string().optional(),
  whatsappNumber: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  location: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
}).refine(data => data.phone || data.mobilePayment || data.whatsappNumber, {
  message: "At least one contact method (phone, mobilePayment, or whatsappNumber) is required",
  path: ["phone"]
});

import { processGuestBuyerRegistration } from './guestBuyerRegistration.service.js';

export const saveBuyerInfo = async (req, res, next) => {
  try {
    const validatedData = buyerInfoSchema.parse(req.body);

    if (!req.body.termsAccepted) {
      return next(new AppError('You must accept the Terms and Conditions to continue.', 400));
    }

    const { statusCode, response } = await processGuestBuyerRegistration({
      ...validatedData,
      termsAccepted: req.body.termsAccepted,
      res
    });

    return res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Error in saveBuyerInfo:', error);
    next(error);
  }
};

export const autoLogin = async (req, res, next) => {
  try {
    const { autoLoginToken } = req.body;

    if (!autoLoginToken) {
      return next(new AppError('Auto-login token is required', 400));
    }

    // Verify the token
    let decoded;
    try {
      decoded = verifyToken(autoLoginToken);
    } catch (err) {
      return next(new AppError('Invalid or expired auto-login token', 401));
    }

    // Verify it's actually an auto-login token (not a regular JWT)
    if (!decoded.autoLogin || decoded.purpose !== 'payment_success') {
      return next(new AppError('Invalid token type', 401));
    }

    // Fetch the buyer profile
    const buyer = await Buyer.findByUserId(decoded.id);
    if (!buyer) {
      return next(new AppError('Buyer profile not found', 404));
    }

    // Exchange the short-lived auto-login token for a normal buyer session cookie.
    const sessionToken = signToken(decoded.id, 'buyer');
    setAuthCookie(res, sessionToken);

    logger.info(`[AUTO-LOGIN] Buyer ${buyer.id} auto-logged in after payment success`);

    return res.status(200).json({
      status: 'success',
      message: 'Logged in successfully',
      data: {
        buyer: sanitizeBuyer(buyer),
        redirectTo: '/buyer/orders' // tells frontend where to go
      }
    });

  } catch (error) {
    logger.error('Error in autoLogin:', error);
    next(error);
  }
};

export const markOrderAsCollected = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const buyerId = req.user.buyerId;  // buyers.id from crossRoles

    if (!buyerId) {
      return next(new AppError('No buyer profile found. Cannot collect order.', 403));
    }

    const orderData = await OrderModel.findById(orderId);
    if (!orderData) {
      return next(new AppError('Order not found', 404));
    }

    // Compare buyers.id with buyers.id
    if (String(orderData.buyerId) !== String(buyerId)) {
      return next(new AppError('You can only collect your own orders', 403));
    }

    const updatedOrder = await OrderService.markAsCollected(orderId, buyerId);

    res.status(200).json({
      status: 'success',
      data: { order: sanitizeOrder(updatedOrder, 'buyer') }
    });
  } catch (error) {
    next(error);
  }
};


// Self-service account deletion (Google Play data-deletion requirement).
export const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    let buyerId = req.user.buyerId;
    if (!buyerId && userId) {
      const buyer = await Buyer.findByUserId(userId);
      buyerId = buyer?.id;
    }
    if (!buyerId) {
      return next(new AppError('Buyer account not found.', 404));
    }
    await Buyer.softDeleteAccount(buyerId, userId);
    res.clearCookie('token');
    res.status(200).json({ status: 'success', message: 'Your account has been deleted.' });
  } catch (error) {
    next(error);
  }
};
