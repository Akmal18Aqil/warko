-- QRIS gateway charges (Midtrans Core API). One order may have several charges over time
-- (a new one after the previous QR expired); payment is only recorded from a verified webhook.
CREATE TABLE payment_charges (
  gateway_order_id TEXT PRIMARY KEY,
  order_no INTEGER NOT NULL REFERENCES orders (no) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  qr_string TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
  transaction_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_payment_charges_order ON payment_charges (order_no, created_at);
