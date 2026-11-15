import crypto from 'node:crypto';
import logger from '../../../shared/utils/logger.js';

export const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
export const LEDGER_ADVISORY_LOCK_KEY = 'byblos:financial_ledger:seq';

class LedgerService {
    /**
     * Computes deterministic SHA-256 hash using the canonical representation:
     * prev_hash:sequence_number:entity_type:entity_id:amount:balance_after:event_type
     */
    computeRowHash({ prevHash, sequenceNumber, entityType, entityId, amount, balanceAfter, eventType }) {
        const safeAmount = Number(amount || 0).toFixed(2);
        const safeBalance = Number(balanceAfter || 0).toFixed(2);
        const canonical = `${prevHash}:${sequenceNumber}:${entityType}:${entityId}:${safeAmount}:${safeBalance}:${eventType}`;
        return crypto.createHash('sha256').update(canonical).digest('hex');
    }

    /**
     * Builds a standard binary Merkle tree root from an array of hexadecimal leaf hashes.
     * Pairs are hashed recursively: parent = SHA256(left + right).
     * If an odd number of hashes exists at any level, the last hash is duplicated.
     */
    computeMerkleRoot(leafHashes = []) {
        if (!Array.isArray(leafHashes) || leafHashes.length === 0) {
            return null;
        }
        if (leafHashes.length === 1) {
            return leafHashes[0];
        }

        let currentLevel = [...leafHashes];

        while (currentLevel.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : left;
                const parent = crypto.createHash('sha256').update(left + right).digest('hex');
                nextLevel.push(parent);
            }
            currentLevel = nextLevel;
        }

        return currentLevel[0];
    }

    /**
     * Validates an ordered array of ledger rows for cryptographic continuity and checksums.
     */
    validateRows(rows = []) {
        if (!Array.isArray(rows) || rows.length === 0) {
            return { isValid: true, auditedCount: 0 };
        }

        for (let i = 0; i < rows.length; i++) {
            const curr = rows[i];
            const currSeq = Number(curr.sequence_number);

            // 1. Verify sequence continuity if not the very first checked element
            if (i > 0) {
                const prev = rows[i - 1];
                const prevSeq = Number(prev.sequence_number);
                if (currSeq !== prevSeq + 1) {
                    return {
                        isValid: false,
                        severedAtSequence: currSeq,
                        reason: `Sequence gap detected: expected ${prevSeq + 1}, found ${currSeq}`
                    };
                }
                if (curr.prev_hash !== prev.row_hash) {
                    return {
                        isValid: false,
                        severedAtSequence: currSeq,
                        reason: `Hash link broken: row ${currSeq} prev_hash (${curr.prev_hash}) does not match row ${prevSeq} row_hash (${prev.row_hash})`
                    };
                }
            }

            // 2. Recompute and verify row hash
            const expectedHash = this.computeRowHash({
                prevHash: curr.prev_hash,
                sequenceNumber: currSeq,
                entityType: curr.entity_type,
                entityId: curr.entity_id,
                amount: curr.amount,
                balanceAfter: curr.balance_after,
                eventType: curr.event_type
            });

            if (curr.row_hash !== expectedHash) {
                return {
                    isValid: false,
                    severedAtSequence: currSeq,
                    reason: `Row data altered at sequence ${currSeq}: hash mismatch (stored: ${curr.row_hash}, expected: ${expectedHash})`
                };
            }
        }

        return {
            isValid: true,
            auditedCount: rows.length,
            latestHash: rows[rows.length - 1].row_hash,
            latestSequence: Number(rows[rows.length - 1].sequence_number)
        };
    }

    /**
     * Calculates derived ledger balance from rows and verifies against expected balance.
     */
    verifyBalanceFromRows(rows = [], expectedBalance) {
        if (!Array.isArray(rows) || rows.length === 0) {
            const exp = Math.round(Number(expectedBalance || 0) * 100) / 100;
            return {
                isValid: exp === 0,
                ledgerBalance: 0,
                expectedBalance: exp,
                error: exp === 0 ? null : 'no_ledger_history'
            };
        }

        let sumCents = 0;
        for (const row of rows) {
            const amt = Math.round(Number(row.amount || 0) * 100);
            sumCents += amt;
        }

        const calculatedBalance = sumCents / 100;
        const normalizedExpected = Math.round(Number(expectedBalance || 0) * 100) / 100;

        const isMatch = Math.abs(calculatedBalance - normalizedExpected) < 0.01;

        return {
            isValid: isMatch,
            ledgerBalance: calculatedBalance,
            expectedBalance: normalizedExpected,
            error: isMatch ? null : 'balance_mismatch'
        };
    }

    /**
     * Appends an immutable row to financial_ledger inside the caller's transaction.
     * Uses pg_advisory_xact_lock to strictly sequence entries without blocking concurrent table reads.
     */
    async appendEntry(client, {
        eventType,
        entityType,
        entityId,
        amount,
        balanceAfter,
        orderId = null,
        payoutId = null,
        withdrawalId = null,
        paymentReference = null,
        currency = 'KES',
        payload = {}
    }) {
        if (!client || typeof client.query !== 'function') {
            throw new Error('LedgerService.appendEntry requires an active database transaction client');
        }

        // 1. Transaction-level advisory lock serializes sequence appends
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [LEDGER_ADVISORY_LOCK_KEY]);

        // 2. Fetch the latest sequence and row_hash
        const { rows: latestRows } = await client.query(
            `SELECT sequence_number, row_hash
             FROM financial_ledger
             ORDER BY sequence_number DESC
             LIMIT 1
             FOR UPDATE`
        );

        let prevHash = GENESIS_PREV_HASH;
        let nextSeq = 1;

        if (latestRows.length > 0) {
            prevHash = latestRows[0].row_hash;
            nextSeq = Number(latestRows[0].sequence_number) + 1;
        }

        // 3. Compute next row hash
        const rowHash = this.computeRowHash({
            prevHash,
            sequenceNumber: nextSeq,
            entityType,
            entityId,
            amount,
            balanceAfter,
            eventType
        });

        // 4. Insert row
        const { rows: inserted } = await client.query(
            `INSERT INTO financial_ledger (
                sequence_number,
                event_type,
                entity_type,
                entity_id,
                order_id,
                payout_id,
                withdrawal_id,
                payment_reference,
                amount,
                currency,
                balance_after,
                prev_hash,
                row_hash,
                payload
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
             RETURNING *`,
            [
                nextSeq,
                eventType,
                entityType,
                entityId,
                orderId,
                payoutId,
                withdrawalId,
                paymentReference,
                amount,
                currency,
                balanceAfter,
                prevHash,
                rowHash,
                JSON.stringify(payload)
            ]
        );

        logger.debug('[LedgerService] Appended entry', {
            sequenceNumber: nextSeq,
            eventType,
            entityType,
            entityId,
            amount,
            balanceAfter,
            rowHash
        });

        return inserted[0];
    }

    /**
     * Cryptographically verifies that an entity's current balance matches their ledger history.
     */
    async verifyEntityBalance(client, { entityType, entityId, expectedBalance }) {
        const { rows } = await client.query(
            `SELECT sequence_number, amount, balance_after, prev_hash, row_hash, event_type
             FROM financial_ledger
             WHERE entity_type = $1 AND entity_id = $2
             ORDER BY sequence_number ASC`,
            [entityType, entityId]
        );

        return this.verifyBalanceFromRows(rows, expectedBalance);
    }

    /**
     * Audits the entire hash chain between two sequences or across all rows.
     */
    async auditChainIntegrity(client, { fromSequence = 1, toSequence = null } = {}) {
        const queryText = toSequence
            ? `SELECT sequence_number, prev_hash, row_hash, entity_type, entity_id, amount, balance_after, event_type
               FROM financial_ledger
               WHERE sequence_number >= $1 AND sequence_number <= $2
               ORDER BY sequence_number ASC`
            : `SELECT sequence_number, prev_hash, row_hash, entity_type, entity_id, amount, balance_after, event_type
               FROM financial_ledger
               WHERE sequence_number >= $1
               ORDER BY sequence_number ASC`;

        const params = toSequence ? [fromSequence, toSequence] : [fromSequence];
        const { rows } = await client.query(queryText, params);

        return this.validateRows(rows);
    }
}

export default new LedgerService();

