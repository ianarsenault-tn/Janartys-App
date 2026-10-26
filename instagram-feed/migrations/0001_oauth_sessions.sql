-- One short-lived browser authorization attempt per approved staff member.
CREATE TABLE oauth_sessions (
  staff_id TEXT PRIMARY KEY,
  ticket_hash TEXT NOT NULL UNIQUE,
  cookie_hash TEXT,
  expires_at INTEGER NOT NULL
);
