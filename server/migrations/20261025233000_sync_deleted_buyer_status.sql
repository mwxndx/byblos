-- Migration: Sync status to 'deleted' for tombstoned or self-deleted buyer rows
UPDATE buyers
SET status = 'deleted', updated_at = NOW()
WHERE status != 'deleted'
  AND (
    email LIKE 'deleted_buyer_%@deleted.byblos'
    OR email LIKE 'deleted-user-%@bybloshq.local'
    OR full_name = 'Deleted user'
    OR full_name = 'Deleted buyer'
    OR mobile_payment = 'deleted'
    OR mobile_payment LIKE 'deleted-%'
    OR (user_id IS NOT NULL AND user_id IN (SELECT id FROM users WHERE is_active = FALSE AND (email LIKE 'deleted_%@deleted.byblos' OR email LIKE 'deleted-user-%@bybloshq.local')))
  );
