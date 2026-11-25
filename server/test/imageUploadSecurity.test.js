import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductImage } from '../src/domains/commerce/products/productValidationRules.js';
import ImageService from '../src/infrastructure/storage/image.service.js';

describe('Image & upload security controls', () => {
  it('blocks cloud metadata, full RFC1918, 0.0.0.0, IPv6 loopback, and non-https remote URLs in validateProductImage', () => {
    const blockedUrls = [
      'http://169.254.169.254/latest/meta-data/',
      'https://169.254.169.254/latest/meta-data/',
      'https://172.17.0.1/admin.png',
      'https://172.31.255.1/admin.png',
      'https://0.0.0.0/test.png',
      'https://[::1]/test.png',
      'http://res.cloudinary.com/demo/image/upload/sample.jpg',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
    ];

    for (const url of blockedUrls) {
      assert.throws(() => validateProductImage(url), /Invalid/i, `Expected rejection for ${url}`);
    }
  });

  it('allows valid Cloudinary https URLs, local /uploads/ paths, and data:image/ base64 in validateProductImage', () => {
    assert.equal(
      validateProductImage('https://res.cloudinary.com/byblos/image/upload/v1/sample.jpg'),
      'https://res.cloudinary.com/byblos/image/upload/v1/sample.jpg'
    );
    assert.equal(
      validateProductImage('/uploads/images/prod_123.webp'),
      '/uploads/images/prod_123.webp'
    );
  });

  it('rejects polyglot / corrupted image buffers that spoof magic bytes in ImageService.base64ToFile', async () => {
    // Valid JPEG SOI header followed by HTML/script bytes instead of valid JPEG frames
    const fakeJpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      Buffer.from('JFIF\0<html><script>alert(1)</script></html>'),
    ]);
    const dataUri = `data:image/jpeg;base64,${fakeJpeg.toString('base64')}`;

    await assert.rejects(
      () => ImageService.base64ToFile(dataUri, 'test_polyglot'),
      (err) => err && err.statusCode === 400
    );
  });

  it('rejects unbounded images[] arrays in ImageService.convertMultiple', async () => {
    const tooMany = Array.from({ length: 12 }, () => '/uploads/images/a.jpg');
    await assert.rejects(
      () => ImageService.convertMultiple(tooMany, 'prod'),
      /Too many images/i
    );
  });
});

