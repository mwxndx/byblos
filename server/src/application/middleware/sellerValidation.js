import { z } from 'zod';
import { validate as validateMiddleware } from './validate.js';
import { normalizeShopName } from '../../domains/commerce/sellers/seller.model.js';

/**
 * Validation schemas for Seller Authentication
 */

export const sellerRegistrationSchema = z.object({
    fullName: z.string().min(1, 'Full name is required').trim(),

    shopName: z.string()
        .min(1, 'Shop name is required')
        .regex(/^[a-zA-Z0-9._\s-]+$/, 'Shop name can only contain letters, numbers, spaces, dots, dashes, and underscores')
        .transform(val => normalizeShopName(val))
        .refine(val => val.length >= 3, 'Shop name must be at least 3 characters')
        .refine(val => val.length <= 30, 'Shop name must be at most 30 characters'),

    email: z.string().email('Please provide a valid email address').trim().toLowerCase(),

    password: z.string()
        .min(8, 'Password must be at least 8 characters long')
        .regex(/\d/, 'Password must contain at least one number')
        .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
        .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),

    confirmPassword: z.string().min(1, 'Please confirm your password'),

    // WhatsApp is an optional alternative contact only (not a notification channel).
    whatsappNumber: z.string().trim().optional(),

    city: z.string().min(1, 'City is required').trim(),

    location: z.string().min(1, 'Location is required').trim(),
    physicalAddress: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    businessPhoto: z.string().optional(),
    avatarUrl: z.string().optional(),
    referralCode: z.string().regex(/^BY[A-Z0-9]{6}$/i, 'Invalid referral code').optional(),
    referral_code: z.string().regex(/^BY[A-Z0-9]{6}$/i, 'Invalid referral code').optional(),
    termsAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms and conditions' }) }).optional()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export const sellerLoginSchema = z.object({
    email: z.string().email('Please provide a valid email address').trim().toLowerCase(),

    password: z.string().min(1, 'Password is required'),

    // Optional: set when the login form retries after the user accepts the
    // Terms modal shown for a TERMS_NOT_ACCEPTED response. z.object() silently
    // strips any key not declared here (validate.js replaces req.body with
    // the parsed result), so omitting this field makes the accept-terms
    // retry a permanent dead end regardless of the controller/service layer.
    acceptTerms: z.boolean().optional(),
});

export const validateSellerRegistration = validateMiddleware(sellerRegistrationSchema);
export const validateSellerLogin = validateMiddleware(sellerLoginSchema);
