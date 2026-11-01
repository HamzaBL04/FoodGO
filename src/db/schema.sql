-- FoodGO schema. Tables map one-to-one to the classes of SDD §3.2 / §4.1,
-- plus platform tables (admin, session, otp, audit) needed to run them.
-- Integrity rules I-1 .. I-11 from SDD §4.2 are noted where enforced.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organization (
  organization_id TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL CHECK (type IN ('WORKPLACE', 'CAMPUS', 'INSTITUTION')),
  status          TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- One row per person (D-01). No restaurant_id: the person is not owned by a
-- restaurant, their access is.
CREATE TABLE IF NOT EXISTS customer (
  customer_id     TEXT PRIMARY KEY,
  full_name       TEXT NOT NULL,
  phone_number    TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL REFERENCES organization(organization_id),
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS restaurant (
  restaurant_id             TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'ACTIVE',
  ordering_deadline         TEXT NOT NULL CHECK (ordering_deadline GLOB '[0-2][0-9]:[0-5][0-9]'),
  access_rules              TEXT NOT NULL DEFAULT 'ORGANIZATION_MEMBERS_ONLY',
  cash_on_delivery_enabled  INTEGER NOT NULL DEFAULT 1,
  e_payment_enabled         INTEGER NOT NULL DEFAULT 1,
  address                   TEXT
);

-- Membership: this restaurant registered this customer (D-01, I-11).
-- Composite key makes double registration impossible (SDD §4.1).
CREATE TABLE IF NOT EXISTS restaurant_customer (
  restaurant_id   TEXT NOT NULL REFERENCES restaurant(restaurant_id),
  customer_id     TEXT NOT NULL REFERENCES customer(customer_id),
  credential_ref  TEXT NOT NULL UNIQUE,
  eligible        INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  registered_at   TEXT NOT NULL,
  registered_by   TEXT NOT NULL,
  PRIMARY KEY (restaurant_id, customer_id)
);

CREATE TABLE IF NOT EXISTS restaurant_staff (
  staff_id        TEXT PRIMARY KEY,
  restaurant_id   TEXT NOT NULL REFERENCES restaurant(restaurant_id),
  identity        TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  credential_hash TEXT NOT NULL, -- I-10: never the credential itself
  status          TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- BR-06/BR-07: employed and equipped by the restaurant. No vehicle or
-- equipment columns on purpose (BR-07 is enforced by absence).
CREATE TABLE IF NOT EXISTS delivery_person (
  delivery_person_id TEXT PRIMARY KEY,
  restaurant_id      TEXT NOT NULL REFERENCES restaurant(restaurant_id),
  identity           TEXT NOT NULL UNIQUE,
  full_name          TEXT NOT NULL,
  phone_number       TEXT,
  credential_hash    TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS menu (
  menu_id       TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurant(restaurant_id),
  status        TEXT NOT NULL DEFAULT 'PUBLISHED'
);

CREATE TABLE IF NOT EXISTS menu_item (
  menu_item_id  TEXT PRIMARY KEY,
  menu_id       TEXT NOT NULL REFERENCES menu(menu_id),
  restaurant_id TEXT NOT NULL REFERENCES restaurant(restaurant_id), -- I-1
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_millimes INTEGER NOT NULL CHECK (price_millimes > 0), -- TND stored in millimes
  available     INTEGER NOT NULL DEFAULT 1,
  removed       INTEGER NOT NULL DEFAULT 0 -- soft removal: placed orders still resolve (SDD §5.1.3)
);

CREATE TABLE IF NOT EXISTS orders (
  order_id          TEXT PRIMARY KEY,
  customer_id       TEXT NOT NULL REFERENCES customer(customer_id),
  restaurant_id     TEXT NOT NULL REFERENCES restaurant(restaurant_id),
  status            TEXT NOT NULL,
  total_millimes    INTEGER NOT NULL CHECK (total_millimes > 0), -- I-4, I-6
  payment_method    TEXT NOT NULL,
  payment_status    TEXT NOT NULL, -- projection of payment.status (D-03, I-7)
  created_at        TEXT NOT NULL,
  service_date      TEXT NOT NULL,
  deadline_snapshot TEXT NOT NULL, -- D-04
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_item (
  order_item_id       TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES orders(order_id),
  menu_item_id        TEXT NOT NULL REFERENCES menu_item(menu_item_id),
  name_snapshot       TEXT NOT NULL,
  quantity            INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 50),
  unit_price_millimes INTEGER NOT NULL CHECK (unit_price_millimes > 0) -- D-02
);

-- Sole owner of payment status (D-03). At least one row per order (I-3).
CREATE TABLE IF NOT EXISTS payment (
  payment_id         TEXT PRIMARY KEY,
  order_id           TEXT NOT NULL REFERENCES orders(order_id),
  method             TEXT NOT NULL CHECK (method IN ('CASH_ON_DELIVERY', 'E_PAYMENT')),
  status             TEXT NOT NULL,
  provider_reference TEXT,
  amount_millimes    INTEGER NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

-- Exists before dispatch (BR-10). One per order (SDD §3.3: 0..1).
CREATE TABLE IF NOT EXISTS delivery_assignment (
  assignment_id      TEXT PRIMARY KEY,
  order_id           TEXT NOT NULL UNIQUE REFERENCES orders(order_id),
  delivery_person_id TEXT NOT NULL REFERENCES delivery_person(delivery_person_id),
  restaurant_id      TEXT NOT NULL REFERENCES restaurant(restaurant_id), -- I-1, I-8
  status             TEXT NOT NULL,
  assigned_at        TEXT NOT NULL,
  started_at         TEXT,
  completed_at       TEXT
);

-- Platform administrators are provisioned out of band (SDD §5.3): only the
-- seed script creates them, there is no API route.
CREATE TABLE IF NOT EXISTS platform_admin (
  admin_id        TEXT PRIMARY KEY,
  identity        TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  credential_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  token_hash    TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'STAFF', 'DELIVERY', 'ADMIN')),
  subject_id    TEXT NOT NULL,
  restaurant_id TEXT,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_challenge (
  challenge_id  TEXT PRIMARY KEY,
  phone_number  TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  consumed      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_event (
  audit_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at            TEXT NOT NULL,
  actor_role    TEXT NOT NULL,
  actor_id      TEXT NOT NULL,
  restaurant_id TEXT,
  action        TEXT NOT NULL,
  entity        TEXT,
  entity_id     TEXT,
  detail        TEXT
);
