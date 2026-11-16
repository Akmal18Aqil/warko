ALTER TABLE orders ADD COLUMN cash_shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL;

UPDATE orders
SET cash_shift_id = (
  SELECT id FROM shifts
  WHERE opened_at <= orders.paid_at
    AND (closed_at IS NULL OR orders.paid_at <= closed_at)
  ORDER BY opened_at DESC, id DESC
  LIMIT 1
)
WHERE payment_status = 'paid' AND method = 'tunai' AND paid_at IS NOT NULL;

CREATE INDEX idx_orders_cash_shift ON orders(cash_shift_id) WHERE cash_shift_id IS NOT NULL;
