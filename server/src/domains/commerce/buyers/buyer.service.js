import logger from '../../../shared/utils/logger.js';
import Buyer from './buyer.model.js';
import { signToken } from '../../../shared/utils/jwt.js';
import User from '../../identity/users/user.model.js';
import { pool } from '../../../infrastructure/database/database.js';
import ProfileProvisioningService from '../../identity/users/profileProvisioning.service.js';
import CacheService from '../../../shared/utils/cache.service.js';
import Order from '../../orders/order/order.model.js';

class BuyerService {
    static async register(data) {
        return ProfileProvisioningService.createBuyerProfileForExistingUser(data);
    }

    static async registerGuest(data) {
        const {
            fullName,
            email,
            phone,
            mobilePayment,
            whatsappNumber,
            mobile_payment: mp,
            whatsapp_number: wn,
            city,
            location,
            password
        } = data;
        const mobile_payment = mobilePayment || mp || phone;
        const whatsapp_number = whatsappNumber || wn || phone;
        const normalizedEmail = (email || '').trim().toLowerCase();

        const existingUser = await User.findByEmail(normalizedEmail);
        if (!existingUser) {
            return {
                status: 'identity_required',
                registrationData: {
                    fullName,
                    email: normalizedEmail,
                    phone,
                    mobilePayment: mobile_payment,
                    whatsappNumber: whatsapp_number,
                    city,
                    location: location || city || 'Not specified',
                    password,
                    termsAccepted: data.termsAccepted !== undefined ? data.termsAccepted : true
                }
            };
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const existingUserResult = await client.query(
                `SELECT id, email, password_hash, role, is_active, created_at
                 FROM users 
                 WHERE LOWER(email) = $1 
                 FOR UPDATE`,
                [normalizedEmail]
            );
            const lockedUser = existingUserResult.rows[0];

            if (!lockedUser) {
                await client.query('COMMIT');
                return {
                    status: 'identity_required',
                    registrationData: {
                        fullName,
                        email: normalizedEmail,
                        phone,
                        mobilePayment: mobile_payment,
                        whatsappNumber: whatsapp_number,
                        city,
                        location: location || city || 'Not specified',
                        password,
                        termsAccepted: data.termsAccepted !== undefined ? data.termsAccepted : true
                    }
                };
            }

            if (!password) {
                const error = new Error('An account with this email already exists. Please login to proceed.');
                error.requiresLogin = true;
                throw error;
            }

            const isPasswordCorrect = await User.verifyPassword(password, lockedUser.password_hash);
            if (!isPasswordCorrect) {
                const error = new Error('An account with this email already exists. Please login or use the correct password.');
                error.requiresLogin = true;
                throw error;
            }

            const buyerResult = await client.query(
                'SELECT *, user_id AS "userId" FROM buyers WHERE user_id = $1 FOR UPDATE',
                [lockedUser.id]
            );
            let buyer = buyerResult.rows[0] ? Buyer.createInstance(buyerResult.rows[0]) : null;
            if (!buyer) {
                buyer = await Buyer.create({
                    fullName,
                    email: normalizedEmail,
                    mobilePayment: mobile_payment,
                    whatsappNumber: whatsapp_number,
                    city,
                    location,
                    userId: lockedUser.id,
                    termsAccepted: data.termsAccepted
                }, client);
            }

            const roleResult = await client.query('SELECT id FROM roles WHERE slug = $1', ['buyer']);
            if (roleResult.rows[0]) {
                await client.query(
                    'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [lockedUser.id, roleResult.rows[0].id]
                );
            }

            await client.query('COMMIT');

            try {
                await CacheService.delete(`user:${lockedUser.id}:cross-roles`);
            } catch (cacheErr) {
                logger.warn('[REGISTER] Failed to invalidate cross-role cache:', cacheErr.message);
            }

            return { buyer };
        } catch (error) {
            await client.query('ROLLBACK').catch(rollbackError =>
                logger.error('[BUYER_REGISTER] Rollback failed:', rollbackError)
            );
            throw error;
        } finally {
            client.release();
        }
    }

    static async login(email, password) {
        const userFound = await User.findByEmail(email);
        if (!userFound) return null;

        const isValid = await User.verifyPassword(password, userFound.password_hash);
        if (!isValid) return null;

        return Buyer.findByUserId(userFound.id);
    }

    /**
     * Claim a guest order post-payment:
     * - If email belongs to an existing user, verify password then link order + provision buyer profile.
     * - If email is new, create user + buyer profile then link order.
     * Returns { token, buyer } on success, or throws AppError on invalid credentials.
     */
    static async claimGuestOrder({ email, password, checkoutToken }) {
        const normalizedEmail = (email || '').trim().toLowerCase();
        const existingUser = await User.findByEmail(normalizedEmail);

        if (existingUser) {
            // Existing account -- verify password before linking
            const passwordValid = await User.verifyPassword(password, existingUser.password_hash);
            if (!passwordValid) {
                const err = new Error('Incorrect password. Please try again, or use the email link to claim this order.');
                err.statusCode = 401;
                throw err;
            }

            let buyer = await Buyer.findByUserId(existingUser.id);
            if (!buyer) {
                const nameRes = await pool.query(
                    `SELECT full_name, whatsapp_number AS phone FROM sellers WHERE user_id = $1
                     UNION ALL
                     SELECT CONCAT(first_name, ' ', last_name) AS full_name, COALESCE(whatsapp_number, mpesa_number) AS phone FROM creators WHERE user_id = $1
                     LIMIT 1`,
                    [existingUser.id]
                );
                const existingName = nameRes.rows[0]?.full_name || normalizedEmail.split('@')[0];
                const existingPhone = nameRes.rows[0]?.phone || '';

                buyer = await Buyer.create({
                    fullName: existingName,
                    email: normalizedEmail,
                    mobilePayment: existingPhone,
                    whatsappNumber: existingPhone || null,
                    city: 'Nairobi',
                    location: 'Nairobi',
                    userId: existingUser.id,
                    termsAccepted: true
                });

                await pool.query(
                    `INSERT INTO user_roles (user_id, role_id)
                     SELECT $1, id FROM roles WHERE slug = 'buyer'
                     ON CONFLICT DO NOTHING`,
                    [existingUser.id]
                );
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await Order.linkGuestOrderToBuyer(client, buyer.id, checkoutToken);
                await client.query('COMMIT');
                const token = signToken(existingUser.id, 'buyer');
                return { token, buyer };
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } else {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const newUser = await User.create({
                    email: normalizedEmail,
                    password,
                    role: 'buyer',
                    is_verified: true
                }, client);

                const buyer = await Buyer.create({
                    fullName: normalizedEmail.split('@')[0],
                    email: normalizedEmail,
                    mobilePayment: '',
                    whatsappNumber: null,
                    city: 'Nairobi',
                    location: 'Nairobi',
                    userId: newUser.id,
                    termsAccepted: true
                }, client);

                await Order.linkGuestOrderToBuyer(client, buyer.id, checkoutToken);
                await client.query('COMMIT');

                const token = signToken(newUser.id, 'buyer');
                return { token, buyer };
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        }
    }

    static signToken(buyer) {
        const userId = buyer.user_id || buyer.userId;

        if (!userId) {
            throw new Error('Cannot generate token: buyer.user_id is missing. Ensure buyer data includes user_id from the users table.');
        }

        return signToken(userId, 'buyer');
    }
}

export default BuyerService;
