-- Telemetry database schema for Cloudflare D1
-- Run: wrangler d1 execute opencode-telemetry --file=./telemetry-schema.sql

-- Main telemetry logs table
CREATE TABLE IF NOT EXISTS telemetry_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Identifiers
  session_id TEXT,
  provider_id TEXT,
  model_id TEXT,
  
  -- Per-step token metrics
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  total_prompt_tokens INTEGER DEFAULT 0,
  
  -- Per-step cache metrics
  cache_hit_rate REAL DEFAULT 0,
  
  -- Session-level cumulative totals (like sidebar displays)
  session_total_cached_tokens INTEGER DEFAULT 0,
  session_total_prompt_tokens INTEGER DEFAULT 0,
  session_total_output_tokens INTEGER DEFAULT 0,
  session_overall_hit_rate REAL DEFAULT 0,
  
  -- Session context
  conversation_turns INTEGER DEFAULT 0,
  finish_reason TEXT,
  
  -- Timestamp
  timestamp INTEGER NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_provider ON telemetry_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_model ON telemetry_logs(provider_id, model_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_logs(session_id);

-- Daily aggregates table for faster historical queries
CREATE TABLE IF NOT EXISTS telemetry_daily_aggregates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Date bucket (start of day in ms)
  day_bucket INTEGER NOT NULL,
  
  -- Provider/Model (NULL for overall daily stats)
  provider_id TEXT,
  model_id TEXT,
  
  -- Aggregate metrics
  request_count INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_reasoning_tokens INTEGER DEFAULT 0,
  total_cached_tokens INTEGER DEFAULT 0,
  total_prompt_tokens INTEGER DEFAULT 0,
  
  -- Averages
  avg_cache_hit_rate REAL DEFAULT 0,
  avg_conversation_turns REAL DEFAULT 0,
  
  -- Unique counts
  unique_sessions INTEGER DEFAULT 0,
  
  UNIQUE(day_bucket, provider_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_agg_day ON telemetry_daily_aggregates(day_bucket);
CREATE INDEX IF NOT EXISTS idx_daily_agg_provider ON telemetry_daily_aggregates(provider_id);

