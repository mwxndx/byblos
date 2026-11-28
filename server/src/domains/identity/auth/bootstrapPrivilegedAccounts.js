import bcrypt from 'bcrypt';
import logger from '../../../shared/utils/logger.js';
import { pool } from '../../../infrastructure/database/database.js';
import { timingSafeEqualString } from '../../../shared/utils/crypto.utils.js';
import { AppError } from '../../../shared/utils/errorHandler.js';

export const timingSafeStrEqual = timingSafeEqualString;

export const bootstrapPrivilegedAccountIfConfigured = async (normalizedEmail, password) => {
    const candidates = [
        { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, label: 'admin' },
        { email: process.env.MARKETING_EMAIL, password: process.env.MARKETING_PASSWORD, label: 'marketing' },
    ];

    const match = candidates.find((c) =>
        c.email && c.password &&
        c.email.toLowerCase().trim() === normalizedEmail &&
        timingSafeEqualString(c.password, password)
    );
    if (!match) return null;

    const assignedRole = match.label === 'marketing' ? 'marketing' : 'admin';

    const { rows: existingByEmail } = await pool.query(
        'SELECT id, role FROM users WHERE LOWER(email) = $1',
        [normalizedEmail]
    );
    if (existingByEmail[0] && existingByEmail[0].role !== assignedRole) {
        throw new AppError(`Configured ${match.label} email is already used by another account`, 409);
    }

    if (assignedRole === 'marketing') {
        const { rows: existingMarketing } = await pool.query(
            "SELECT id, email FROM users WHERE role = 'marketing'"
        );
        if (existingMarketing[0] && existingMarketing[0].email.toLowerCase().trim() !== normalizedEmail) {
            throw new AppError('A marketing account already exists', 409);
        }
        await pool.query(
            "INSERT INTO roles (name, slug) VALUES ('Marketing', 'marketing') ON CONFLICT (slug) DO NOTHING"
        );
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = existingByEmail[0]
        ? await pool.query(
            `UPDATE users
             SET password_hash = $2, is_verified = true, is_active = true, updated_at = NOW()
             WHERE id = $1
             RETURNING id, email, password_hash, role, is_verified, is_active`,
            [existingByEmail[0].id, hash]
        )
        : await pool.query(
            `INSERT INTO users (email, password_hash, role, is_verified, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, true, true, NOW(), NOW())
             RETURNING id, email, password_hash, role, is_verified, is_active`,
            [normalizedEmail, hash, assignedRole]
        );

    logger.info(`[AUTH] Bootstrapped ${match.label} account from env-configured credentials: ${normalizedEmail}`);
    return rows[0];
};
