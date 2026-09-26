-- Add product_orders.handoff_confirmed_at.
--
-- Stamped when Mzigo confirms the buyer now has the package — door delivery
-- 'delivered' or hub pickup 'collected' (see logisticsDashboard.service
-- updateLegStatus). It anchors the 48h buyer-confirmation backstop: if the
-- buyer never taps "confirm receipt" within 48h of this timestamp, the
-- auto-complete sweep releases the seller's escrow. NULL until Mzigo confirms
-- the handoff, so the backstop clock never starts prematurely.
--
-- Idempotent via IF NOT EXISTS.

ALTER TABLE public.product_orders
    ADD COLUMN IF NOT EXISTS handoff_confirmed_at timestamp with time zone;
