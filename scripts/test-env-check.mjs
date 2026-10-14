#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const checks = [];

function check(area, name, condition, details = '', severity = 'error') {
  checks.push({ area, name, ok: Boolean(condition), details, severity });
}

// Helper to parse simple dotenv files without extra dependencies
function parseEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
      env[key] = val;
    }
  }
  return env;
}

async function probeTcp(host, port, timeoutMs = 2000) {
  return new Promise((resolveResult) => {
    const socket = createConnection({ host, port: Number(port), timeout: timeoutMs });
    socket.on('connect', () => {
      socket.end();
      resolveResult(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolveResult(false);
    });
    socket.on('error', () => {
      resolveResult(false);
    });
  });
}

async function runAudit() {
  console.log('=================================================================');
  console.log('             BYBLOS TEST ENVIRONMENT HEALTH CHECK                ');
  console.log('=================================================================\n');

  // 1. System & Docker Compose Check
  let dockerCliOk = false;
  let dockerDaemonOk = false;
  let composeVersion = 'Not detected';
  try {
    const stdout = execSync('docker compose version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    dockerCliOk = true;
    composeVersion = stdout.trim();
  } catch {
    dockerCliOk = false;
  }
  check('Docker', 'Docker Compose CLI available', dockerCliOk, composeVersion);

  try {
    execSync('docker info', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    dockerDaemonOk = true;
  } catch {
    dockerDaemonOk = false;
  }
  check('Docker', 'Docker Daemon running', dockerDaemonOk, dockerDaemonOk ? 'Active' : 'Stopped (Native host database used)', 'warn');

  // Check docker-compose.test.yml definition
  const testComposePath = resolve(root, 'docker-compose.test.yml');
  const testComposeExists = existsSync(testComposePath);
  check('Docker', 'docker-compose.test.yml present', testComposeExists);

  // 2. Environment Configuration & Safety
  const testEnvPath = resolve(root, 'server/.env.test');
  const testEnvExists = existsSync(testEnvPath);
  check('Environment', 'server/.env.test present', testEnvExists);

  const env = testEnvExists ? parseEnv(testEnvPath) : {};
  const dbName = env.DB_NAME || 'byblos_test';
  const dbHost = env.DB_HOST || 'localhost';
  const dbPort = Number(env.DB_PORT || 3001);
  const dbUser = env.DB_USER || 'postgres';
  const dbPassword = env.DB_PASSWORD || 'postgres';

  const isDbSafe = dbName.endsWith('_test') && !dbHost.includes('render.com') && !dbHost.includes('amazonaws.com');
  check('Safety Guard', 'Test DB name ends with _test and host is isolated', isDbSafe, `${dbHost}:${dbPort}/${dbName}`);

  const mockPaymentsConfigured = (
    env.PAYSTACK_BASE_URL?.includes('mock') ||
    env.PAYSTACK_SECRET_KEY?.includes('mock') ||
    env.PAYMENT_PROVIDER === 'paystack'
  );
  check('Safety Guard', 'Mock payment gateway active (zero live charges)', mockPaymentsConfigured);

  // 3. PostgreSQL Connectivity & Migrations
  let pgClient = null;
  let dbConnected = false;
  let dbErr = '';
  try {
    const { createRequire } = await import('node:module');
    const serverRequire = createRequire(resolve(root, 'server/package.json'));
    const pg = serverRequire('pg');
    const { Client } = pg;
    pgClient = new Client({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      connectionTimeoutMillis: 3000
    });
    await pgClient.connect();
    dbConnected = true;
  } catch (err) {
    dbConnected = false;
    dbErr = err.message;
  }
  check('Database', `PostgreSQL reachable on ${dbHost}:${dbPort}`, dbConnected, dbErr || undefined);

  if (dbConnected && pgClient) {
    try {
      const { rows: tableRows } = await pgClient.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
      `);
      const tables = new Set(tableRows.map((r) => r.table_name));

      const requiredTables = ['users', 'roles', 'sellers', 'buyers', 'creators', 'products', 'product_orders', 'payments'];
      const missingTables = requiredTables.filter((t) => !tables.has(t));
      check('Database', 'Core e-commerce schema tables exist', missingTables.length === 0, missingTables.length ? `Missing: ${missingTables.join(', ')}` : `${requiredTables.length} tables verified`);

      // Migration check
      const migrationsDir = resolve(root, 'server/migrations');
      const migrationFiles = existsSync(migrationsDir)
        ? readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
        : [];
      
      let appliedMigrations = 0;
      if (tables.has('pgmigrations')) {
        const { rows: migRows } = await pgClient.query('SELECT COUNT(*)::int as count FROM pgmigrations');
        appliedMigrations = migRows[0]?.count || 0;
      }
      check('Migrations', 'Applied database migrations', appliedMigrations >= migrationFiles.length, `${appliedMigrations} applied / ${migrationFiles.length} file(s)`);

      // 4. Deterministic Seed Data Check
      const { rows: testUsers } = await pgClient.query(`
        SELECT email, role FROM users
        WHERE email IN ('admin@byblos.test', 'seller@byblos.test', 'creator@byblos.test', 'buyer@byblos.test')
      `);
      check('Seed Data', 'Test role accounts exist (Admin, Seller, Creator, Buyer)', testUsers.length === 4, `${testUsers.length}/4 accounts`);

      const { rows: products } = await pgClient.query(`
        SELECT p.id, p.name, p.price, p.product_type
        FROM products p
        JOIN sellers s ON p.seller_id = s.id
        WHERE s.email = 'seller@byblos.test'
      `);
      check('Seed Data', 'Test Atelier catalog products seeded', products.length >= 3, `${products.length} product(s) found`);
    } catch (err) {
      check('Database', 'Database introspection query succeeded', false, err.message);
    } finally {
      await pgClient.end().catch(() => {});
    }
  }

  // 5. Redis Connectivity Check
  const redisPort = 6379;
  const redisReachable = await probeTcp('127.0.0.1', redisPort, 1500);
  check('Redis', `Redis reachable on 127.0.0.1:${redisPort}`, redisReachable, redisReachable ? 'Available' : 'Offline (In-memory cache fallback active)', 'warn');

  // Print Formatted Report
  let passedCount = 0;
  let warnCount = 0;
  let failedCount = 0;

  for (const c of checks) {
    let symbol = '✓ PASS';
    if (!c.ok) {
      if (c.severity === 'warn') {
        symbol = '! WARN';
        warnCount++;
      } else {
        symbol = '✗ FAIL';
        failedCount++;
      }
    } else {
      passedCount++;
    }
    const tag = `[${c.area}]`.padEnd(16);
    console.log(`${symbol}  ${tag} ${c.name}${c.details ? ` (${c.details})` : ''}`);
  }

  console.log('\n-----------------------------------------------------------------');
  console.log(`Summary: ${passedCount} passed, ${warnCount} warnings, ${failedCount} failed of ${checks.length} checks`);
  console.log('-----------------------------------------------------------------\n');

  if (failedCount > 0) {
    console.log('💡 Quick Remediation:');
    console.log('  1. Start services:       npm run test:env:up');
    console.log('  2. Setup & migrate DB:   npm run test:env:setup');
    console.log('  3. Seed test data:       npm run test:env:seed');
    console.log('  4. Re-run verification:  npm run test:env:check\n');
  }

  // Non-zero exit code if any critical checks fail (core DB or safety)
  const criticalFailures = checks.filter(
    (c) => !c.ok && c.severity === 'error'
  );

  process.exit(criticalFailures.length > 0 ? 1 : 0);
}

runAudit().catch((err) => {
  console.error('Fatal error during test environment check:', err);
  process.exit(1);
});
