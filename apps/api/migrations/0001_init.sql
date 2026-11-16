-- KASA POS: initial D1 schema (Cloudflare Worker + D1).
-- Ported from the Laravel/MySQL migrations in server/database/migrations.
-- All timestamps are Unix epoch milliseconds (INTEGER), matching the JSON API.
-- All money values are whole rupiah (INTEGER).

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('Makanan', 'Minuman', 'Camilan')),
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_categories_sort ON categories (sort_order);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'Makanan' CHECK (kind IN ('Makanan', 'Minuman', 'Camilan')),
  prep_minutes INTEGER NOT NULL DEFAULT 5 CHECK (prep_minutes >= 0),
  badge TEXT,
  image TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_active ON products (is_active);

CREATE TABLE restaurant_tables (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  seats INTEGER NOT NULL CHECK (seats >= 1),
  area TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE orders (
  no INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'disimpan'
    CHECK (status IN ('disimpan', 'memasak', 'siap', 'sudah-dibayar')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  kitchen_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (kitchen_status IN ('draft', 'queued', 'preparing', 'ready', 'served')),
  order_type TEXT NOT NULL DEFAULT 'bawa-pulang' CHECK (order_type IN ('bawa-pulang', 'meja')),
  table_number INTEGER,
  table_name TEXT,
  guests INTEGER,
  customer_name TEXT,
  waiter_id TEXT,
  waiter_name TEXT,
  source TEXT CHECK (source IS NULL OR source IN ('pos', 'waiter', 'self-order')),
  payment_choice TEXT CHECK (payment_choice IS NULL OR payment_choice IN ('paid-now', 'pay-later')),
  item_count INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  service_charge INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  method TEXT CHECK (method IS NULL OR method IN ('kartu-qr', 'tunai', 'qris')),
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_paid_at ON orders (paid_at);
CREATE INDEX idx_orders_created_at ON orders (created_at);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no INTEGER NOT NULL REFERENCES orders (no) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  qty INTEGER NOT NULL CHECK (qty >= 1),
  note TEXT
);
CREATE INDEX idx_order_items_order ON order_items (order_no);

CREATE TABLE shifts (
  id TEXT PRIMARY KEY,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER,
  cashier_name TEXT NOT NULL,
  starting_cash INTEGER NOT NULL DEFAULT 0,
  actual_cash INTEGER,
  expected_cash INTEGER,
  cash_difference INTEGER,
  cash_sales_total INTEGER,
  cash_in_total INTEGER,
  cash_out_total INTEGER,
  denominations TEXT, -- JSON object
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_shifts_status ON shifts (status);
CREATE INDEX idx_shifts_opened_at ON shifts (opened_at);

CREATE TABLE cash_movements (
  id TEXT PRIMARY KEY,
  shift_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('CASH_IN', 'CASH_OUT')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL,
  cashier_name TEXT NOT NULL,
  occurred_at INTEGER NOT NULL
);
CREATE INDEX idx_cash_movements_shift ON cash_movements (shift_id);
CREATE INDEX idx_cash_movements_occurred ON cash_movements (occurred_at);

-- Free-form key/value settings (ported from Laravel `settings`).
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

-- Server-managed staff roster. No credentials are seeded: the first admin is
-- created through the one-time, secret-gated POST /api/setup/bootstrap.
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'kasir', 'pelayan', 'dapur', 'manajer')),
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT 'bg-accent text-white',
  initials TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL, -- pbkdf2$sha256$<iterations>$<salt b64>$<hash b64>
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Server-side sessions. Only the SHA-256 of the session id is stored.
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_staff ON sessions (staff_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- Failed-login throttling (per username and per client IP).
CREATE TABLE auth_throttle (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

-- Small system flags. `setup_complete` is inserted exactly once by the
-- bootstrap endpoint; the primary key makes that insert atomic.
CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
