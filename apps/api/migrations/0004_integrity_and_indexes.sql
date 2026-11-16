-- WAKRO Digital: referential integrity, soft-deleted cash movements, duplicate-payment charges and
-- indexes that match the queries the API actually runs.

-- ---- cash movements: soft delete ------------------------------------------
ALTER TABLE cash_movements ADD COLUMN deleted_at INTEGER;
DROP INDEX idx_cash_movements_occurred;
CREATE INDEX idx_cash_movements_live ON cash_movements (occurred_at) WHERE deleted_at IS NULL;

-- ---- products reference categories by id ------------------------------------
-- Categories that products still reference by name but that have no row yet get one first.
INSERT INTO categories (id, name, kind, color, sort_order, is_default, created_at)
SELECT lower(hex(randomblob(16))), p.category, MIN(p.kind), NULL,
       (SELECT COALESCE(MAX(sort_order), 0) FROM categories) + 1, 0, CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM products p
 WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.name = p.category COLLATE NOCASE)
 GROUP BY p.category COLLATE NOCASE;

ALTER TABLE products ADD COLUMN category_id TEXT REFERENCES categories (id);
UPDATE products
   SET category_id = (SELECT c.id FROM categories c WHERE c.name = products.category COLLATE NOCASE LIMIT 1);

CREATE UNIQUE INDEX idx_categories_name_nocase ON categories (name COLLATE NOCASE);
CREATE INDEX idx_products_category_id ON products (category_id);
DROP INDEX idx_products_category;
ALTER TABLE products DROP COLUMN category;
-- Low selectivity (almost every row is active); never narrows a query.
DROP INDEX idx_products_active;

-- ---- order indexes -----------------------------------------------------------
-- removeProduct checks whether order history still references a product.
CREATE INDEX idx_order_items_product ON order_items (product_id);
-- The legacy status column is never filtered on.
DROP INDEX idx_orders_status;
-- Open-order lookups: the operational list ORs created_at / paid_at with open payment or kitchen
-- status; SQLite only uses a MULTI-INDEX OR when every branch has its own plain index
-- (partial indexes are not considered for OR branches). `payment_status` is already indexed.
CREATE INDEX idx_orders_kitchen_status ON orders (kitchen_status);

-- ---- payment charges: money captured for an order that was already settled ---------
-- CHECK constraints cannot be altered in place, so the table is rebuilt (nothing references it).
CREATE TABLE payment_charges_new (
  gateway_order_id TEXT PRIMARY KEY,
  order_no INTEGER NOT NULL REFERENCES orders (no) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  qr_string TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'paid_duplicate', 'expired', 'failed')),
  transaction_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO payment_charges_new SELECT * FROM payment_charges;
DROP TABLE payment_charges;
ALTER TABLE payment_charges_new RENAME TO payment_charges;
CREATE INDEX idx_payment_charges_order ON payment_charges (order_no, created_at);
