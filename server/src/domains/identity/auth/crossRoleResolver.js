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
            `SELECT * FROM creators WHERE user_id = $1 AND status = 'active' LIMIT 1`,
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
    throw err;
};
