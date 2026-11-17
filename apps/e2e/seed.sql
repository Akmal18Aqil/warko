-- Deterministic catalog for end-to-end tests (applied after migrations to an empty local D1).
INSERT INTO categories (id, name, kind, sort_order, created_at) VALUES ('cat-e2e', 'Makanan', 'Makanan', 1, 0);
INSERT INTO products (id, barcode, name, price, category_id, kind, stock, created_at, updated_at)
  VALUES ('p-nasi', 'E2E-NASI', 'Nasi Goreng Uji', 30000, 'cat-e2e', 'Makanan', NULL, 0, 0),
         ('p-teh', 'E2E-TEH', 'Es Teh Uji', 10000, 'cat-e2e', 'Makanan', 20, 0, 0);
INSERT INTO restaurant_tables (id, name, seats, area, active, created_at, updated_at)
  VALUES ('meja-e2e', 'Meja Uji', 4, 'Lantai 1', 1, 0, 0);
