import { Log } from "@/util/log"
import { Global } from "@/global"
import path from "path"

const log = Log.create({ service: "notification" })

const NOTIFICATION_ENDPOINT = "https://cerebras-code-cli-notifs.kevin-taylor-d8d.workers.dev"
const SEEN_KEY = "notification.seen"

export interface Notification {
  id: string
  type: "info" | "warning" | "critical"
  title: string
  message: string
  display: "toast" | "fullscreen" | "banner"
  expires?: string
}

// Simple KV storage for notifications (outside TUI context)
async function getKV(): Promise<Record<string, any>> {
  try {
    const file = Bun.file(path.join(Global.Path.state, "kv.json"))
    return await file.json()
  } catch {
    return {}
  }
}

async function setKV(key: string, value: any): Promise<void> {
  const kv = await getKV()
  kv[key] = value
  await Bun.write(path.join(Global.Path.state, "kv.json"), JSON.stringify(kv, null, 2))
}

export namespace Notification {
  /**
   * Fetch the current notification from the server.
   * Returns null if no notification or already seen.
   */
  export async function check(): Promise<Notification | null> {
    try {
      const res = await fetch(NOTIFICATION_ENDPOINT, {
        signal: AbortSignal.timeout(3000), // 3s timeout
      })

      if (!res.ok) {
        log.debug("notification fetch failed", { status: res.status })
        return null
      }

      const notification = (await res.json()) as Notification | null
      if (!notification) return null

      // Check if expired
      if (notification.expires) {
        const expiresAt = new Date(notification.expires)
        if (expiresAt < new Date()) {
          log.debug("notification expired", { id: notification.id })
          return null
        }
      }

      // Check if already seen
      const seen = await getSeenIds()
      if (seen.includes(notification.id)) {
        log.debug("notification already seen", { id: notification.id })
        return null
      }

      return notification
    } catch (e) {
      log.debug("notification check error", { error: e })
      return null
    }
  }

  /**
   * Mark a notification as seen so it won't show again.
   */
  export async function markSeen(id: string): Promise<void> {
    const seen = await getSeenIds()
    if (!seen.includes(id)) {
      seen.push(id)
      const trimmed = seen.slice(-50)
      await setKV(SEEN_KEY, trimmed)
    }
  }

  async function getSeenIds(): Promise<string[]> {
    const kv = await getKV()
    const raw = kv[SEEN_KEY]
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    try {
      return JSON.parse(raw) as string[]
    } catch {
      return []
    }
  }
}

