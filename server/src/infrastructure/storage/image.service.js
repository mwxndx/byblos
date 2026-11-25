import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import logger from '../../shared/utils/logger.js';
import { AppError } from '../../shared/utils/errorHandler.js';

import { uploadToCloudinary, deleteFromCloudinary } from '../../shared/utils/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageService {
    constructor() {
        this.uploadDir = path.join(process.cwd(), 'uploads', 'images');
        this.baseUrl = process.env.BACKEND_URL || 'https://byblosafrica.site';
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        this.useCloudinary = !!(cloudName && apiKey &&
            cloudName !== 'your_cloud_name' &&
            apiKey !== 'your_api_key');

        fs.mkdirSync(this.uploadDir, { recursive: true });

        if (this.useCloudinary) {
            logger.info('☁️ ImageService: Cloudinary integration ACTIVE');
        } else {
            logger.warn('📁 ImageService: Local disk storage ACTIVE (Cloudinary credentials missing)');
        }
    }

    /**
     * Convert base64 image to file and upload (Cloudinary or Local)
     */
    async base64ToFile(base64String, prefix = 'img') {
        try {
            if (!base64String?.startsWith('data:image')) {
                return base64String;
            }

            const matches = base64String.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
            if (matches?.length !== 3) {
                throw new AppError('Invalid base64 image string', 400);
            }

            const mimeType = matches[1].toLowerCase();
            const allowedTypes = {
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp',
                'image/avif': 'avif'
            };
            const extension = allowedTypes[mimeType];
            if (!extension) {
                throw new AppError('Unsupported image type. Use JPEG, PNG, WebP, or AVIF.', 400);
            }

            const imageData = matches[2].replace(/\s/g, '');
            const rawBuffer = Buffer.from(imageData, 'base64');
            if (!this.hasExpectedMagicBytes(rawBuffer, mimeType)) {
                throw new AppError('Image content does not match the declared type.', 400);
            }

            // Re-encode through sharp to strip EXIF/GPS metadata, reject decompression bombs,
            // and neutralize polyglot payloads appended after valid image headers.
            let buffer;
            try {
                const pipeline = sharp(rawBuffer, { limitInputPixels: 40_000_000 })
                    .rotate()
                    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true });

                if (mimeType === 'image/png') {
                    buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
                } else if (mimeType === 'image/webp') {
                    buffer = await pipeline.webp({ quality: 85 }).toBuffer();
                } else if (mimeType === 'image/avif') {
                    buffer = await pipeline.avif({ quality: 80 }).toBuffer();
                } else {
                    buffer = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
                }
            } catch {
                throw new AppError('Invalid or corrupted image content.', 400);
            }

            // Using SHA-256 for secure hashing (SonarQube compliance)
            const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 12);
            const filename = `${prefix}_${Date.now()}_${hash}.${extension}`;
            const filepath = path.join(this.uploadDir, filename);

            // 1. Always write to local temp first (required by Cloudinary uploader)
            await fs.promises.writeFile(filepath, buffer);

            // 2. If Cloudinary is configured, upload and return secure_url with guaranteed cleanup
            if (this.useCloudinary) {
                const folder = prefix.includes('product') ? 'products' : 'profiles';
                try {
                    const result = await uploadToCloudinary(filepath, folder);
                    logger.info(`Uploaded to Cloudinary: ${result.secure_url}`);
                    return result.secure_url;
                } finally {
                    if (fs.existsSync(filepath)) {
                        await fs.promises.unlink(filepath).catch(err =>
                            logger.warn(`[ImageService] Temp file cleanup warning: ${err.message}`)
                        );
                    }
                }
            }

            // 3. Fallback to local URL (allowed in development / test only)
            if (process.env.NODE_ENV === 'production') {
                if (fs.existsSync(filepath)) {
                    await fs.promises.unlink(filepath).catch(() => {});
                }
                logger.error('CRITICAL: Persistent media storage failed. Cloudinary is required in production.');
                throw new AppError('Persistent media storage is unavailable in production. Cloudinary configuration required.', 503);
            }

            const shortUrl = `/uploads/images/${filename}`;
            logger.info(`Saved locally (development/test fallback): ${shortUrl}`);
            return shortUrl;

        } catch (error) {
            if (error.isOperational) {
                logger.warn(`ImageService.base64ToFile validation failed: ${error.message}`);
            } else {
                logger.error('Error in ImageService.base64ToFile:', error);
            }
            throw error;
        }
    }

    /**
     * Convert multiple base64 images to files
     * @param {Array<string>} base64Strings - Array of base64 encoded images
     * @param {string} prefix - Optional prefix for filenames
     * @returns {Promise<Array<string>>} - Array of short URL paths
     */
    async convertMultiple(base64Strings, prefix = 'img') {
        if (!Array.isArray(base64Strings)) {
            throw new AppError('Images payload must be an array.', 400);
        }
        if (base64Strings.length > 10) {
            throw new AppError('Too many images: maximum 10 images allowed.', 400);
        }
        const results = [];
        for (const base64 of base64Strings) {
            results.push(await this.base64ToFile(base64, prefix));
        }
        return results;
    }

    /**
     * Check if a string is a base64 image
     * @param {string} str - String to check
     * @returns {boolean}
     */
    isBase64Image(str) {
        return str && typeof str === 'string' && str.startsWith('data:image');
    }

    hasExpectedMagicBytes(buffer, mimeType) {
        if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

        if (mimeType === 'image/jpeg') {
            return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        }

        if (mimeType === 'image/png') {
            return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        }

        if (mimeType === 'image/webp') {
            return buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
                buffer.subarray(8, 12).toString('ascii') === 'WEBP';
        }

        if (mimeType === 'image/gif') {
            return buffer.subarray(0, 3).toString('ascii') === 'GIF';
        }

        if (mimeType === 'image/avif') {
            return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
        }

        return false;
    }

    /**
     * Delete image file (Cloudinary or Local)
     */
    async deleteImage(imageUrl) {
        try {
            if (!imageUrl || this.isBase64Image(imageUrl)) {
                return;
            }

            // 1. Handle Cloudinary Deletion
            if (imageUrl.includes('cloudinary.com')) {
                // Extract public ID from URL: .../upload/v12345/byblos/products/img_123.jpg
                // Public ID is: byblos/products/img_123
                const parts = imageUrl.split('/');
                const uploadIndex = parts.indexOf('upload');
                if (uploadIndex !== -1) {
                    // Public ID is everything after 'upload/vXXXXX/'
                    const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
                    const publicId = publicIdWithExt.split('.')[0];

                    logger.info(`Deleting from Cloudinary: ${publicId}`);
                    await deleteFromCloudinary(publicId);
                    return;
                }
            }

            // 2. Handle Local Deletion (Fallback)
            const filename = path.basename(imageUrl);
            const filepath = path.join(this.uploadDir, filename);

            if (fs.existsSync(filepath)) {
                await fs.promises.unlink(filepath);
                logger.info(`Deleted local image file: ${filename}`);
            }
        } catch (error) {
            logger.error('Error in ImageService.deleteImage:', error);
        }
    }
}

export default new ImageService();


