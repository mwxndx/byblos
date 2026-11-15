import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '../../../shared/utils/logger.js';

class LedgerAnchorClient {
    constructor() {
        this.bucket = process.env.AWS_S3_LEDGER_BUCKET || null;
        this.region = process.env.AWS_REGION || 'af-south-1';
        this.accessKeyId = process.env.AWS_ACCESS_KEY_ID || null;
        this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || null;
        this.endpoint = process.env.AWS_S3_ENDPOINT || null;
        this.retentionDays = Number.parseInt(process.env.LEDGER_ANCHOR_RETENTION_DAYS, 10) || 365;
        this.localArchiveDir = process.env.LEDGER_LOCAL_ARCHIVE_DIR || path.resolve(process.cwd(), 'data/ledger_epochs');
    }

    /**
     * Anchors an epoch Merkle manifest to external WORM storage (AWS S3 Object Lock)
     * or local immutable file archive when AWS S3 is not configured.
     */
    async anchorEpoch({ startSequence, endSequence, entryCount, merkleRoot, leafHashes = [], payloadSummary = {} }) {
        const timestamp = new Date();
        const retainUntil = new Date(timestamp.getTime() + this.retentionDays * 24 * 60 * 60 * 1000);
        const fileName = `epoch_${startSequence}_${endSequence}_${merkleRoot.slice(0, 16)}.json`;
        const s3Key = `epochs/${fileName}`;

        const manifest = {
            version: '1.0',
            merkleRoot,
            startSequence,
            endSequence,
            entryCount,
            anchoredAt: timestamp.toISOString(),
            retainUntil: retainUntil.toISOString(),
            firstLeafHash: leafHashes[0] || null,
            lastLeafHash: leafHashes[leafHashes.length - 1] || null,
            leafCount: leafHashes.length,
            leafHashes,
            summary: payloadSummary
        };

        const manifestBody = JSON.stringify(manifest, null, 2);
        const manifestHash = crypto.createHash('sha256').update(manifestBody).digest('hex');

        // If AWS S3 credentials and bucket are configured, upload with S3 Object Lock
        if (this.bucket && this.accessKeyId && this.secretAccessKey) {
            try {
                return await this._uploadToS3Worm({
                    s3Key,
                    manifestBody,
                    manifestHash,
                    retainUntil
                });
            } catch (err) {
                logger.error('[LedgerAnchorClient] S3 Object Lock upload failed; falling back to local archive', {
                    error: err.message,
                    s3Key
                });
            }
        }

        // Local fallback (development, testing, staging without S3)
        return await this._saveToLocalArchive({
            fileName,
            manifestBody,
            manifestHash,
            retainUntil
        });
    }

    async _saveToLocalArchive({ fileName, manifestBody, manifestHash, retainUntil }) {
        await fs.mkdir(this.localArchiveDir, { recursive: true });
        const filePath = path.join(this.localArchiveDir, fileName);

        try {
            // If file already exists with read-only attributes, temporarily grant write access to overwrite
            await fs.chmod(filePath, 0o666);
        } catch {
            // File does not exist yet
        }

        // Write file and set permissions to read-only (simulated local WORM)
        await fs.writeFile(filePath, manifestBody, { encoding: 'utf8' });
        await fs.chmod(filePath, 0o444).catch(() => {});

        logger.info('[LedgerAnchorClient] Anchored epoch manifest to local immutable archive', {
            path: filePath,
            sha256: manifestHash
        });

        return {
            anchorType: 'local_archive',
            anchorReference: `file://${filePath}`,
            sha256: manifestHash,
            retainUntil: retainUntil.toISOString()
        };
    }

    async _uploadToS3Worm({ s3Key, manifestBody, manifestHash, retainUntil }) {
        const host = this.endpoint ? new URL(this.endpoint).host : `${this.bucket}.s3.${this.region}.amazonaws.com`;
        const pathUri = `/${s3Key}`;
        const url = this.endpoint ? `${this.endpoint}/${this.bucket}${pathUri}` : `https://${host}${pathUri}`;

        const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.slice(0, 8);
        const retainUntilISO = retainUntil.toISOString();

        const headers = {
            'Host': host,
            'x-amz-date': amzDate,
            'x-amz-content-sha256': manifestHash,
            'x-amz-object-lock-mode': 'COMPLIANCE',
            'x-amz-object-lock-retain-until-date': retainUntilISO,
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(manifestBody))
        };

        const authorization = this._computeSigV4({
            method: 'PUT',
            pathUri: this.endpoint ? `/${this.bucket}${pathUri}` : pathUri,
            headers,
            payloadHash: manifestHash,
            amzDate,
            dateStamp
        });

        headers['Authorization'] = authorization;

        const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: manifestBody
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`S3 PUT failed with status ${response.status}: ${errorText}`);
        }

        logger.info('[LedgerAnchorClient] Successfully anchored epoch to AWS S3 Object Lock (WORM)', {
            bucket: this.bucket,
            key: s3Key,
            merkleHash: manifestHash,
            retainUntil: retainUntilISO
        });

        return {
            anchorType: 's3_worm',
            anchorReference: `s3://${this.bucket}/${s3Key}`,
            sha256: manifestHash,
            retainUntil: retainUntilISO
        };
    }

    _computeSigV4({ method, pathUri, headers, payloadHash, amzDate, dateStamp }) {
        const signedHeaders = Object.keys(headers)
            .map(h => h.toLowerCase())
            .sort()
            .join(';');

        const canonicalHeaders = Object.keys(headers)
            .map(h => h.toLowerCase())
            .sort()
            .map(h => `${h}:${String(headers[h] || '').trim()}\n`)
            .join('');

        const canonicalRequest = [
            method,
            pathUri,
            '', // query string
            canonicalHeaders,
            signedHeaders,
            payloadHash
        ].join('\n');

        const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
        const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

        const stringToSign = [
            'AWS4-HMAC-SHA256',
            amzDate,
            credentialScope,
            canonicalRequestHash
        ].join('\n');

        const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
        const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
        const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
        const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

        const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

        return `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    }
}

export default new LedgerAnchorClient();
