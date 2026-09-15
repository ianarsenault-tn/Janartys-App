-- No customer/device records: only short-lived IDs prevent duplicate sends.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved'
);
CREATE INDEX IF NOT EXISTS events_created_at ON events(created_at);
