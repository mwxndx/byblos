import logger from '../../../shared/utils/logger.js';
import { reportAlert } from '../../../shared/utils/alerting.js';
import LedgerService from './LedgerService.js';
import LedgerAnchorClient from './LedgerAnchorClient.js';

class LedgerAuditService {
    /**
     * Performs a cryptographic audit of unanchored ledger rows, builds a Merkle root,
     * anchors it to external WORM storage, and records the epoch.
     *
     * @param {import('pg').PoolClient} client Leased database client inside or outside an active transaction
     * @returns {Promise<{ created: boolean, reason?: string, epoch?: object }>}
     */
    async auditAndAnchorEpoch(client) {
        // 1. Determine the start sequence from the last recorded epoch
        const { rows: lastEpochRows } = await client.query(
            `SELECT epoch_id, end_sequence, merkle_root, created_at
             FROM ledger_epochs
             ORDER BY end_sequence DESC
             LIMIT 1`
        );

        const lastEpoch = lastEpochRows[0] || null;
        const startSequence = lastEpoch ? Number(lastEpoch.end_sequence) + 1 : 1;

        // 2. Determine the current highest sequence in financial_ledger
        const { rows: maxSeqRows } = await client.query(
            `SELECT MAX(sequence_number) as max_seq FROM financial_ledger`
        );
        const endSequence = Number(maxSeqRows[0]?.max_seq || 0);

        if (!endSequence || endSequence < startSequence) {
            logger.info('[LedgerAuditService] No new ledger entries to anchor', {
                startSequence,
                endSequence
            });
            return {
                created: false,
                reason: 'no_new_entries',
                startSequence,
                endSequence
            };
        }

        // 3. Fetch unanchored rows in sequence
        const { rows } = await client.query(
            `SELECT sequence_number, prev_hash, row_hash, entity_type, entity_id, amount, balance_after, event_type, created_at
             FROM financial_ledger
             WHERE sequence_number >= $1 AND sequence_number <= $2
             ORDER BY sequence_number ASC`,
            [startSequence, endSequence]
        );

        if (rows.length === 0) {
            return { created: false, reason: 'empty_slice', startSequence, endSequence };
        }

        // 4. Verify boundary continuity if continuing from a prior epoch
        if (startSequence > 1) {
            const { rows: boundaryRows } = await client.query(
                `SELECT sequence_number, row_hash FROM financial_ledger WHERE sequence_number = $1`,
                [startSequence - 1]
            );
            const boundaryPrev = boundaryRows[0];
            if (!boundaryPrev || rows[0].prev_hash !== boundaryPrev.row_hash) {
                const alertPayload = {
                    startSequence,
                    endSequence,
                    boundarySequence: startSequence - 1,
                    expectedPrevHash: boundaryPrev?.row_hash,
                    actualPrevHash: rows[0].prev_hash
                };
                logger.error('[LedgerAuditService] Epoch boundary continuity broken!', alertPayload);
                await reportAlert('CRITICAL SECURITY VIOLATION: Ledger Epoch Boundary Continuity Broken', alertPayload);
                throw new Error(`Epoch boundary severed at sequence ${startSequence}: prev_hash does not match sequence ${startSequence - 1}`);
            }
        }

        // 5. Full cryptographic chain verification across the slice
        const validation = LedgerService.validateRows(rows);
        if (!validation.isValid) {
            const alertPayload = {
                startSequence,
                endSequence,
                severedAtSequence: validation.severedAtSequence,
                reason: validation.reason
            };
            logger.error('[LedgerAuditService] Ledger integrity violation detected during audit!', alertPayload);
            await reportAlert('CRITICAL SECURITY VIOLATION: Ledger Chain Tampering Detected During Audit', alertPayload);
            throw new Error(`Ledger audit rejected: ${validation.reason}`);
        }

        // 6. Compute Merkle tree root from all leaf hashes
        const leafHashes = rows.map(r => r.row_hash);
        const merkleRoot = LedgerService.computeMerkleRoot(leafHashes);

        // 7. Anchor to external WORM storage (AWS S3 Object Lock or local fallback)
        const anchorResult = await LedgerAnchorClient.anchorEpoch({
            startSequence,
            endSequence,
            entryCount: rows.length,
            merkleRoot,
            leafHashes,
            payloadSummary: {
                firstSequence: startSequence,
                lastSequence: endSequence,
                firstRowHash: rows[0].row_hash,
                lastRowHash: rows[rows.length - 1].row_hash
            }
        });

        // 8. Record the anchored epoch in ledger_epochs
        const { rows: insertedEpochs } = await client.query(
            `INSERT INTO ledger_epochs (
                start_sequence,
                end_sequence,
                entry_count,
                merkle_root,
                anchor_type,
                anchor_reference,
                status
             ) VALUES ($1, $2, $3, $4, $5, $6, 'anchored')
             RETURNING *`,
            [
                startSequence,
                endSequence,
                rows.length,
                merkleRoot,
                anchorResult.anchorType,
                anchorResult.anchorReference
            ]
        );

        const newEpoch = insertedEpochs[0];

        logger.info('[LedgerAuditService] Successfully verified and anchored ledger epoch', {
            epochId: newEpoch.epoch_id,
            startSequence,
            endSequence,
            entryCount: rows.length,
            merkleRoot,
            anchorType: anchorResult.anchorType,
            anchorReference: anchorResult.anchorReference
        });

        return {
            created: true,
            epoch: newEpoch
        };
    }
}

export default new LedgerAuditService();

