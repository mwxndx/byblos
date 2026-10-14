/**
 * buyerAuthHelper.js
 *
 * Dedicated helper to encapsulate buyer auth token creation, cookies, and profile provisioning.
 */
import { setAuthCookie, setRefreshTokenCookie } from '../../../shared/utils/cookie.utils.js';
import { signToken } from '../../../shared/utils/jwt.js';
import { generateRefreshToken } from '../../../shared/utils/refreshToken.js';
import { sanitizeBuyer } from '../../../shared/utils/sanitize.js';
import logger from '../../../shared/utils/logger.js';
import { AppError } from '../../../shared/utils/errorHandler.js';
import Buyer from './buyer.model.js';
import User from '../../identity/users/user.model.js';
import AuthService from '../../identity/auth/auth.service.js';

export const createSendToken = (data, statusCode, req, res, next) => {
  let token, buyer, user;

  if (data.token && data.profile) {
    token = data.token;
    buyer = data.profile;
    user = data.user;
  } else {
    buyer = data;
    const userId = buyer.user_id || buyer.userId;
    if (!userId) {
      logger.error('[AUTH] Cannot create token: buyer has no user_id', buyer.id);
      return next(new AppError('Authentication error. Please contact support.', 500));
    }
    token = signToken(userId, 'buyer');
  }

  setAuthCookie(res, token);
  if (buyer.password) buyer.password = undefined;

  const buyerUserId = user?.id || buyer?.user_id || buyer?.userId;
  const refreshToken = buyerUserId ? generateRefreshToken(buyerUserId, 'buyer') : undefined;
  setRefreshTokenCookie(res, refreshToken);

  if (user && user.is_verified !== undefined) {
    buyer.is_verified = user.is_verified;
  }

  return res.status(statusCode).json({
    status: 'success',
    message: (statusCode === 201 && !user?.is_verified)
      ? 'Account created! Please check your email to verify your account.'
      : (statusCode === 201 ? 'Account updated!' : undefined),
    data: {
      buyer: sanitizeBuyer(buyer),
      token: token,
      refreshToken: refreshToken,
      emailVerificationRequired: !user?.is_verified,
      emailVerificationSent: statusCode === 201 && !user?.is_verified
    }
  });
};

export const autoProvisionBuyerProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const buyer = await Buyer.create({
    fullName: user.full_name || user.email?.split('@')[0] || 'Buyer',
    email: user.email,
    mobilePayment: user.phone || '',
    whatsappNumber: user.phone || '',
    city: 'Nairobi',
    location: 'Nairobi',
    userId: user.id,
    termsAccepted: true
  });
  logger.info(`[BUYER-PROFILE] Auto-provisioned buyer profile for user ${userId}`);
  return buyer;
};

export const updateBuyerProfileHelper = async ({ buyerId, userId, rawUpdateData, password, passwordConfirm }) => {
  const allowedProfileFields = new Set([
    'fullName',
    'mobilePayment',
    'whatsappNumber',
    'city',
    'location',
    'latitude',
    'longitude',
    'fullAddress'
  ]);
  const updateData = Object.fromEntries(
    Object.entries(rawUpdateData).filter(([key]) => allowedProfileFields.has(key))
  );

  const phoneRegex = /^(\+?254|0)?[17]\d{8}$/;

  if (updateData.whatsappNumber && !phoneRegex.test(updateData.whatsappNumber)) {
    if (updateData.whatsappNumber.trim() !== '') {
      throw new AppError('Invalid WhatsApp number format. Use 07... or 01...', 400);
    }
  }

  if (updateData.mobilePayment && !phoneRegex.test(updateData.mobilePayment)) {
    if (updateData.mobilePayment.trim() !== '') {
      throw new AppError('Invalid Mobile Payment number format. Use 07... or 01...', 400);
    }
  }

  if (password) {
    if (password !== passwordConfirm) {
      throw new AppError('Passwords do not match', 400);
    }
    await User.updatePassword(userId, password);
  }

  if (Object.keys(updateData).length === 0 && !password) {
    const currentUser = await Buyer.findById(buyerId);
    return {
      message: 'No profile updates provided',
      buyer: currentUser
    };
  }

  let updatedBuyer = null;
  if (Object.keys(updateData).length > 0) {
    updatedBuyer = await Buyer.update(buyerId, updateData);
  } else {
    updatedBuyer = await Buyer.findById(buyerId);
  }

  if (!updatedBuyer) {
    logger.error('Failed to update buyer profile');
    throw new AppError('Error updating profile', 500);
  }

  return {
    message: 'Profile updated successfully',
    buyer: updatedBuyer
  };
};

export const registerBuyerHandler = async ({ body, res, next }) => {
  const { password, confirmPassword, city, location, email } = body;

  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match', 400);
  }

  if (!city || !location) {
    throw new AppError('City and location are required', 400);
  }

  try {
    const result = await AuthService.register(body, 'buyer');

    if (result.status === 'pending_verification') {
      return {
        isPending: true,
        response: {
          status: 'success',
          message: 'Account pending verification! Please check your email to complete your registration.',
          data: {
            email: result.email,
            emailVerificationRequired: true,
            emailVerificationSent: true
          }
        }
      };
    }

    const loginData = await AuthService.login(email, password, 'buyer');
    return {
      isPending: false,
      loginData
    };
  } catch (err) {
    if (err.code === '23505') throw new AppError('Email already in use', 400);
    if (err.message && (
      err.message.includes('A buyer account with this email already exists') ||
      err.message.includes('An account with this email already exists')
    )) {
      throw new AppError(err.message, 409);
    }
    throw err;
  }
};

export const handleLoginError = (error, res, next) => {
  if (error.isRoleMismatch) {
    return res.status(401).json({
      status: 'error',
      message: error.message,
      code: 'WRONG_PORTAL'
    });
  }
  const authCodes = ['EMAIL_NOT_VERIFIED', 'PENDING_VERIFICATION', 'TERMS_NOT_ACCEPTED'];
  if (authCodes.includes(error.code)) {
    return res.status(403).json({
      status: 'error',
      message: error.message,
      code: error.code,
      email: error.email,
      userType: error.userType
    });
  }
  return next(error);
};

export const verifyEmailHelper = async ({ token, email, res }) => {
  if (!token || !email) {
    throw new AppError('Token and email are required', 400);
  }

  const result = await AuthService.verifyEmail(email, token);
  let sessionToken = null;
  if (result.user?.id && result.user.role === 'buyer') {
    sessionToken = signToken(result.user.id, 'buyer');
    setAuthCookie(res, sessionToken);
  }

  const message = sessionToken
    ? 'Email verified — you are now signed in.'
    : (result.alreadyVerified
      ? 'Your email is already verified. You can log in.'
      : 'Email verified successfully! You can now log in.');

  return {
    message,
    data: {
      alreadyVerified: result.alreadyVerified,
      email: result.user.email,
      ...(sessionToken ? { token: sessionToken, autoLoggedIn: true } : {})
    }
  };
};

export const resolveBuyerProfile = async (user) => {
  const buyerLookupId = user.buyerId;
  let buyer = buyerLookupId ? await Buyer.findById(buyerLookupId) : null;

  const userId = user.userId || user.id;
  if (!buyer && userId) {
    buyer = await Buyer.findByUserId(userId);
  }

  if (!buyer && userId) {
    buyer = await autoProvisionBuyerProfile(userId);
  }

  return buyer;
};

export default {
  createSendToken,
  autoProvisionBuyerProfile,
  updateBuyerProfileHelper,
  registerBuyerHandler,
  handleLoginError,
  verifyEmailHelper,
  resolveBuyerProfile
};
