-- WAKRO Digital: ready-stock inventory, stable table identity, idempotent orders,
-- customer order tracking and cashier settlement of existing orders.

-- Ready-to-sell stock per product. NULL = not tracked (unlimited); 0 = sold out.
-- The CHECK makes an oversell abort the whole order batch (atomic rollback).
ALTER TABLE products ADD COLUMN stock INTEGER CHECK (stock IS NULL OR stock >= 0);

-- Stable table reference (floor/area lives on restaurant_tables.area).
ALTER TABLE orders ADD COLUMN table_id TEXT;
-- SHA-256 of a client-generated random key. It makes submits idempotent (a retry returns the first
-- order instead of a duplicate) and, for self-orders, is the customer's secret for status/e-receipt.
ALTER TABLE orders ADD COLUMN client_ref TEXT;
-- Cashier settlement details.
ALTER TABLE orders ADD COLUMN cash_received INTEGER CHECK (cash_received IS NULL OR cash_received >= 0);
ALTER TABLE orders ADD COLUMN paid_by TEXT;
-- Payment gateway reference (e.g. Midtrans transaction id) once a gateway confirms payment.
ALTER TABLE orders ADD COLUMN payment_ref TEXT;

CREATE UNIQUE INDEX idx_orders_client_ref ON orders (client_ref) WHERE client_ref IS NOT NULL;
CREATE INDEX idx_orders_table_id ON orders (table_id);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);

-- Backfill table_id for existing table orders whose name still matches a table.
UPDATE orders
   SET table_id = (SELECT t.id FROM restaurant_tables t WHERE t.name = orders.table_name LIMIT 1)
 WHERE order_type = 'meja' AND table_id IS NULL AND table_name IS NOT NULL;

-- Stock movement log: every sale, adjustment and restock, for owner audit.
CREATE TABLE stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  stock_after INTEGER,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'adjust', 'restock', 'void')),
  order_no INTEGER,
  staff_name TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_stock_movements_product ON stock_movements (product_id, created_at);
