/**
 * Cloudflare Worker for logging API request telemetry
 * 
 * Uses D1 database for persistent storage of cache hit rates,
 * token usage, and other metrics.
 * 
 * To deploy:
 * 1. Create a D1 database: wrangler d1 create opencode-telemetry
 * 2. Run migrations: wrangler d1 execute opencode-telemetry --file=./telemetry-schema.sql
 * 3. Update wrangler.toml with the database binding
 * 4. Deploy: wrangler deploy cloudflare-worker-telemetry.js
 */

export default {
  async fetch(request, env) {
    // CORS headers for preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      })
    }

    const url = new URL(request.url)
    
    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, timestamp: Date.now() }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    // GET /stats - retrieve aggregated statistics
    if (request.method === "GET" && url.pathname === "/stats") {
      try {
        const timeRange = url.searchParams.get("range") || "24h"
        const stats = await getAggregatedStats(env.DB, timeRange)
        return new Response(JSON.stringify(stats), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        })
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }
    }

    // POST /log - log telemetry data
    if (request.method === "POST" && url.pathname === "/log") {
      try {
        const body = await request.json()
        await logTelemetry(env.DB, body)
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        })
      } catch (e) {
        console.error("Telemetry log error:", e)
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }
    }

    // POST /batch - log multiple telemetry entries at once
    if (request.method === "POST" && url.pathname === "/batch") {
      try {
        const body = await request.json()
        if (!Array.isArray(body.entries)) {
          throw new Error("Expected 'entries' array in body")
        }
        await logTelemetryBatch(env.DB, body.entries)
        return new Response(JSON.stringify({ ok: true, count: body.entries.length }), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        })
      } catch (e) {
        console.error("Telemetry batch error:", e)
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }
    }

    return new Response("Not found", { status: 404 })
  },
}

/**
 * Log a single telemetry entry
 */
async function logTelemetry(db, data) {
  const {
    // Identifiers
    sessionID,
    providerID,
    modelID,
    apiKeyHash,
    
    // Per-step token metrics
    inputTokens = 0,
    outputTokens = 0,
    reasoningTokens = 0,
    cachedTokens = 0,
    
    // Per-step computed metrics
    cacheHitRate = 0,
    
    // Session-level cumulative totals
    sessionTotalCachedTokens = 0,
    sessionTotalPromptTokens = 0,
    sessionTotalOutputTokens = 0,
    sessionOverallHitRate = 0,
    
    // Session context
    conversationTurns = 0,
    finishReason,
  } = data

  // Calculate total prompt tokens for this step (input + cached)
  const totalPromptTokens = inputTokens + cachedTokens

  await db.prepare(`
    INSERT INTO telemetry_logs (
      session_id,
      provider_id,
      model_id,
      api_key_hash,
      input_tokens,
      output_tokens,
      reasoning_tokens,
      cached_tokens,
      total_prompt_tokens,
      cache_hit_rate,
      session_total_cached_tokens,
      session_total_prompt_tokens,
      session_total_output_tokens,
      session_overall_hit_rate,
      conversation_turns,
      finish_reason,
      timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    sessionID || null,
    providerID || null,
    modelID || null,
    apiKeyHash || null,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedTokens,
    totalPromptTokens,
    cacheHitRate,
    sessionTotalCachedTokens,
    sessionTotalPromptTokens,
    sessionTotalOutputTokens,
    sessionOverallHitRate,
    conversationTurns,
    finishReason || null,
    Date.now()
  ).run()
}

/**
 * Log multiple telemetry entries in a batch
 */
async function logTelemetryBatch(db, entries) {
  const stmt = db.prepare(`
    INSERT INTO telemetry_logs (
      session_id,
      provider_id,
      model_id,
      api_key_hash,
      input_tokens,
      output_tokens,
      reasoning_tokens,
      cached_tokens,
      total_prompt_tokens,
      cache_hit_rate,
      session_total_cached_tokens,
      session_total_prompt_tokens,
      session_total_output_tokens,
      session_overall_hit_rate,
      conversation_turns,
      finish_reason,
      timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const batch = entries.map(data => {
    const totalPromptTokens = (data.inputTokens || 0) + (data.cachedTokens || 0)
    return stmt.bind(
      data.sessionID || null,
      data.providerID || null,
      data.modelID || null,
      data.apiKeyHash || null,
      data.inputTokens || 0,
      data.outputTokens || 0,
      data.reasoningTokens || 0,
      data.cachedTokens || 0,
      totalPromptTokens,
      data.cacheHitRate || 0,
      data.sessionTotalCachedTokens || 0,
      data.sessionTotalPromptTokens || 0,
      data.sessionTotalOutputTokens || 0,
      data.sessionOverallHitRate || 0,
      data.conversationTurns || 0,
      data.finishReason || null,
      Date.now()
    )
  })

  await db.batch(batch)
}

/**
 * Get aggregated statistics for a time range
 */
async function getAggregatedStats(db, timeRange) {
  // Parse time range
  const rangeMs = parseTimeRange(timeRange)
  const since = Date.now() - rangeMs

  // Overall statistics
  const overall = await db.prepare(`
    SELECT 
      COUNT(*) as total_requests,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(reasoning_tokens) as total_reasoning_tokens,
      SUM(cached_tokens) as total_cached_tokens,
      SUM(total_prompt_tokens) as total_prompt_tokens,
      AVG(cache_hit_rate) as avg_step_cache_hit_rate,
      AVG(session_overall_hit_rate) as avg_session_hit_rate,
      MAX(session_total_cached_tokens) as max_session_cached_tokens,
      MAX(session_total_prompt_tokens) as max_session_prompt_tokens,
      AVG(conversation_turns) as avg_conversation_turns,
      MAX(conversation_turns) as max_conversation_turns,
      COUNT(DISTINCT session_id) as unique_sessions
    FROM telemetry_logs
    WHERE timestamp >= ?
  `).bind(since).first()

  // Per-provider statistics
  const byProvider = await db.prepare(`
    SELECT 
      provider_id,
      COUNT(*) as request_count,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cached_tokens) as cached_tokens,
      SUM(total_prompt_tokens) as total_prompt_tokens,
      AVG(cache_hit_rate) as avg_cache_hit_rate
    FROM telemetry_logs
    WHERE timestamp >= ? AND provider_id IS NOT NULL
    GROUP BY provider_id
    ORDER BY request_count DESC
  `).bind(since).all()

  // Per-model statistics
  const byModel = await db.prepare(`
    SELECT 
      provider_id,
      model_id,
      COUNT(*) as request_count,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cached_tokens) as cached_tokens,
      AVG(cache_hit_rate) as avg_cache_hit_rate
    FROM telemetry_logs
    WHERE timestamp >= ? AND model_id IS NOT NULL
    GROUP BY provider_id, model_id
    ORDER BY request_count DESC
    LIMIT 20
  `).bind(since).all()

  // Cache hit rate distribution (buckets)
  const cacheDistribution = await db.prepare(`
    SELECT 
      CASE 
        WHEN cache_hit_rate >= 90 THEN '90-100%'
        WHEN cache_hit_rate >= 70 THEN '70-90%'
        WHEN cache_hit_rate >= 50 THEN '50-70%'
        WHEN cache_hit_rate >= 30 THEN '30-50%'
        WHEN cache_hit_rate >= 10 THEN '10-30%'
        ELSE '0-10%'
      END as bucket,
      COUNT(*) as count
    FROM telemetry_logs
    WHERE timestamp >= ?
    GROUP BY bucket
    ORDER BY bucket DESC
  `).bind(since).all()

  // Hourly breakdown (last 24h)
  const hourly = await db.prepare(`
    SELECT 
      (timestamp / 3600000) * 3600000 as hour_bucket,
      COUNT(*) as request_count,
      SUM(cached_tokens) as cached_tokens,
      SUM(total_prompt_tokens) as total_prompt_tokens,
      AVG(cache_hit_rate) as avg_cache_hit_rate
    FROM telemetry_logs
    WHERE timestamp >= ?
    GROUP BY hour_bucket
    ORDER BY hour_bucket ASC
  `).bind(Date.now() - 24 * 60 * 60 * 1000).all()

  return {
    timeRange,
    since: new Date(since).toISOString(),
    overall: overall || {},
    byProvider: byProvider?.results || [],
    byModel: byModel?.results || [],
    cacheDistribution: cacheDistribution?.results || [],
    hourly: hourly?.results || [],
    // Computed overall cache hit rate
    overallCacheHitRate: overall?.total_prompt_tokens > 0 
      ? (overall.total_cached_tokens / overall.total_prompt_tokens) * 100 
      : 0,
  }
}

function parseTimeRange(range) {
  const match = range.match(/^(\d+)(h|d|w|m)$/)
  if (!match) return 24 * 60 * 60 * 1000 // Default 24h
  
  const value = parseInt(match[1], 10)
  const unit = match[2]
  
  switch (unit) {
    case 'h': return value * 60 * 60 * 1000
    case 'd': return value * 24 * 60 * 60 * 1000
    case 'w': return value * 7 * 24 * 60 * 60 * 1000
    case 'm': return value * 30 * 24 * 60 * 60 * 1000
    default: return 24 * 60 * 60 * 1000
  }
}

