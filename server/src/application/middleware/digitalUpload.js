import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import { unlink } from 'node:fs/promises';
import { uploadToCloudinary } from '../../shared/utils/cloudinary.js';
import logger from '../../shared/utils/logger.js';

// Allowed extensions categorized strictly into Audio, Video, and Document
export const DIGITAL_CATEGORIES = {
    audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
    video: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
    document: [
        '.pdf', '.epub', '.mobi', '.doc', '.docx', '.txt', '.csv', '.xlsx', '.xls', '.ppt', '.pptx',
        '.zip', '.rar', '.7z', '.tar', '.gz'
    ]
};

export const detectDigitalCategory = (filenameOrExt) => {
    if (!filenameOrExt) return null;
    const ext = (path.extname(filenameOrExt) || filenameOrExt).toLowerCase();
    for (const [category, extensions] of Object.entries(DIGITAL_CATEGORIES)) {
        if (extensions.includes(ext)) {
            return category;
        }
    }
    return null;
};

// File filter — validates extension and category before multer stores anything
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const requestedCategory = (
        req.query?.category ||
        req.query?.digital_category ||
        req.body?.digital_category ||
        ''
    ).toLowerCase().trim();

    if (requestedCategory) {
        if (!DIGITAL_CATEGORIES[requestedCategory]) {
            return cb(new Error("Invalid digital category. Supported categories: audio, video, document"), false);
        }
        if (!DIGITAL_CATEGORIES[requestedCategory].includes(ext)) {
            return cb(new Error(
                `Invalid file format for ${requestedCategory}. Supported formats: ${DIGITAL_CATEGORIES[requestedCategory].join(', ')}`
            ), false);
        }
        file.digital_category = requestedCategory;
        return cb(null, true);
    }

    const detected = detectDigitalCategory(ext);
    if (detected) {
        file.digital_category = detected;
        return cb(null, true);
    }

    const allAllowed = [
        ...DIGITAL_CATEGORIES.audio,
        ...DIGITAL_CATEGORIES.video,
        ...DIGITAL_CATEGORIES.document
    ];
    cb(new Error(`Allowed digital file types: ${allAllowed.join(', ')}`), false);
};

export const MAX_DIGITAL_FILE_SIZE_MB = 60;
export const MAX_DIGITAL_FILE_SIZE_BYTES = MAX_DIGITAL_FILE_SIZE_MB * 1024 * 1024;

// Disk storage — streams directly to OS temp directory without loading 60 MB into V8 RAM
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `digital-${crypto.randomBytes(8).toString('hex')}${ext}`);
    }
});

const multerInstance = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_DIGITAL_FILE_SIZE_BYTES, // NOSONAR 60 MB limit safely streamed to os.tmpdir diskStorage
        files: 1,
        fields: 10,
    },
});

/**
 * Express middleware that:
 * 1. Accepts a single 'digital_file' multipart field streamed to a temp file in os.tmpdir().
 * 2. Uploads the temp file to Cloudinary as resource_type 'raw'.
 * 3. Attaches the Cloudinary result to req.cloudinaryFile.
 * 4. Cleans up the temp file regardless of success or failure.
 *
 * On success, req.cloudinaryFile will contain:
 *   - public_id          {string}  Cloudinary asset ID — stored in products.digital_file_path
 *   - secure_url         {string}  Permanent HTTPS URL (for debug only; never exposed to clients)
 *   - original_filename  {string}  Original uploaded filename
 *   - bytes              {number}  File size in bytes
 *   - digital_category   {string}  Validated digital category ('audio' | 'video' | 'document')
 */
export const cloudinaryDigitalUpload = (req, res, next) => {
    multerInstance.single('digital_file')(req, res, async (multerErr) => {
        if (multerErr) {
            const message = multerErr.code === 'LIMIT_FILE_SIZE'
                ? `File is too large. Maximum size for digital products is ${MAX_DIGITAL_FILE_SIZE_MB}MB.`
                : multerErr.message || 'File upload error';

            return res.status(400).json({
                status: 'error',
                message,
            });
        }

        if (!req.file) {
            // No file attached — let the controller handle the missing-file response
            return next();
        }

        const tempFilePath = req.file.path;

        try {
            // Verify magic bytes on the uploaded temp file before sending to Cloudinary
            const fd = await fs.promises.open(tempFilePath, 'r');
            const headerBuf = Buffer.alloc(16);
            try {
                await fd.read(headerBuf, 0, 16, 0);
            } finally {
                await fd.close();
            }

            const ext = path.extname(req.file.originalname).toLowerCase();
            const isValidDigitalHeader = (() => {
                if (ext === '.pdf') return headerBuf.subarray(0, 5).toString('ascii') === '%PDF-';
                if (ext === '.zip') return headerBuf[0] === 0x50 && headerBuf[1] === 0x4b;
                if (ext === '.mp3') return headerBuf.subarray(0, 3).toString('ascii') === 'ID3' || (headerBuf[0] === 0xff && (headerBuf[1] & 0xe0) === 0xe0);
                if (ext === '.wav') return headerBuf.subarray(0, 4).toString('ascii') === 'RIFF' && headerBuf.subarray(8, 12).toString('ascii') === 'WAVE';
                if (ext === '.ogg') return headerBuf.subarray(0, 4).toString('ascii') === 'OggS';
                if (ext === '.flac') return headerBuf.subarray(0, 4).toString('ascii') === 'fLaC';
                if (ext === '.mp4' || ext === '.m4a' || ext === '.mov') return headerBuf.subarray(4, 8).toString('ascii') === 'ftyp';
                return true;
            })();

            if (!isValidDigitalHeader) {
                await fs.promises.unlink(tempFilePath).catch(() => {});
                return res.status(400).json({
                    status: 'error',
                    message: 'Uploaded digital file content does not match its declared extension.',
                });
            }

            // uploadToCloudinary deletes the temp file on completion (success or error)
            const cloudinaryResult = await uploadToCloudinary(
                tempFilePath,
                'digital_products',
                'raw'
            );

            req.cloudinaryFile = {
                public_id: cloudinaryResult.public_id,
                secure_url: cloudinaryResult.secure_url,
                original_filename: req.file.originalname,
                bytes: req.file.size,
                digital_category: req.file.digital_category || detectDigitalCategory(req.file.originalname) || 'document',
            };

            return next();
        } catch (uploadErr) {
            // Clean up temp file if uploadToCloudinary did not already remove it
            try {
                if (fs.existsSync(tempFilePath)) {
                    await unlink(tempFilePath);
                }
            } catch (_) { /* ignore cleanup errors */ }

            logger.error('[digitalUpload] Cloudinary upload failed:', uploadErr.message);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to upload file to storage. Please try again.',
            });
        }
    });
};
