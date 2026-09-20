import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCloudinaryAssetUrl } from '../src/shared/utils/assetUrlGuard.js';

test('accepts Cloudinary asset hosts', () => {
  assert.equal(isCloudinaryAssetUrl('https://res.cloudinary.com/demo/raw/upload/x.pdf'), true);
  assert.equal(isCloudinaryAssetUrl('https://api.cloudinary.com/v1_1/demo/x'), true);
  assert.equal(isCloudinaryAssetUrl('https://cloudinary.com/x'), true);
});

test('rejects SSRF targets and non-Cloudinary hosts', () => {
  // Cloud metadata, internal ranges, localhost — the SSRF payloads.
  assert.equal(isCloudinaryAssetUrl('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isCloudinaryAssetUrl('http://localhost:6379/'), false);
  assert.equal(isCloudinaryAssetUrl('http://127.0.0.1/'), false);
  assert.equal(isCloudinaryAssetUrl('https://evil.example.com/x'), false);
  // Look-alike hostnames must not slip past the suffix check.
  assert.equal(isCloudinaryAssetUrl('https://cloudinary.com.evil.com/x'), false);
  assert.equal(isCloudinaryAssetUrl('https://notcloudinary.com/x'), false);
});

test('rejects non-http(s) schemes and non-URLs', () => {
  assert.equal(isCloudinaryAssetUrl('file:///etc/passwd'), false);
  assert.equal(isCloudinaryAssetUrl('gopher://x'), false);
  assert.equal(isCloudinaryAssetUrl('byblos/digital_products/abc123'), false); // bare public_id
  assert.equal(isCloudinaryAssetUrl(''), false);
  assert.equal(isCloudinaryAssetUrl(null), false);
});
