import { type Accessor, createMemo, Match, Show, Switch } from "solid-js"
import { useRouteData } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { SplitBorder } from "@tui/component/border"
import type { AssistantMessage, Session } from "@opencode-ai/sdk/v2"
import { useKeybind } from "../../context/keybind"

const Title = (props: { session: Accessor<Session> }) => {
  const { theme } = useTheme()
  return (
    <text fg={theme.text}>
      <span style={{ bold: true }}>#</span> <span style={{ bold: true }}>{props.session().title}</span>
    </text>
  )
}

// Compact cache indicator for header
const CacheIndicator = (props: { messages: Accessor<any[]> }) => {
  const { theme } = useTheme()

  const cacheStats = createMemo(() => {
    const assistants = props.messages().filter((m) => m.role === "assistant") as AssistantMessage[]
    let totalCachedTokens = 0
    let totalPromptTokens = 0
    for (const msg of assistants) {
      const cached = msg.tokens.cache.read
      const total = msg.tokens.input + cached
      totalCachedTokens += cached
      totalPromptTokens += total
    }
    const hitRate = totalPromptTokens > 0 ? (totalCachedTokens / totalPromptTokens) * 100 : 0
    return { hitRate, hasData: totalPromptTokens > 0 }
  })

  const pieIndicator = createMemo(() => {
    const rate = cacheStats().hitRate
    if (rate >= 87.5) return "●"
    if (rate >= 62.5) return "◕"
    if (rate >= 37.5) return "◑"
    if (rate >= 12.5) return "◔"
    return "○"
  })

  const rateColor = createMemo(() => {
    const rate = cacheStats().hitRate
    if (rate >= 70) return theme.success
    if (rate >= 40) return theme.warning
    return theme.error
  })

  return (
    <Show when={cacheStats().hasData}>
      <text fg={theme.textMuted} flexShrink={0}>
        <span style={{ fg: rateColor() }}>{pieIndicator()}</span> {cacheStats().hitRate.toFixed(0)}%
      </text>
    </Show>
  )
}

const ContextInfo = (props: {
  context: Accessor<string | undefined>
  usage: Accessor<{ total: number; min1: number; hour1: number; day1: number }>
  messages: Accessor<any[]>
}) => {
  const { theme } = useTheme()
  return (
    <box flexDirection="row" gap={1} flexShrink={0}>
      <CacheIndicator messages={props.messages} />
      <Show when={props.context()}>
        <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
          • {props.context()} • Req: {props.usage().total} (1m {props.usage().min1} / 1h {props.usage().hour1} / 24h{" "}
          {props.usage().day1})
        </text>
      </Show>
    </box>
  )
}

export function Header() {
  const route = useRouteData("session")
  const sync = useSync()
  const session = createMemo(() => sync.session.get(route.sessionID)!)
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])
  const shareEnabled = createMemo(() => sync.data.config.share !== "disabled")

  const usage = createMemo(() => {
    const now = Date.now()
    const assistants = messages().filter((m) => m.role === "assistant")
    const total = assistants.length
    const countWithin = (ms: number) =>
      assistants.filter((m) => {
        const t = m.time?.completed ?? m.time?.updated ?? m.time?.created ?? 0
        return now - t <= ms
      }).length
    return {
      total,
      min1: countWithin(60_000),
      hour1: countWithin(60 * 60_000),
      day1: countWithin(24 * 60 * 60_000),
    }
  })

  const context = createMemo(() => {
    const last = messages().findLast((x) => x.role === "assistant" && x.tokens.output > 0) as AssistantMessage
    if (!last) return
    const total =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = sync.data.provider.find((x) => x.id === last.providerID)?.models[last.modelID]
    let result = total.toLocaleString()
    if (model?.limit.context) {
      result += "  " + Math.round((total / model.limit.context) * 100) + "%"
    }
    return result
  })

  const { theme } = useTheme()
  const keybind = useKeybind()

  return (
    <box flexShrink={0}>
      <box
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={1}
        {...SplitBorder}
        border={["left"]}
        borderColor={theme.border}
        flexShrink={0}
        backgroundColor={theme.backgroundPanel}
      >
        <Switch>
          <Match when={session()?.parentID}>
            <box flexDirection="row" gap={2}>
              <text fg={theme.text}>
                <b>Subagent session</b>
              </text>
              <text fg={theme.text}>
                Prev <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle_reverse")}</span>
              </text>
              <text fg={theme.text}>
                Next <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle")}</span>
              </text>
              <box flexGrow={1} flexShrink={1} />
              <ContextInfo context={context} usage={usage} messages={messages} />
            </box>
          </Match>
          <Match when={true}>
            <box flexDirection="row" justifyContent="space-between" gap={1}>
              <Title session={session} />
              <ContextInfo context={context} usage={usage} messages={messages} />
            </box>
            <Show when={shareEnabled()}>
              <box flexDirection="row" justifyContent="space-between" gap={1}>
                <box flexGrow={1} flexShrink={1}>
                  <Switch>
                    <Match when={session().share?.url}>
                      <text fg={theme.textMuted} wrapMode="word">
                        {session().share!.url}
                      </text>
                    </Match>
                    <Match when={true}>
                      <text fg={theme.text} wrapMode="word">
                        /share <span style={{ fg: theme.textMuted }}>copy link</span>
                      </text>
                    </Match>
                  </Switch>
                </box>
              </box>
            </Show>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
