
import { pool } from '../src/infrastructure/database/database.js';

async function syncRoles() {
    console.log('🔄 Starting User Roles Sync...');

    try {
        // 1. Get all roles
        const rolesResult = await pool.query('SELECT id, slug FROM roles');
        const roles = rolesResult.rows.reduce((acc, row) => {
            acc[row.slug] = row.id;
            return acc;
        }, {});

        console.log('Fetched roles:', roles);

        // 2. Sync Sellers
        const sellersResult = await pool.query('SELECT user_id FROM sellers WHERE user_id IS NOT NULL');
        console.log(`Linking ${sellersResult.rows.length} sellers...`);
        await Promise.all(sellersResult.rows.map(row =>
            pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.user_id, roles['seller']])
        ));

        // 3. Sync Buyers
        const buyersResult = await pool.query('SELECT user_id FROM buyers WHERE user_id IS NOT NULL');
        console.log(`Linking ${buyersResult.rows.length} buyers...`);
        await Promise.all(buyersResult.rows.map(row =>
            pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.user_id, roles['buyer']])
        ));

        // 4. Sync Organizers
        const organizersResult = await pool.query('SELECT user_id FROM organizers WHERE user_id IS NOT NULL');
        console.log(`Linking ${organizersResult.rows.length} organizers...`);
        await Promise.all(organizersResult.rows.map(row =>
            pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.user_id, roles['organizer']])
        ));

        console.log('✅ Sync Completed Successfully');
    } catch (error) {
        console.error('❌ Sync Failed:', error);
    } finally {
        await pool.end();
    }
}

try {
    await syncRoles();
} catch (err) {
    console.error('Unhandled error in syncRoles:', err);
    process.exit(1);
}
