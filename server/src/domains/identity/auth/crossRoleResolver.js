import { AppError } from '../../../shared/utils/errorHandler.js';

export const resolveUserTermsAccepted = async ({ user, pool, Buyer, SellerModel, acceptTerms }) => {
    let termsAccepted = true;
    if (user.role === 'seller') {
        const profile = await SellerModel.findSellerByUserId(user.id);
        termsAccepted = profile ? profile.termsAccepted : true;
    } else if (user.role === 'buyer') {
        const profile = await Buyer.findByUserId(user.id);
        termsAccepted = profile ? profile.termsAccepted : true;
    } else if (user.role === 'creator') {
        const { rows } = await pool.query('SELECT terms_accepted FROM creators WHERE user_id = $1', [user.id]);
        termsAccepted = rows[0] ? rows[0].terms_accepted : true;
    }

    if (termsAccepted === false) {
        if (acceptTerms === true) {
            const termsTable = { seller: 'sellers', buyer: 'buyers', creator: 'creators' }[user.role];
            if (termsTable) {
                await pool.query(
                    `UPDATE ${termsTable} SET terms_accepted = TRUE, terms_accepted_at = NOW() WHERE user_id = $1`,
                    [user.id]
                );
            }
        } else {
            const err = new AppError('Please accept the terms and conditions to continue.', 403, 'TERMS_NOT_ACCEPTED');
            err.email = user.email;
            err.userType = user.role;
            throw err;
        }
    }
};

export const resolveCrossRoleAccess = async ({ user, type, signToken, pool, Buyer, SellerModel }) => {
    // CASE 1: Accessing BUYER portal
    if (type === 'buyer') {
        let buyerProfile = await Buyer.findByUserId(user.id);
        if (!buyerProfile) {
            buyerProfile = await Buyer.findByEmail(user.email);
            if (buyerProfile && !buyerProfile.userId) {
                await pool.query(
                    'UPDATE buyers SET user_id = $1 WHERE id = $2 AND user_id IS NULL',
                    [user.id, buyerProfile.id]
                );
                buyerProfile.userId = user.id;
                buyerProfile.user_id = user.id;
            }
        }

        // Auto-provision a buyer profile if seller or creator is accessing buyer portal
        if (!buyerProfile && (user.role === 'seller' || user.role === 'creator')) {
            const fallbackName = user.email ? user.email.split('@')[0] : 'Buyer';
            let phone = null;
            let fullName = fallbackName;
            let city = 'Nairobi';
            let location = 'Nairobi';

            if (user.role === 'seller') {
                const seller = await SellerModel.findSellerByUserId(user.id);
                if (seller) {
                    fullName = seller.fullName || seller.full_name || seller.shopName || fallbackName;
                    phone = seller.whatsappNumber || seller.whatsapp_number;
                    city = seller.city || city;
                    location = seller.location || location;
                }
            } else if (user.role === 'creator') {
                const { rows } = await pool.query('SELECT first_name, last_name, mpesa_number, whatsapp_number FROM creators WHERE user_id = $1', [user.id]);
                if (rows[0]) {
                    fullName = `${rows[0].first_name || ''} ${rows[0].last_name || ''}`.trim() || fallbackName;
                    phone = rows[0].mpesa_number || rows[0].whatsapp_number;
                }
            }

            buyerProfile = await Buyer.create({
                fullName,
                email: user.email,
                mobilePayment: phone,
                whatsappNumber: phone,
                city,
                location,
                userId: user.id,
                termsAccepted: true
            });

            // Ensure buyer role in user_roles
            const roleRes = await pool.query("SELECT id FROM roles WHERE slug = 'buyer'");
            if (roleRes.rows[0]) {
                await pool.query(
                    'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [user.id, roleRes.rows[0].id]
                );
            }
        }

        if (buyerProfile && (buyerProfile.userId === user.id || buyerProfile.user_id === user.id)) {
            const token = signToken(user.id, 'buyer');
            return { user, profile: buyerProfile, token, crossRole: true };
        }
    }

    // CASE 2: Accessing SELLER portal
    if (type === 'seller') {
        let sellerProfile = await SellerModel.findSellerByUserId(user.id);
        if (!sellerProfile) {
            sellerProfile = await SellerModel.findSellerByEmail(user.email);
            if (sellerProfile && !sellerProfile.userId) {
                await pool.query(
                    'UPDATE sellers SET user_id = $1 WHERE id = $2 AND user_id IS NULL',
                    [user.id, sellerProfile.id]
                );
                sellerProfile.userId = user.id;
                sellerProfile.user_id = user.id;
            }
        }

        if (sellerProfile && (sellerProfile.userId === user.id || sellerProfile.user_id === user.id)) {
            const token = signToken(user.id, 'seller');
            return { user, profile: sellerProfile, token, crossRole: true };
        }
    }

    // CASE 3: Accessing CREATOR portal
    if (type === 'creator') {
        const creatorResult = await pool.query(
            `SELECT id, user_id, first_name, last_name, email, mpesa_number,
                    whatsapp_number, instagram_link, tiktok_link, balance,
                    total_sales, total_earnings, referral_code, status,
                    terms_accepted, terms_accepted_at, created_at, updated_at
             FROM creators 
             WHERE user_id = $1 AND status = 'active' 
             LIMIT 1`,
            [user.id]
        );
        let creatorProfile = creatorResult.rows[0] || null;

        if (!creatorProfile) {
            const roleRes = await pool.query(
                `SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1 AND r.slug = 'creator'`,
                [user.id]
            );
            if (roleRes.rows.length > 0) {
                const firstName = user.email ? user.email.split('@')[0] : 'Creator';
                const newCreatorRes = await pool.query(
                    `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number, whatsapp_number, status)
                     VALUES ($1, $2, 'Creator', $3, '0700000000', '0700000000', 'active')
                     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
                     RETURNING *`,
                    [user.id, firstName, user.email]
                );
                creatorProfile = newCreatorRes.rows[0];
            }
        }

        if (creatorProfile) {
            const token = signToken(user.id, 'creator');
            return { user, profile: creatorProfile, token, crossRole: true };
        }
    }

    // CASE 4: Marketing / Admin cross-role access
    if ((type === 'admin' && user.role === 'marketing') || (type === 'marketing' && user.role === 'admin')) {
        const issuedRole = type;
        const token = signToken(user.id, issuedRole);
        return {
            user,
            profile: { id: user.id, email: user.email, role: issuedRole },
            token,
            crossRole: true
        };
    }

    // No cross-role profile found
    const err = new AppError(`Wrong portal. This account is registered as a ${user.role}.`, 401, 'WRONG_PORTAL');
    err.isRoleMismatch = true;
    err.userType = user.role;
    throw err;
};
