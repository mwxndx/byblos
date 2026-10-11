import path from 'path';
import ProductModel from './product.model.js';
import logger from '../../../shared/utils/logger.js';
import { pool } from '../../../infrastructure/database/database.js';
import cacheService from '../../../shared/utils/cache.service.js';
import Fees from '../../../shared/config/fees.js';
import {
    validateProductImage,
    sanitizeDigitalPath,
    assertServiceShopLocation,
    validateProductTypeRules,
    resolveProductUpdateCustomFields,
    resolveProductStatusUpdate
} from './productValidationRules.js';

class ProductService {
    /**
     * Create a new product
     */
    static async createProduct(sellerId, data) {
        const {
            name, price, description, image, image_url, aesthetic = 'noir',
            is_digital = false, digital_file_path, digital_file_name, digital_file_size,
            product_type = 'physical', service_locations, service_options,
            is_custom_product = false, production_days, customization_prompt,
            is_imported_product = false, import_days, import_note
        } = data;

        // Validation Logic
        if (!name || price === undefined || price === null || !description) {
            throw new Error('Name, price, and description are required');
        }

        const priceValue = this.parseAndValidatePrice(price);

        if (is_digital && !digital_file_path) {
            throw new Error('Digital file is required for digital products');
        }

        // Security: Sanitize digital file path if present
        let sanitizedDigitalPath = digital_file_path;
        if (is_digital && digital_file_path) {
            sanitizedDigitalPath = this._sanitizeDigitalPath(digital_file_path);
        }

        if (product_type === 'service') {
            if (!service_options || !service_options.availability_days) {
                throw new Error('Availability days are required for services');
            }
            await assertServiceShopLocation(pool, sellerId);
        }

        const { customProduct, productionDaysValue, importedProduct, importDaysValue } = validateProductTypeRules({
            product_type,
            is_custom_product,
            production_days,
            is_imported_product,
            import_days
        });

        // Image Handling with SSRF verification
        let imageData = image_url || image || null;
        if (imageData) {
            validateProductImage(imageData);
        }

        let finalProductType = product_type;
        if (is_digital) finalProductType = 'digital';

        const productData = {
            name: name.trim(),
            price: priceValue,
            description: description.trim(),
            image_url: imageData,
            images: data.images ? JSON.stringify(data.images) : '[]',
            seller_id: sellerId,
            aesthetic,
            is_digital: is_digital || false,
            digital_file_path: sanitizedDigitalPath || null,
            digital_file_name: digital_file_name || null,
            digital_file_size: digital_file_size || null,
            product_type: finalProductType,
            service_locations: service_locations || null,
            service_options: service_options || null,
            is_custom_product: finalProductType === 'physical' ? customProduct : false,
            production_days: finalProductType === 'physical' && customProduct ? productionDaysValue : null,
            customization_prompt: finalProductType === 'physical' && customProduct
                ? String(customization_prompt || 'Tell the seller exactly what you want customized.').trim().slice(0, 240)
                : null,
            is_imported_product: finalProductType === 'physical' ? importedProduct : false,
            import_days: finalProductType === 'physical' && importedProduct ? importDaysValue : null,
            import_note: finalProductType === 'physical' && importedProduct
                ? String(import_note || 'Imported item. Delivery starts after seller handoff.').trim().slice(0, 240)
                : null
        };

        // Ensure images is always stored as a stringified array
        if (typeof productData.images !== 'string') {
            productData.images = JSON.stringify(productData.images || []);
        }

        const product = await ProductModel.create(null, productData); // Use default pool
        logger.info('Product created:', { id: product.id, sellerId });

        // Invalidate cache targeting this product and seller
        await ProductService.invalidateProductCache(product.id, sellerId, data.category_id || null);

        return product;
    }

    static async invalidateProductCache(productId, sellerId, categoryId = null) {
        const keysToDelete = [
            `products:item:${productId}`,
            `products:seller:${sellerId}`
        ];
        if (categoryId) {
            keysToDelete.push(`products:category:${categoryId}`);
        }
        await Promise.all(keysToDelete.map(key => cacheService.delete(key)));
        logger.info(`[PRODUCT_CACHE] Invalidated targeted keys for product ${productId}`);
    }

    static parseAndValidatePrice(price) {
        if (price === undefined || price === null) {
            throw new Error('Price is required');
        }
        const num = Number.parseFloat(price);
        if (!Number.isFinite(num) || num < Fees.PRODUCT_MIN_PRICE) {
            throw new Error(`Minimum price must be KES ${Fees.PRODUCT_MIN_PRICE}`);
        }
        // Strict integer cent calculation
        const cents = Math.round(num * 100);
        return cents / 100;
    }

    static async getSellerProducts(sellerId) {
        // Logic transformation from controller (null checks etc)
        const products = await ProductModel.findBySellerId(sellerId);
        return products.map(p => ({
            ...p,
            status: p.status || 'published',
            soldAt: p.sold_at || null, // Map snake_case DB to expected camelCase response if needed? 
            // Controller mapped `soldAt: p.soldAt || null`.
            // DB returns snake_case usually unless aliased.
            // Model `findBySellerId` returns `SELECT *`.
            // Keep consistency with DB fields internally, map at Service exit or Controller?
            // Service should return Domain Objects.
            // Controller does formatting.
        }));
    }

    static async getProduct(id, sellerId) {
        const product = await ProductModel.findById(id);
        if (!product || (sellerId && product.seller_id !== sellerId)) {
            throw new Error('Product not found or unauthorized');
        }
        return product;
    }

    static async updateProduct(sellerId, productId, data) {
        const { name, price, description, image_url, images, aesthetic, status, soldAt } = data;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Verify Ownership
            // Model.findById could be used, but we need FOR UPDATE logic maybe?
            // The controller used FOR UPDATE.
            // Let's implement a concise lock check or just trust `UPDATE ... WHERE seller_id=` returns 0 rows if unauthorized.
            // ProductModel.update includes seller_id in WHERE clause.
            // ProductModel.update includes seller_id in WHERE clause.

            const updateFields = {};
            if (name !== undefined) updateFields.name = name;
            if (price !== undefined) {
                updateFields.price = ProductService.parseAndValidatePrice(price);
            }
            if (description !== undefined) updateFields.description = description;
            if (image_url !== undefined) updateFields.image_url = image_url;
            if (images !== undefined) {
                updateFields.images = Array.isArray(images) ? JSON.stringify(images) : images;
            }
            if (aesthetic !== undefined) updateFields.aesthetic = aesthetic;
            if (
                data.is_custom_product !== undefined
                || data.production_days !== undefined
                || data.customization_prompt !== undefined
                || data.is_imported_product !== undefined
                || data.import_days !== undefined
                || data.import_note !== undefined
                || data.product_type !== undefined
            ) {
                const existing = await ProductModel.findById(productId);
                if (!existing) throw new Error('Product not found');
                if (existing.seller_id !== sellerId) throw new Error('Unauthorized');

                const customFields = resolveProductUpdateCustomFields(existing, data);
                if (customFields.nextProductType === 'service') {
                    await assertServiceShopLocation(pool, sellerId);
                }

                Object.assign(updateFields, {
                    is_custom_product: customFields.is_custom_product,
                    production_days: customFields.production_days,
                    customization_prompt: customFields.customization_prompt,
                    is_imported_product: customFields.is_imported_product,
                    import_days: customFields.import_days,
                    import_note: customFields.import_note
                });
            }

            // Status & SoldAt & IsSold sync
            const statusUpdate = resolveProductStatusUpdate(data, status, soldAt);
            if (statusUpdate) {
                Object.assign(updateFields, statusUpdate);
            }

            const updatedProduct = await ProductModel.update(client, productId, sellerId, updateFields);

            if (!updatedProduct) {
                // Could be not found OR unauthorized (since seller_id is part of query)
                const exists = await ProductModel.findById(productId);
                if (!exists) throw new Error('Product not found');
                if (exists.seller_id !== sellerId) throw new Error('Unauthorized');
                throw new Error('Update failed');
            }

            await client.query('COMMIT');

            // Targeted Invalidate cache
            await ProductService.invalidateProductCache(productId, sellerId, data.category_id || null);

            return updatedProduct;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateInventory(productId, inventoryData) {
        const { track_inventory, quantity, low_stock_threshold } = inventoryData;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Build update query
            const updateFields = [];
            const values = [];
            let paramCount = 1;

            if (track_inventory !== undefined) {
                updateFields.push(`track_inventory = $${paramCount++}`);
                values.push(track_inventory);
            }

            if (quantity !== undefined) {
                updateFields.push(`quantity = $${paramCount++}`);
                values.push(quantity);
            }

            if (low_stock_threshold !== undefined) {
                updateFields.push(`low_stock_threshold = $${paramCount++}`);
                values.push(low_stock_threshold);
            }

            if (updateFields.length === 0) {
                throw new Error('No inventory fields to update');
            }

            values.push(productId);
            const query = `
                UPDATE products 
                SET ${updateFields.join(', ')}, updated_at = NOW()
                WHERE id = $${paramCount}
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Product not found');
            }

            await client.query('COMMIT');
            logger.info(`[INVENTORY] Updated inventory for product ${productId}:`, {
                track_inventory,
                quantity,
                low_stock_threshold
            });

            return result.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('[INVENTORY] Error updating inventory:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    static async deleteProduct(sellerId, productId) {
        const deleted = await ProductModel.delete(null, productId, sellerId);
        if (!deleted) {
            const exists = await ProductModel.findById(productId);
            if (!exists) throw new Error('Product not found');
            if (exists.seller_id !== sellerId) throw new Error('Unauthorized');
        }

        // Targeted Invalidate cache
        await ProductService.invalidateProductCache(productId, sellerId);

        return true;
    }

    /**
     * Validate a Cloudinary public_id for storage as digital_file_path.
     */
    static _sanitizeDigitalPath(filePath) {
        return sanitizeDigitalPath(filePath);
    }
}

export default ProductService;
