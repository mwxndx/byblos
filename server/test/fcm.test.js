// Unit test for the platform-aware FCM message builder. Pure — no network,
// no service account, so it runs anywhere.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildFcmMessage } from '../src/shared/config/fcm.js';

describe('buildFcmMessage — platform-aware payload', () => {
  test('android token gets the android block and no webpush block', () => {
    const msg = buildFcmMessage({ token: 't', title: 'Hi', body: 'B', data: {}, platform: 'android' });
    assert.ok(msg.android, 'android block present');
    assert.equal(msg.android.notification.channel_id, 'byblos_general');
    assert.equal(msg.webpush, undefined, 'no webpush block for android');
  });

  test('ios native token also gets the android block, not webpush (mirrors prior behavior)', () => {
    const msg = buildFcmMessage({ token: 't', title: 'Hi', body: 'B', data: {}, platform: 'ios' });
    assert.ok(msg.android, 'android block present for native ios');
    assert.equal(msg.webpush, undefined);
  });

  test('web token gets a webpush block and NO android block', () => {
    const msg = buildFcmMessage({ token: 't', title: 'Hi', body: 'B', data: {}, platform: 'web' });
    assert.equal(msg.android, undefined, 'android block must be omitted for web');
    assert.ok(msg.webpush, 'webpush block present for web');
  });

  test('web token with an absolute link sets webpush.fcm_options.link', () => {
    const msg = buildFcmMessage({ token: 't', title: 'Hi', body: 'B', data: { path: 'https://www.byblosafrica.site/buyer/orders' }, platform: 'web' });
    assert.equal(msg.webpush.fcm_options.link, 'https://www.byblosafrica.site/buyer/orders');
  });

  test('web token with a relative path does not set fcm_options (SW routes it instead)', () => {
    const msg = buildFcmMessage({ token: 't', title: 'Hi', body: 'B', data: { path: '/buyer/orders' }, platform: 'web' });
    assert.equal(msg.webpush.fcm_options, undefined);
  });

  test('always carries token, notification and data', () => {
    const msg = buildFcmMessage({ token: 'tok', title: 'T', body: 'B', data: { a: '1' }, platform: 'web' });
    assert.equal(msg.token, 'tok');
    assert.deepEqual(msg.notification, { title: 'T', body: 'B' });
    assert.deepEqual(msg.data, { a: '1' });
  });
});
