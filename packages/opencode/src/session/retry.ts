import type { NamedError } from "@opencode-ai/util/error"
import { MessageV2 } from "./message-v2"

export namespace SessionRetry {
  // Hand-tuned backoff schedule (ms): 10s, 10s, 10s, 15s, 15s; after that, stop retrying
  const BACKOFF_SCHEDULE = [10_000, 10_000, 10_000, 15_000, 15_000]
  export const RETRY_MAX_DELAY = 60_000 // absolute cap

  export async function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms)
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout)
          reject(new DOMException("Aborted", "AbortError"))
        },
        { once: true },
      )
    })
  }

  export function delay(attempt: number, error?: MessageV2.APIError) {
    if (attempt > BACKOFF_SCHEDULE.length) {
      return undefined
    }
    const idx = Math.min(attempt - 1, BACKOFF_SCHEDULE.length - 1)
    const baseDelay = BACKOFF_SCHEDULE[idx]

    if (error) {
      const headers = error.data.responseHeaders
      if (headers) {
        const retryAfterMs = headers["retry-after-ms"]
        if (retryAfterMs) {
          const parsedMs = Number.parseFloat(retryAfterMs)
          if (!Number.isNaN(parsedMs)) {
            return Math.min(parsedMs, baseDelay, RETRY_MAX_DELAY)
          }
        }

        const retryAfter = headers["retry-after"]
        if (retryAfter) {
          const parsedSeconds = Number.parseFloat(retryAfter)
          if (!Number.isNaN(parsedSeconds)) {
            // convert seconds to milliseconds
            return Math.min(Math.ceil(parsedSeconds * 1000), baseDelay, RETRY_MAX_DELAY)
          }
          // Try parsing as HTTP date format
          const parsed = Date.parse(retryAfter) - Date.now()
          if (!Number.isNaN(parsed) && parsed > 0) {
            return Math.min(Math.ceil(parsed), baseDelay, RETRY_MAX_DELAY)
          }
        }

        return Math.min(baseDelay, RETRY_MAX_DELAY)
      }
    }

    return baseDelay
  }

  export function retryable(error: ReturnType<NamedError["toObject"]>) {
    if (MessageV2.APIError.isInstance(error)) {
      if (!error.data.isRetryable) return undefined
      return error.data.message.includes("Overloaded") ? "Provider is overloaded" : error.data.message
    }

    if (typeof error.data?.message === "string") {
      try {
        const json = JSON.parse(error.data.message)
        if (json.type === "error" && json.error?.type === "too_many_requests") {
          return "Too Many Requests"
        }
        if (json.code === "Some resource has been exhausted") {
          return "Provider is overloaded"
        }
      } catch {}
    }

    return undefined
  }
}
