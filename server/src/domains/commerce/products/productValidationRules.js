import Fees from '../../../shared/config/fees.js';

/**
 * Validate and sanitize image URL/data with SSRF protection.
 */
export const validateProductImage = (imageData) => {
    if (!imageData) return null;

    const isBase64 = imageData.startsWith('data:image/');
    const isLocal = imageData.startsWith('/uploads/');
    const isRemote = imageData.startsWith('http');

    if (isRemote) {
        try {
            const url = new URL(imageData);
            const hostname = url.hostname.toLowerCase();

            // Block internal/private IPs and localhost
            const isInternal = hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname.startsWith('192.168.') ||
                hostname.startsWith('10.') ||
                hostname.startsWith('172.16.') ||
                hostname.endsWith('.local') ||
                hostname.endsWith('.internal');

            if (isInternal) {
                throw new Error('Invalid remote image URL: Internal addresses are not allowed.');
            }
        } catch (e) {
            throw new Error(e.message.includes('Internal addresses') ? e.message : 'Invalid remote image URL format.');
        }
    }

    if (!isBase64 && !isLocal && !isRemote) {
        throw new Error('Invalid image format. Expected base64, local path, or remote URL.');
    }

    // Size validation only applies to raw base64 data before upload
    if (isBase64) {
        const imageSize = (imageData.length * 0.75);
        if (imageSize > 5 * 1024 * 1024) { // 5MB limit
            throw new Error('Image size exceeds 5MB limit');
        }
    }

    return imageData;
};

/**
 * Validate Cloudinary public_id for storage as digital_file_path.
 */
export const sanitizeDigitalPath = (filePath) => {
    if (!filePath) return null;

    if (filePath.includes('\0') || filePath.startsWith('uploads/')) {
        throw new Error('Invalid digital file path: expected a Cloudinary public_id');
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(filePath) || filePath.startsWith('//')) {
        throw new Error('Invalid digital file path: expected a Cloudinary public_id, not a URL');
    }

    return filePath;
};

/**
 * Ensure seller has pinned coordinates before offering services.
 */
export const assertServiceShopLocation = async (pool, sellerId) => {
    const { rows: sellerRows } = await pool.query(
        'SELECT latitude, longitude FROM sellers WHERE id = $1',
        [sellerId]
    );
    const seller = sellerRows[0];
    const lat = seller?.latitude ? Number.parseFloat(seller.latitude) : null;
    const lng = seller?.longitude ? Number.parseFloat(seller.longitude) : null;
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        throw new Error('Pin your shop location coordinates in Settings before offering services');
    }
};

/**
 * Validate product type rules for physical custom/imported products.
 */
export const validateProductTypeRules = ({
    product_type = 'physical',
    is_custom_product = false,
    production_days,
    is_imported_product = false,
    import_days
}) => {
    const validProductTypes = ['physical', 'digital', 'service'];
    if (product_type && !validProductTypes.includes(product_type)) {
        throw new Error('Invalid product type');
    }

    const customProduct = product_type === 'physical' && is_custom_product === true;
    const productionDaysValue = customProduct ? Number.parseInt(production_days, 10) : null;
    const importedProduct = product_type === 'physical' && is_imported_product === true;
    const importDaysValue = importedProduct ? Number.parseInt(import_days, 10) : null;

    if (is_custom_product === true && product_type !== 'physical') {
        throw new Error('Only physical products can be custom products');
    }
    if (is_imported_product === true && product_type !== 'physical') {
        throw new Error('Only physical products can be imported or pre-order products');
    }
    if (customProduct && importedProduct) {
        throw new Error('Choose either custom product or imported/pre-order product, not both');
    }
    if (customProduct && (!Number.isInteger(productionDaysValue) || productionDaysValue < 1 || productionDaysValue > 5)) {
        throw new Error('Custom physical products require production days between 1 and 5');
    }
    if (importedProduct && ![7, 14, 21, 30].includes(importDaysValue)) {
        throw new Error('Imported physical products require an estimated ready time of 7, 14, 21, or 30 days');
    }

    return {
        customProduct,
        productionDaysValue,
        importedProduct,
        importDaysValue
    };
};

/**
 * Resolve and validate custom/imported product fields for an update.
 */
export const resolveProductUpdateCustomFields = (existing, data) => {
    const nextProductType = data.product_type || existing.product_type || 'physical';
    const nextCustom = nextProductType === 'physical' && data.is_custom_product === true;
    const nextProductionDays = nextCustom ? Number.parseInt(data.production_days ?? existing.production_days, 10) : null;
    const nextImported = nextProductType === 'physical' && data.is_imported_product === true;
    const nextImportDays = nextImported ? Number.parseInt(data.import_days ?? existing.import_days, 10) : null;

    if (data.is_custom_product === true && nextProductType !== 'physical') {
        throw new Error('Only physical products can be custom products');
    }
    if (data.is_imported_product === true && nextProductType !== 'physical') {
        throw new Error('Only physical products can be imported or pre-order products');
    }
    if (nextCustom && nextImported) {
        throw new Error('Choose either custom product or imported/pre-order product, not both');
    }
    if (nextCustom && (!Number.isInteger(nextProductionDays) || nextProductionDays < 1 || nextProductionDays > 5)) {
        throw new Error('Custom physical products require production days between 1 and 5');
    }
    if (nextImported && ![7, 14, 21, 30].includes(nextImportDays)) {
        throw new Error('Imported physical products require an estimated ready time of 7, 14, 21, or 30 days');
    }

    return {
        nextProductType,
        is_custom_product: nextCustom,
        production_days: nextCustom ? nextProductionDays : null,
        customization_prompt: nextCustom
            ? String(data.customization_prompt || existing.customization_prompt || 'Tell the seller exactly what you want customized.').trim().slice(0, 240)
            : null,
        is_imported_product: nextImported,
        import_days: nextImported ? nextImportDays : null,
        import_note: nextImported
            ? String(data.import_note || existing.import_note || 'Imported item. Delivery starts after seller handoff.').trim().slice(0, 240)
            : null
    };
};

/**
 * Resolve status, soldAt, and is_sold synchronization.
 */
export const resolveProductStatusUpdate = (data, status, soldAt) => {
    const targetStatus = status || (soldAt ? 'sold' : (data.is_sold === false || data.isSold === false ? 'available' : undefined));
    const targetSoldAt = soldAt !== undefined ? soldAt : (data.sold_at !== undefined ? data.sold_at : (targetStatus === 'available' ? null : undefined));
    const isMarkedSold = targetStatus === 'sold' || Boolean(targetSoldAt);

    if (targetStatus !== undefined || targetSoldAt !== undefined || data.is_sold !== undefined || data.isSold !== undefined) {
        return {
            status: isMarkedSold ? 'sold' : 'available',
            sold_at: isMarkedSold ? (targetSoldAt || new Date().toISOString()) : null,
            is_sold: isMarkedSold
        };
    }

    return null;
};
