import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../../shared/utils/logger.js';

dotenv.config();

const { Pool } = pg;
/** @type {import('pg').Pool} */
let pool;

// Required environment variables for database:
// Either individual DB_* variables or a valid DATABASE_URL must be provided.
const hasIndividualVars = !!(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD);
const hasDatabaseUrl = !!process.env.DATABASE_URL;

if (!hasIndividualVars && !hasDatabaseUrl) {
  const errorMsg = '❌ FATAL: Missing database configuration. Provide either individual DB_* variables (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD) or DATABASE_URL.';
  logger.error(errorMsg);
  throw new Error(errorMsg);
}

const configuredPoolMax = Number.parseInt(process.env.DB_POOL_MAX, 10);
const defaultPoolMax = process.env.NODE_ENV === 'production' ? 25 : 10;

const dbConfig = {
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: Number.isFinite(configuredPoolMax) && configuredPoolMax > 0 ? configuredPoolMax : defaultPoolMax,
  query_timeout: 30000,
  allowExitOnIdle: false,
};

if (hasIndividualVars) {
  dbConfig.host = process.env.DB_HOST;
  dbConfig.port = Number.parseInt(process.env.DB_PORT, 10) || 5432;
  dbConfig.database = process.env.DB_NAME;
  dbConfig.user = process.env.DB_USER;
  dbConfig.password = process.env.DB_PASSWORD;
} else {
  dbConfig.connectionString = process.env.DATABASE_URL;
}

// SSL is required in production and for Render/Heroku/AWS Postgres.
// Supports DB_SSL_REJECT_UNAUTHORIZED and DB_SSL_CA overrides for certificate trust verification.
dbConfig.ssl = process.env.DB_SSL === 'false' ? false : (process.env.NODE_ENV === 'production' ? {
  rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
  ca: process.env.DB_SSL_CA ? process.env.DB_SSL_CA.replace(/\\n/g, '\n') : undefined,
} : false);

// Fail-fast safety guard when running in test mode
if (process.env.NODE_ENV === 'test') {
  const dbName = String(process.env.DB_NAME || '');
  const dbHost = String(process.env.DB_HOST || '');
  const dbUrl = String(process.env.DATABASE_URL || '');

  const isProdHost = dbHost.includes('amazonaws.com') || dbUrl.includes('amazonaws.com');
  const isSafeTestDb = dbName.endsWith('_test') || dbName.includes('test') || dbUrl.includes('_test');

  if (isProdHost) {
    const errMsg = `FATAL SAFETY GUARD: Production DB host detected ("${dbHost || dbUrl}"). Refusing to connect in test mode!`;
    logger.error(errMsg);
    throw new Error(errMsg);
  }

  if (!isSafeTestDb) {
    const errMsg = `FATAL SAFETY GUARD: DB_NAME "${dbName}" is NOT a test database (must contain "test"). Refusing to connect.`;
    logger.error(errMsg);
    throw new Error(errMsg);
  }
}

// Log connection attempt details (masking password)
const logTarget = hasIndividualVars
  ? `${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  : (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@') : 'DATABASE_URL');
logger.info(`Initializing database pool: ${logTarget} (SSL: ${!!dbConfig.ssl}, Pool Max: ${dbConfig.max})`);

pool = new Pool(dbConfig);

export { pool };

// Event listeners for the pool
pool.on('connect', () => {
  logger.info('Successfully connected to the database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  // Removed process.exit(-1) to prevent aggressive crashes on minor network blips
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    const queryConfig = (typeof text === 'object' && text !== null) ? text : { text, values: params };
    logger.debug('Executing query:', { text: queryConfig.text || text, name: queryConfig.name, params: queryConfig.values || params });
    const res = await pool.query(queryConfig);
    const duration = Date.now() - start;
    logger.debug('Query executed successfully', {
      text: queryConfig.text || text,
      name: queryConfig.name,
      duration: `${duration}ms`,
      rows: res.rowCount
    });
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    const qText = typeof text === 'object' ? text?.text : text;
    const qName = typeof text === 'object' ? text?.name : undefined;

    error.queryText = qText;
    error.queryDurationMs = duration;

    logger.error('Database query error:', {
      error: error.message,
      code: error.code,
      detail: error.detail,
      query: qText,
      name: qName,
      duration: `${duration}ms`,
      params: (typeof text === 'object' ? text?.values : params)
    });
    throw error;
  }
};

/**
 * Execute work with a leased client, guaranteeing release back to the pool.
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
export const withClient = async (callback) => {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
};

/**
 * Execute work inside a database transaction, automatically managing BEGIN, COMMIT, ROLLBACK, and client release.
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('Database transaction rollback error:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
};

// Test database connection on startup
export const testConnection = async () => {
  try {
    logger.info('Testing database connection...');
    const result = await pool.query('SELECT NOW()');
    logger.info('Database connection successful. Current time:', result.rows[0].now);
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    throw error;
  }
};
