-- Indexes for the hot, restaurant-scoped queries measured in the refactor &
-- optimisation report (docs/REFACTOR_AND_OPTIMIZATION_REPORT.md).
CREATE INDEX IF NOT EXISTS ix_orders_restaurant_day ON orders (restaurant_id, service_date, created_at);
CREATE INDEX IF NOT EXISTS ix_orders_customer_created ON orders (customer_id, created_at);
CREATE INDEX IF NOT EXISTS ix_order_item_order ON order_item (order_id);
CREATE INDEX IF NOT EXISTS ix_payment_order ON payment (order_id, created_at);
CREATE INDEX IF NOT EXISTS ix_assignment_person ON delivery_assignment (delivery_person_id, restaurant_id, assigned_at);
CREATE INDEX IF NOT EXISTS ix_restaurant_customer_customer ON restaurant_customer (customer_id);
CREATE INDEX IF NOT EXISTS ix_menu_item_restaurant ON menu_item (restaurant_id, removed);
CREATE INDEX IF NOT EXISTS ix_session_expiry ON session (expires_at);
