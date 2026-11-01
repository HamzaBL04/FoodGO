-- Duplicate-submission protection (spec §7 reliability, "duplicate-submission
-- protection"). The client sends an Idempotency-Key per checkout; a retry
-- with the same key returns the original order instead of a second one.
ALTER TABLE orders ADD COLUMN client_request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_customer_request
  ON orders (customer_id, client_request_id) WHERE client_request_id IS NOT NULL;
