-- Razorpay payment integration migration (additive).
-- Safe to run after bookings_migration.sql.
-- PostgreSQL.

BEGIN;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100) NULL;

-- Keep existing provider_* columns for compatibility; backfill explicit provider columns where possible.
UPDATE payments
SET payment_provider = COALESCE(payment_provider, provider)
WHERE payment_provider IS NULL;

UPDATE payments
SET razorpay_order_id = COALESCE(razorpay_order_id, provider_order_id)
WHERE razorpay_order_id IS NULL
  AND (provider = 'razorpay' OR provider_order_id LIKE 'order_%');

UPDATE payments
SET razorpay_payment_id = COALESCE(razorpay_payment_id, provider_payment_id)
WHERE razorpay_payment_id IS NULL
  AND (provider = 'razorpay' OR provider_payment_id LIKE 'pay_%');

CREATE INDEX IF NOT EXISTS ix_payments_payment_provider ON payments(payment_provider);
CREATE INDEX IF NOT EXISTS ix_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS ix_payments_razorpay_payment_id ON payments(razorpay_payment_id);

-- Ensure payment status check allows CREATED (Razorpay-style) alongside existing statuses.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS ck_payments_status;
ALTER TABLE payments
    ADD CONSTRAINT ck_payments_status CHECK (
        payment_status IN ('INITIATED','PENDING','AUTHORIZED','CAPTURED','FAILED','CANCELLED','REFUNDED','CREATED')
    );


COMMIT;
