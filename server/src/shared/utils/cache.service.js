import { getRedisClient } from '../config/redis.js';
import logger from './logger.js';

class CacheService {
    constructor() {
        this.redis = getRedisClient();
        this.defaultTTL = 300; // 5 minutes default
    }

    /**
     * Check if Redis is ready for operations
     * @returns {boolean}
     */
    isReady() {
        if (!this.redis) return false;
        if (this.redis.__inMemoryFallback) return true;
        return this.redis.status === 'ready';
    }

    /**
     * Get value from cache
     * @param {string} key 
     * @returns {Promise<any>}
     */
    async get(key) {
        try {
            if (!this.isReady()) return null;

            const data = await this.redis.get(key);
            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            logger.warn(`Cache Get Warning (${key}): ${error.message}`);
            return null;
        }
    }

    /**
     * Set value in cache
     * @param {string} key 
     * @param {any} value 
     * @param {number} ttlSeconds 
     */
    async set(key, value, ttlSeconds = this.defaultTTL) {
        try {
            if (!this.isReady()) return false;

            const stringValue = JSON.stringify(value);
            await this.redis.set(key, stringValue, 'EX', ttlSeconds);
            return true;
        } catch (error) {
            logger.warn(`Cache Set Warning (${key}): ${error.message}`);
            return false;
        }
    }

    /**
     * Delete value from cache
     * @param {string} key 
     */
    async del(key) {
        try {
            if (!this.isReady()) return false;
            await this.redis.del(key);
            return true;
        } catch (error) {
            logger.warn(`Cache Del Warning (${key}): ${error.message}`);
            return false;
        }
    }

    /**
     * Delete value from cache (alias)
     * @param {string} key 
     */
    async delete(key) {
        return await this.del(key);
    }

    /**
     * Clear cache with pattern
     * @param {string} pattern e.g. "products:*"
     */
    async clearPattern(pattern) {
        try {
            if (!this.isReady()) return false;
            let cursor = '0';
            const allKeys = [];
            do {
                const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
                cursor = nextCursor;
                if (keys?.length > 0) allKeys.push(...keys);
            } while (cursor !== '0');

            if (allKeys.length > 0) {
                // Delete chunks in parallel
                const chunks = [];
                for (let i = 0; i < allKeys.length; i += 500) {
                    chunks.push(allKeys.slice(i, i + 500));
                }
                await Promise.all(chunks.map(chunk => this.redis.del(chunk)));
            }
            return true;
        } catch (error) {
            logger.warn(`Cache Clear Pattern Warning (${pattern}): ${error.message}`);
            return false;
        }
    }
}

export default new CacheService();

