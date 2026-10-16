/**
 * digitalDownloadStreamer.js
 *
 * Dedicated streaming and SSRF verification handler for digital products.
 * Isolates HTTP piping, redirect recursion, and MIME resolution from order.controller.js.
 */
import https from 'node:https';
import http from 'node:http';
import logger from '../../../shared/utils/logger.js';
import { isCloudinaryAssetUrl } from '../../../shared/utils/assetUrlGuard.js';

const MIME_MAP = {
    // Documents
    '.pdf': 'application/pdf',
    '.epub': 'application/epub+zip',
    '.mobi': 'application/x-mobipocket-ebook',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Archives
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    // Images
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.heic': 'image/heic',
    '.ico': 'image/x-icon',
    // Audio & Video
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska'
};

export function getMimeType(ext) {
    return MIME_MAP[ext] || 'application/octet-stream';
}

export function streamCandidateUrls({ candidateUrls, digitalFilePath, cleanFileName, mimeType, res }) {
    const tryStream = (index) => {
        if (index >= candidateUrls.length) {
            logger.error(`[DOWNLOAD] All stream candidates failed for ${digitalFilePath}`);
            if (!res.headersSent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'File could not be retrieved from storage'
                });
            }
            return;
        }

        const currentUrl = candidateUrls[index];
        // SSRF guard: only ever fetch Cloudinary-hosted assets.
        if (!isCloudinaryAssetUrl(currentUrl)) {
            logger.warn(`[DOWNLOAD] Refusing non-Cloudinary candidate for ${digitalFilePath}, trying next...`);
            return tryStream(index + 1);
        }

        const requester = currentUrl.startsWith('https:') ? https : http;

        const reqStream = requester.get(currentUrl, (streamRes) => {
            if (streamRes.statusCode === 200) {
                res.setHeader('Content-Type', mimeType);
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanFileName)}"`);
                if (streamRes.headers['content-length']) {
                    res.setHeader('Content-Length', streamRes.headers['content-length']);
                }
                res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
                return streamRes.pipe(res);
            }

            // If redirected (301/302/307/308), follow redirect safely
            if ([301, 302, 307, 308].includes(streamRes.statusCode) && streamRes.headers.location) {
                const redirectUrl = streamRes.headers.location;
                if (!isCloudinaryAssetUrl(redirectUrl)) {
                    logger.warn(`[DOWNLOAD] Refusing non-Cloudinary redirect for ${digitalFilePath}, trying next...`);
                    return tryStream(index + 1);
                }
                const redirRequester = redirectUrl.startsWith('https:') ? https : http;
                return redirRequester.get(redirectUrl, (redirRes) => {
                    if (redirRes.statusCode === 200) {
                        res.setHeader('Content-Type', mimeType);
                        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanFileName)}"`);
                        if (redirRes.headers['content-length']) {
                            res.setHeader('Content-Length', redirRes.headers['content-length']);
                        }
                        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
                        return redirRes.pipe(res);
                    }
                    return tryStream(index + 1);
                }).on('error', () => tryStream(index + 1));
            }

            logger.warn(`[DOWNLOAD] Candidate ${index} (${currentUrl}) returned status ${streamRes.statusCode}, trying next candidate...`);
            return tryStream(index + 1);
        });

        reqStream.on('error', (err) => {
            logger.warn(`[DOWNLOAD] Candidate ${index} network error (${err.message}), trying next candidate...`);
            tryStream(index + 1);
        });
    };

    tryStream(0);
}

import * as digitalDownloadRepository from '../../commerce/repositories/digitalDownload.repository.js';
import path from 'path';
import { getDigitalAssetUrls } from '../../../shared/utils/cloudinary.js';

export async function handleDigitalProductDownload({ orderId, productId, buyerProfileId, clientCheckoutToken, res }) {
    const data = await digitalDownloadRepository.findVerifiedDigitalItem({
        orderId,
        buyerId: buyerProfileId,
        clientCheckoutToken,
        productId
    });

    if (!data) {
        return res.status(404).json({
            status: 'error',
            message: 'Digital product not found in this completed order'
        });
    }

    const digitalFilePath = data.digital_file_path;
    if (!digitalFilePath) {
        return res.status(404).json({
            status: 'error',
            message: 'File path not configured for this product'
        });
    }

    const fileName = data.digital_file_name || path.basename(digitalFilePath) || `digital-product-${productId}`;
    const ext = path.extname(fileName).toLowerCase() || path.extname(digitalFilePath).toLowerCase() || '.bin';
    const cleanFileName = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;
    const mimeType = getMimeType(ext);

    const candidateUrls = getDigitalAssetUrls(digitalFilePath, 300);
    logger.info(`[DOWNLOAD] Attempting stream for public_id: ${digitalFilePath} (Order: ${orderId}), candidate count: ${candidateUrls.length}`);

    streamCandidateUrls({ candidateUrls, digitalFilePath, cleanFileName, mimeType, res });
}

export default {
    getMimeType,
    streamCandidateUrls,
    handleDigitalProductDownload
};
