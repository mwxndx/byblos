import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_TEMPLATES,
  readTemplate,
  sendProductOrderConfirmationEmail,
  sendNewOrderNotificationEmail,
  sendPaymentReceiptEmail,
  sendWelcomeEmail
} from '../src/shared/utils/email.js';

describe('Email Templates Whitelist and Rendering Contract', () => {
  test('ALLOWED_TEMPLATES whitelist includes all existing and actively used email templates', () => {
    const requiredTemplates = [
      'verify-email',
      'reset-password',
      'welcome',
      'welcome-buyer',
      'welcome-seller',
      'product-order-confirmation',
      'new-order-notification',
      'product-payment-receipt',
      'ticket-confirmation',
      'order-confirmation',
      'order-shipped',
      'order-delivered',
      'order-cancelled',
      'payout-processed',
      'creator-invite',
      'creator-shop-request'
    ];

    for (const template of requiredTemplates) {
      assert.ok(
        ALLOWED_TEMPLATES?.has(template),
        `Template "${template}" must be in ALLOWED_TEMPLATES whitelist`
      );
    }
  });

  test('readTemplate renders product-order-confirmation without throwing unauthorized error', async () => {
    const html = await readTemplate('product-order-confirmation', {
      appName: 'Byblos',
      websiteUrl: 'https://byblosafrica.site',
      orderNumber: 'ORD-12345',
      orderDate: '11/5/2026',
      items: [{ title: 'Test Product', quantity: 1, price: 202 }],
      totalAmount: 202,
      buyerName: 'Roy',
      buyerPhone: '+254111548797',
      sellerName: 'Shop',
      sellerPhone: '+254700000000',
      isDoorDelivery: false,
      deliveryLocation: 'Shop Pickup',
      pre_handoff_sla: null,
      custom_product: null,
      custom_production_deadline_at: null,
      custom_production_grace_deadline_at: null
    });
    assert.ok(html.includes('ORD-12345'));
  });
});
