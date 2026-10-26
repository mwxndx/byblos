import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { timingSafeEqualString } from '../src/shared/utils/crypto.utils.js';

describe('timingSafeEqualString', () => {
    test('returns true for identical strings', () => {
        const token = 'c0ffeec0ffeec0ffeec0ffee';
        assert.equal(timingSafeEqualString(token, token), true);
        assert.equal(timingSafeEqualString('secret_token_123', 'secret_token_123'), true);
        assert.equal(timingSafeEqualString('', ''), true);
    });

    test('returns false for strings differing by one character', () => {
        assert.equal(timingSafeEqualString('secret_token_123', 'secret_token_124'), false);
        assert.equal(timingSafeEqualString('a', 'b'), false);
    });

    test('returns false for strings of different lengths without leaking length', () => {
        assert.equal(timingSafeEqualString('secret', 'secret123'), false);
        assert.equal(timingSafeEqualString('abc', 'abcdef'), false);
        assert.equal(timingSafeEqualString('short', ''), false);
    });

    test('returns false safely without throwing when inputs are null, undefined, or non-strings', () => {
        assert.equal(timingSafeEqualString(null, 'secret'), false);
        assert.equal(timingSafeEqualString('secret', null), false);
        assert.equal(timingSafeEqualString(undefined, 'secret'), false);
        assert.equal(timingSafeEqualString(12345, '12345'), false);
        assert.equal(timingSafeEqualString({}, {}), false);
        assert.equal(timingSafeEqualString(null, null), false);
        assert.equal(timingSafeEqualString(undefined, undefined), false);
    });
});
