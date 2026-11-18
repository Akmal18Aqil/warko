-- Registered devices, staff PINs and the security audit log.

-- PIN (6 digits) is stored only as `pin1$pbkdf2$sha256$<iterations>$<salt b64>$<hash b64>`;
-- the PBKDF2 input is an HMAC of the PIN keyed with a server-side pepper (see src/pin.ts).
ALTER TABLE staff ADD COLUMN pin_hash TEXT;
ALTER TABLE staff ADD COLUMN pin_set_at INTEGER;

-- A browser that an admin has registered. Only the hash of the random device token is stored;
-- the token itself lives in an HttpOnly cookie on that browser. `created_by` is deliberately not
-- a foreign key: deleting an admin must not delete or block the device history.
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER,
  revoked_by TEXT
);

-- How a session was obtained. Sessions that exist before this migration were password logins.
-- PIN sessions are bound to the device they came from and die when that device is revoked.
ALTER TABLE sessions ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'password' CHECK (auth_method IN ('password', 'pin'));
ALTER TABLE sessions ADD COLUMN device_id TEXT REFERENCES devices (id) ON DELETE CASCADE;
CREATE INDEX idx_sessions_device ON sessions (device_id);

-- Security audit trail. Never holds passwords, PINs, tokens or raw IPs: `ip_hash` is a keyed hash
-- and `detail` is a small JSON object of non-secret facts (e.g. which fields changed).
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'blocked')),
  actor_id TEXT,
  actor_name TEXT,
  target_id TEXT,
  device_id TEXT,
  ip_hash TEXT,
  detail TEXT
);
CREATE INDEX idx_audit_log_at ON audit_log (at);
