import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import LedgerService, { GENESIS_PREV_HASH } from '../src/domains/finance/ledger/LedgerService.js';

describe('LedgerService - Core Engine & Cryptographic Integrity', () => {
    test('computes deterministic SHA-256 row hashes using canonical formatting', () => {
        const prevHash = GENESIS_PREV_HASH;
        const hash1 = LedgerService.computeRowHash({
            prevHash,
            sequenceNumber: 1,
            entityType: 'seller',
            entityId: 42,
            amount: 1500.5,
            balanceAfter: 1500.5,
            eventType: 'ESCROW_RELEASED'
        });

        assert.equal(typeof hash1, 'string');
        assert.equal(hash1.length, 64);
        assert.match(hash1, /^[0-9a-f]{64}$/);

        // Determinism: identical inputs must generate identical hash
        const hash2 = LedgerService.computeRowHash({
            prevHash,
            sequenceNumber: 1,
            entityType: 'seller',
            entityId: 42,
            amount: 1500.5,
            balanceAfter: 1500.5,
            eventType: 'ESCROW_RELEASED'
        });
        assert.equal(hash1, hash2);

        // Tampering any field produces a completely different hash
        const tamperedHash = LedgerService.computeRowHash({
            prevHash,
            sequenceNumber: 1,
            entityType: 'seller',
            entityId: 42,
            amount: 1500.51, // slight change
            balanceAfter: 1500.5,
            eventType: 'ESCROW_RELEASED'
        });
        assert.notEqual(hash1, tamperedHash);
    });

    test('builds binary Merkle tree root correctly from leaf hashes', () => {
        const h1 = '1111111111111111111111111111111111111111111111111111111111111111';
        const h2 = '2222222222222222222222222222222222222222222222222222222222222222';
        const h3 = '3333333333333333333333333333333333333333333333333333333333333333';

        // 1. Single leaf: root is the leaf itself
        assert.equal(LedgerService.computeMerkleRoot([h1]), h1);

        // 2. Even leaves: parent = sha256(h1 + h2)
        const evenRoot = LedgerService.computeMerkleRoot([h1, h2]);
        assert.equal(typeof evenRoot, 'string');
        assert.equal(evenRoot.length, 64);

        // 3. Odd leaves (3 leaves): duplicates last leaf h3 to pair with itself
        const oddRoot = LedgerService.computeMerkleRoot([h1, h2, h3]);
        assert.equal(typeof oddRoot, 'string');
        assert.equal(oddRoot.length, 64);
        assert.notEqual(evenRoot, oddRoot);
    });

    test('verifies in-memory simulated ledger chain continuity and detects tampering', () => {
        const genesisHash = GENESIS_PREV_HASH;
        
        // Build valid 3-row chain
        const row1Hash = LedgerService.computeRowHash({
            prevHash: genesisHash,
            sequenceNumber: 1,
            entityType: 'seller',
            entityId: 10,
            amount: 500,
            balanceAfter: 500,
            eventType: 'GENESIS_BALANCE'
        });

        const row2Hash = LedgerService.computeRowHash({
            prevHash: row1Hash,
            sequenceNumber: 2,
            entityType: 'seller',
            entityId: 10,
            amount: 1000,
            balanceAfter: 1500,
            eventType: 'ESCROW_RELEASED'
        });

        const row3Hash = LedgerService.computeRowHash({
            prevHash: row2Hash,
            sequenceNumber: 3,
            entityType: 'seller',
            entityId: 10,
            amount: -300,
            balanceAfter: 1200,
            eventType: 'WITHDRAWAL_RESERVE_LOCKED'
        });

        const chain = [
            { sequence_number: 1, prev_hash: genesisHash, row_hash: row1Hash, entity_type: 'seller', entity_id: 10, amount: '500.00', balance_after: '500.00', event_type: 'GENESIS_BALANCE' },
            { sequence_number: 2, prev_hash: row1Hash, row_hash: row2Hash, entity_type: 'seller', entity_id: 10, amount: '1000.00', balance_after: '1500.00', event_type: 'ESCROW_RELEASED' },
            { sequence_number: 3, prev_hash: row2Hash, row_hash: row3Hash, entity_type: 'seller', entity_id: 10, amount: '-300.00', balance_after: '1200.00', event_type: 'WITHDRAWAL_RESERVE_LOCKED' }
        ];

        // Valid chain audit
        const validAudit = LedgerService.validateRows(chain);
        assert.equal(validAudit.isValid, true);
        assert.equal(validAudit.auditedCount, 3);

        // Tamper test 1: Alter amount in row 2
        const tamperedChain1 = JSON.parse(JSON.stringify(chain));
        tamperedChain1[1].amount = '50000.00'; // Rogue DB edit
        const auditTamper1 = LedgerService.validateRows(tamperedChain1);
        assert.equal(auditTamper1.isValid, false);
        assert.equal(auditTamper1.severedAtSequence, 2);

        // Tamper test 2: Break hash link
        const tamperedChain2 = JSON.parse(JSON.stringify(chain));
        tamperedChain2[2].prev_hash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
        const auditTamper2 = LedgerService.validateRows(tamperedChain2);
        assert.equal(auditTamper2.isValid, false);
        assert.equal(auditTamper2.severedAtSequence, 3);

        // Tamper test 3: Sequence gap (e.g. row deleted)
        const tamperedChain3 = [chain[0], chain[2]]; // row 2 deleted
        const auditTamper3 = LedgerService.validateRows(tamperedChain3);
        assert.equal(auditTamper3.isValid, false);
        assert.match(auditTamper3.reason, /Sequence gap/i);
    });

    test('calculates and validates derived entity ledger balance', () => {
        const rows = [
            { amount: '500.00', balance_after: '500.00' },
            { amount: '1000.00', balance_after: '1500.00' },
            { amount: '-300.00', balance_after: '1200.00' },
        ];

        // When balance matches sum (1200)
        const matchResult = LedgerService.verifyBalanceFromRows(rows, 1200);
        assert.equal(matchResult.isValid, true);
        assert.equal(matchResult.ledgerBalance, 1200);

        // When balance does NOT match (e.g. someone ran UPDATE sellers SET balance = 500000)
        const mismatchResult = LedgerService.verifyBalanceFromRows(rows, 500000);
        assert.equal(mismatchResult.isValid, false);
        assert.equal(mismatchResult.expectedBalance, 500000);
        assert.equal(mismatchResult.ledgerBalance, 1200);
        assert.equal(mismatchResult.error, 'balance_mismatch');
    });

    test('appendEntry queries execute advisory lock, hash link, and insert using leased client', async () => {
        const mockQueries = [];
        const fakeClient = {
            query: async (sql, params) => {
                mockQueries.push({ sql, params });
                if (sql.includes('SELECT pg_advisory_xact_lock')) {
                    return { rows: [] };
                }
                if (sql.includes('SELECT sequence_number, row_hash')) {
                    return {
                        rows: [{ sequence_number: '5', row_hash: '5555555555555555555555555555555555555555555555555555555555555555' }]
                    };
                }
                if (sql.includes('INSERT INTO financial_ledger')) {
                    return {
                        rows: [{
                            sequence_number: params[0],
                            event_type: params[1],
                            entity_type: params[2],
                            entity_id: params[3],
                            amount: params[8],
                            balance_after: params[10],
                            prev_hash: params[11],
                            row_hash: params[12]
                        }]
                    };
                }
                return { rows: [] };
            }
        };

        const result = await LedgerService.appendEntry(fakeClient, {
            eventType: 'ESCROW_RELEASED',
            entityType: 'seller',
            entityId: 42,
            amount: 2500,
            balanceAfter: 7500,
            orderId: 101,
            payload: { orderNumber: 'BYB-101' }
        });

        assert.equal(result.sequence_number, 6);
        assert.equal(result.prev_hash, '5555555555555555555555555555555555555555555555555555555555555555');
        assert.equal(result.amount, 2500);
        assert.equal(result.balance_after, 7500);
        assert.equal(mockQueries.length, 3);
        assert.match(mockQueries[0].sql, /pg_advisory_xact_lock/);
    });
});
