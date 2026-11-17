-- UAT catalog: three floors, tracked / untracked / sold-out ready stock.
INSERT INTO categories (id, name, kind, sort_order, created_at) VALUES
  ('cat-makan', 'Makanan', 'Makanan', 1, 0),
  ('cat-minum', 'Minuman', 'Minuman', 2, 0);
INSERT INTO products (id, barcode, name, price, category_id, kind, stock, created_at, updated_at) VALUES
  ('p-nasgor', 'UAT-NASGOR', 'Nasi Goreng WakRo', 25000, 'cat-makan', 'Makanan', NULL, 0, 0),
  ('p-esteh', 'UAT-ESTEH', 'Es Teh Manis', 5000, 'cat-minum', 'Minuman', NULL, 0, 0),
  ('p-mieayam', 'UAT-MIEAYAM', 'Mie Ayam', 18000, 'cat-makan', 'Makanan', 50, 0, 0),
  ('p-geprek', 'UAT-GEPREK', 'Ayam Geprek', 20000, 'cat-makan', 'Makanan', 6, 0, 0),
  ('p-tahu', 'UAT-TAHU', 'Tahu Isi', 3000, 'cat-makan', 'Makanan', 6, 0, 0),
  ('p-pisang', 'UAT-PISANG', 'Pisang Goreng', 4000, 'cat-makan', 'Makanan', 1, 0, 0),
  ('p-kerupuk', 'UAT-KERUPUK', 'Kerupuk', 2000, 'cat-makan', 'Makanan', 0, 0, 0);
INSERT INTO restaurant_tables (id, name, seats, area, active, created_at, updated_at) VALUES
  ('l1-m1', 'Meja 1', 4, 'Lantai 1', 1, 0, 0),
  ('l1-m2', 'Meja 2', 4, 'Lantai 1', 1, 0, 0),
  ('l1-m3', 'Meja 3', 4, 'Lantai 1', 1, 0, 0),
  ('l2-m4', 'Meja 4', 4, 'Lantai 2', 1, 0, 0),
  ('l2-m5', 'Meja 5', 4, 'Lantai 2', 1, 0, 0),
  ('l2-m6', 'Meja 6', 4, 'Lantai 2', 1, 0, 0),
  ('rt-m7', 'Meja 7', 4, 'Rooftop', 1, 0, 0),
  ('rt-m8', 'Meja 8', 4, 'Rooftop', 1, 0, 0),
  ('rt-m9', 'Meja 9', 4, 'Rooftop', 1, 0, 0),
  ('rt-m10', 'Meja 10', 4, 'Rooftop', 1, 0, 0),
  ('rt-m11', 'Meja 11', 4, 'Rooftop', 1, 0, 0),
  ('rt-m12', 'Meja 12', 4, 'Rooftop', 1, 0, 0),
  -- Reserved per case so occupancy checks start from an empty table.
  ('l1-m13', 'Meja 13', 4, 'Lantai 1', 1, 0, 0),
  ('l2-m14', 'Meja 14', 4, 'Lantai 2', 1, 0, 0),
  ('l2-m15', 'Meja 15', 4, 'Lantai 2', 1, 0, 0),
  ('rt-m16', 'Meja 16', 4, 'Rooftop', 1, 0, 0),
  ('rt-m17', 'Meja 17', 4, 'Rooftop', 1, 0, 0),
  ('l1-m18', 'Meja 18', 4, 'Lantai 1', 1, 0, 0),
  ('l1-m19', 'Meja 19', 4, 'Lantai 1', 1, 0, 0),
  ('l2-m21', 'Meja 21', 4, 'Lantai 2', 1, 0, 0),
  ('rt-m22', 'Meja 22', 4, 'Rooftop', 1, 0, 0),
  ('l1-m23', 'Meja 23', 4, 'Lantai 1', 1, 0, 0),
  ('l2-m24', 'Meja 24', 4, 'Lantai 2', 1, 0, 0),
  ('rt-m25', 'Meja 25', 4, 'Rooftop', 1, 0, 0),
  ('l1-m26', 'Meja 26', 4, 'Lantai 1', 1, 0, 0),
  ('l2-m27', 'Meja 27', 4, 'Lantai 2', 1, 0, 0),
  ('rt-m28', 'Meja 28', 4, 'Rooftop', 1, 0, 0),
  ('l1-m29', 'Meja 29', 4, 'Lantai 1', 1, 0, 0),
  ('l2-m30', 'Meja 30', 4, 'Lantai 2', 1, 0, 0);
