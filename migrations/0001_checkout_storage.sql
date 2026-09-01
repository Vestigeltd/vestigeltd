CREATE TABLE IF NOT EXISTS kv_store (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  etag TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (namespace, key)
);
CREATE INDEX IF NOT EXISTS idx_kv_store_updated_at ON kv_store(updated_at);
