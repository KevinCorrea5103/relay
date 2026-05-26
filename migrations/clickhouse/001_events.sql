-- ClickHouse schema for run_events.
--
-- Applied separately from Postgres migrations (different system). Idempotent.
-- The control plane writes here in addition to Postgres while
-- DUAL_WRITE_EVENTS=on; once verified, reads switch over and Postgres
-- run_events is dropped.

CREATE TABLE IF NOT EXISTS run_events (
    tenant_id   String,
    run_id      String,
    seq         UInt32,
    event_type  LowCardinality(String),
    payload     String,       -- JSON-encoded
    ts          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree
PARTITION BY (tenant_id, toYYYYMM(ts))
ORDER BY (tenant_id, run_id, seq)
TTL toDateTime(ts) + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;

-- Helpful skip-indexes for the most common dashboard query patterns.
ALTER TABLE run_events
  ADD INDEX IF NOT EXISTS event_type_idx event_type TYPE bloom_filter GRANULARITY 4;
