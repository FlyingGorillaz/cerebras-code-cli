import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import z from "zod"

/**
 * Telemetry module for logging API request metrics to Cloudflare worker
 *
 * Tracks cache hit rates, token usage, conversation turns, and other metrics
 * for monitoring and optimization purposes.
 */
export namespace Telemetry {
  const log = Log.create({ service: "telemetry" })

  // Telemetry endpoint
  const TELEMETRY_ENDPOINT =
    process.env.OPENCODE_TELEMETRY_URL || "https://opencode-telemetry.kevin-taylor-d8d.workers.dev"

  // Batch settings
  const BATCH_SIZE = 10
  const BATCH_INTERVAL_MS = 30_000 // 30 seconds

  // Schema for telemetry entry
  export const Entry = z.object({
    // Identifiers
    sessionID: z.string().optional(),
    providerID: z.string().optional(),
    modelID: z.string().optional(),
    apiKeyHash: z.string().optional(), // Hash of API key for identification

    // Per-step token metrics
    inputTokens: z.number().default(0),
    outputTokens: z.number().default(0),
    reasoningTokens: z.number().default(0),
    cachedTokens: z.number().default(0),

    // Per-step computed metrics
    cacheHitRate: z.number().default(0),

    // Session-level cumulative totals (like sidebar displays)
    sessionTotalCachedTokens: z.number().default(0),
    sessionTotalPromptTokens: z.number().default(0),
    sessionTotalOutputTokens: z.number().default(0),
    sessionOverallHitRate: z.number().default(0),

    // Session context
    conversationTurns: z.number().default(0),

    // Metadata
    finishReason: z.string().optional(),
  })
  export type Entry = z.infer<typeof Entry>

  /**
   * Hash an API key for telemetry (privacy-preserving identifier)
   * Uses last 8 chars + hash to create a unique but non-reversible ID
   */
  export async function hashApiKey(apiKey: string | undefined): Promise<string | undefined> {
    if (!apiKey || apiKey.length < 8) return undefined
    // Take last 4 chars (visible part) + hash of full key
    const suffix = apiKey.slice(-4)
    const hash = Bun.hash(apiKey).toString(16).slice(0, 8)
    return `${hash}_${suffix}`
  }

  // Internal state for batching
  const state = Instance.state(
    () => {
      const queue: Entry[] = []
      let timer: ReturnType<typeof setTimeout> | undefined

      return {
        queue,
        timer,
        enabled: true,
      }
    },
    async (entry) => {
      // Flush remaining entries on shutdown
      if (entry.timer) {
        clearTimeout(entry.timer)
      }
      if (entry.queue.length > 0) {
        await flush(entry.queue)
        entry.queue.length = 0
      }
    },
  )

  /**
   * Check if telemetry is enabled
   */
  export function isEnabled(): boolean {
    return state().enabled
  }

  /**
   * Enable or disable telemetry
   */
  export function setEnabled(enabled: boolean): void {
    state().enabled = enabled
    if (!enabled) {
      // Clear any pending entries
      state().queue.length = 0
      if (state().timer) {
        clearTimeout(state().timer)
        state().timer = undefined
      }
    }
  }

  /**
   * Log a telemetry entry
   *
   * Entries are batched and sent periodically to reduce network overhead.
   */
  export function track(entry: Entry): void {
    const s = state()
    if (!s.enabled) return

    log.info("tracking telemetry", {
      providerID: entry.providerID,
      modelID: entry.modelID,
      cacheHitRate: entry.cacheHitRate,
      cachedTokens: entry.cachedTokens,
      inputTokens: entry.inputTokens,
    })

    s.queue.push(entry)

    // Send immediately if batch is full
    if (s.queue.length >= BATCH_SIZE) {
      const entries = s.queue.splice(0, BATCH_SIZE)
      flush(entries).catch((e) => log.error("flush error", { error: e }))
    }

    // Start batch timer if not already running
    if (!s.timer) {
      s.timer = setTimeout(() => {
        s.timer = undefined
        if (s.queue.length > 0) {
          const entries = s.queue.splice(0)
          flush(entries).catch((e) => log.error("flush error", { error: e }))
        }
      }, BATCH_INTERVAL_MS)
    }
  }

  /**
   * Convenience method to track from session processor data
   */
  export function trackFromUsage(input: {
    sessionID: string
    providerID: string
    modelID: string
    apiKeyHash?: string // Pre-hashed API key identifier
    // Per-step tokens
    tokens: {
      input: number
      output: number
      reasoning: number
      cache: {
        read: number
      }
    }
    conversationTurns: number
    finishReason?: string
    // Session-level cumulative totals
    sessionTotals?: {
      cachedTokens: number
      promptTokens: number
      outputTokens: number
    }
  }): void {
    // Calculate per-step cache hit rate
    const totalPromptTokens = input.tokens.input + input.tokens.cache.read
    const cacheHitRate = totalPromptTokens > 0 ? (input.tokens.cache.read / totalPromptTokens) * 100 : 0

    // Calculate session-level overall hit rate
    const sessionOverallHitRate =
      input.sessionTotals && input.sessionTotals.promptTokens > 0
        ? (input.sessionTotals.cachedTokens / input.sessionTotals.promptTokens) * 100
        : 0

    track({
      sessionID: input.sessionID,
      providerID: input.providerID,
      modelID: input.modelID,
      apiKeyHash: input.apiKeyHash,
      // Per-step metrics
      inputTokens: input.tokens.input,
      outputTokens: input.tokens.output,
      reasoningTokens: input.tokens.reasoning,
      cachedTokens: input.tokens.cache.read,
      cacheHitRate,
      // Session-level cumulative totals
      sessionTotalCachedTokens: input.sessionTotals?.cachedTokens ?? 0,
      sessionTotalPromptTokens: input.sessionTotals?.promptTokens ?? 0,
      sessionTotalOutputTokens: input.sessionTotals?.outputTokens ?? 0,
      sessionOverallHitRate,
      // Context
      conversationTurns: input.conversationTurns,
      finishReason: input.finishReason,
    })
  }

  /**
   * Flush entries to the telemetry endpoint
   */
  async function flush(entries: Entry[]): Promise<void> {
    if (entries.length === 0) return

    log.info("flushing telemetry", { count: entries.length })

    try {
      const enrichedEntries = entries

      const res = await fetch(`${TELEMETRY_ENDPOINT}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: enrichedEntries }),
      })

      if (!res.ok) {
        log.error("telemetry flush failed", { status: res.status })
      }
    } catch (e) {
      // Silently fail - telemetry should not disrupt normal operation
      log.error("telemetry error", { error: e })
    }
  }

  /**
   * Force flush any pending entries immediately
   */
  export async function forceFlush(): Promise<void> {
    const s = state()
    if (s.timer) {
      clearTimeout(s.timer)
      s.timer = undefined
    }
    if (s.queue.length > 0) {
      const entries = s.queue.splice(0)
      await flush(entries)
    }
  }
}

