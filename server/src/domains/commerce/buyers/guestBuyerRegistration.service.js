/**
 * guestBuyerRegistration.service.js
 *
 * Dedicated service to coordinate guest buyer registration workflows.
 * Extracts the multi-branch logic from buyer.controller.js saveBuyerInfo.
 */
import BuyerService from './buyer.service.js';
import AuthService from '../../identity/auth/auth.service.js';
import User from '../../identity/users/user.model.js';
import { setAuthCookie } from '../../../shared/utils/cookie.utils.js';
import { sanitizeBuyer } from '../../../shared/utils/sanitize.js';

export const normalizePhoneNumber = (phone) => {
  if (!phone) return null;

  let normalized = phone.replace(/[\s\-\(\)]/g, '');

  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }

  if (normalized.startsWith('254')) {
    normalized = '0' + normalized.substring(3);
  }

  return normalized;
};

export async function processGuestBuyerRegistration({
  fullName,
  email,
  phone,
  mobilePayment,
  whatsappNumber,
  city,
  location,
  password,
  termsAccepted,
  res
}) {
  const effectivePhone = phone || mobilePayment || whatsappNumber;

  let result;
  try {
    result = await BuyerService.registerGuest({
      fullName,
      email,
      phone: normalizePhoneNumber(effectivePhone),
      mobilePayment: mobilePayment || effectivePhone,
      whatsappNumber: whatsappNumber || effectivePhone,
      city,
      location: location || city || 'Not specified',
      password,
      termsAccepted: termsAccepted === true
    });

    if (result.status === 'identity_required') {
      result = await AuthService.registerGuestBuyer(result.registrationData);
    }
  } catch (err) {
    if (err.requiresLogin) {
      return {
        statusCode: 200,
        response: {
          status: 'success',
          data: { requiresLogin: true, exists: true, buyer: { email } }
        }
      };
    }
    throw err;
  }

  if (result.status === 'pending_verification') {
    return {
      statusCode: 200,
      response: {
        status: 'success',
        data: {
          emailVerificationRequired: true,
          email: result.email,
          message: 'Please verify your email address to complete your account setup. You can still proceed with your purchase now.'
        }
      }
    };
  }

  const buyerProfile = result.buyer || result.user;
  if (!buyerProfile) {
    throw new Error('Failed to create or retrieve buyer profile');
  }

  const userId = buyerProfile.user_id || buyerProfile.userId;
  const user = await User.findById(userId);

  if (user && !user.is_verified) {
    return {
      statusCode: 200,
      response: {
        status: 'success',
        data: {
          emailVerificationRequired: true,
          email: user.email,
          message: 'Your account is pending verification. Please check your email to complete your account setup.'
        }
      }
    };
  }

  const token = BuyerService.signToken(buyerProfile);
  setAuthCookie(res, token);

  return {
    statusCode: 200,
    response: {
      status: 'success',
      data: { buyer: sanitizeBuyer(buyerProfile) }
    }
  };
}

export default {
  normalizePhoneNumber,
  processGuestBuyerRegistration
};
