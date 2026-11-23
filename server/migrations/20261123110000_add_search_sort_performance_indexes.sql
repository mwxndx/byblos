-- migration-hygiene:allow-nonconcurrent-index reason: idempotent startup and test provisioning
-- Migration: Add indexes on columns searched and sorted by across commerce, payments, and financial workflows

-- 1. Product Orders: search & sort by seller, buyer, status, and created_at
CREATE INDEX IF NOT EXISTS idx_product_orders_seller_status_created 
  ON product_orders (seller_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_orders_buyer_created 
  ON product_orders (buyer_id, created_at DESC) 
  WHERE buyer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_orders_active_settlement 
  ON product_orders (payment_status, status) 
  WHERE payment_status = 'completed';

-- 2. Payments: search & join by order_id, invoice_id, and status
CREATE INDEX IF NOT EXISTS idx_payments_order_status 
  ON payments (order_id, status) 
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_invoice_status 
  ON payments (invoice_id, status) 
  WHERE invoice_id IS NOT NULL;

-- 3. Withdrawal Requests: search & sort by seller, creator, buyer, and status
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_seller_status 
  ON withdrawal_requests (seller_id, status, created_at DESC) 
  WHERE seller_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_creator_status 
  ON withdrawal_requests (creator_id, status, created_at DESC) 
  WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_buyer_status 
  ON withdrawal_requests (buyer_id, status, created_at DESC) 
  WHERE buyer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_pending_status 
  ON withdrawal_requests (status) 
  WHERE status NOT IN ('completed', 'failed', 'rejected');

-- 4. Creator Earnings: search & sort by creator and created_at
CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator_created 
  ON creator_earnings (creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_referral_earnings_referrer_created 
  ON creator_referral_earnings (referrer_creator_id, created_at DESC);

-- 5. Seller Creator Links: search & filter by status
CREATE INDEX IF NOT EXISTS idx_seller_creator_links_seller_status 
  ON seller_creator_links (seller_id, status);

CREATE INDEX IF NOT EXISTS idx_seller_creator_links_creator_status 
  ON seller_creator_links (creator_id, status);

