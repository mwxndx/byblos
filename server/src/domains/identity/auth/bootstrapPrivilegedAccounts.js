import bcrypt from 'bcrypt';
import logger from '../../../shared/utils/logger.js';
import { pool } from '../../../infrastructure/database/database.js';
import { timingSafeEqualString } from '../../../shared/utils/crypto.utils.js';

export const timingSafeStrEqual = timingSafeEqualString;

export const bootstrapPrivilegedAccountIfConfigured = async (normalizedEmail, password) => {
    const candidates = [
        { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, label: 'admin' },
        { email: process.env.MARKETING_EMAIL, password: process.env.MARKETING_PASSWORD, label: 'marketing' },
    ];

    const match = candidates.find((c) =>
        c.email && c.password &&
        c.email.toLowerCase().trim() === normalizedEmail &&
        timingSafeStrEqual(c.password, password)
    );
    if (!match) return null;

    const hash = await bcrypt.hash(password, 12);
    const assignedRole = match.label === 'marketing' ? 'marketing' : 'admin';

    if (assignedRole === 'marketing') {
        await pool.query(
            "INSERT INTO roles (name, slug) VALUES ('Marketing', 'marketing') ON CONFLICT (slug) DO NOTHING"
        );
    }

    const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash, role, is_verified, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, true, NOW(), NOW())
         ON CONFLICT (email)
         DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_verified = true, is_active = true, updated_at = NOW()
         RETURNING id, email, password_hash, role, is_verified, is_active`,
        [normalizedEmail, hash, assignedRole]
    );

    logger.info(`[AUTH] Bootstrapped ${match.label} account from env-configured credentials: ${normalizedEmail}`);
    return rows[0];
};
