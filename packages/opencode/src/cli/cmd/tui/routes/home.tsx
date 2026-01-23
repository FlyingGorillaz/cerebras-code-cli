import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createMemo, createSignal, For, Match, onMount, Show, Switch } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useTerminalDimensions } from "@opentui/solid"
import { Logo } from "../component/logo"
import { Locale } from "@/util/locale"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useDirectory } from "../context/directory"
import { useRoute, useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { Installation } from "@/installation"

// TODO: what is the best way to do this?
let once = false

const STARTER_PROMPTS = [
  "Make a snake game",
  "Organize my downloads",
  "Do research on recent AI news",
]

export function Home() {
  const sync = useSync()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const mcp = createMemo(() => Object.keys(sync.data.mcp).length > 0)
  
  // Responsive prompts: hide at < 60 width, wrap at < 90 width
  const showPrompts = createMemo(() => dimensions().width >= 60 && dimensions().height >= 20)
  const wrapPrompts = createMemo(() => dimensions().width < 90)
  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((x) => x.status === "failed")
  })

  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length
  })

  const Hint = (
    <Show when={connectedMcpCount() > 0}>
      <box flexShrink={0} flexDirection="row" gap={1}>
        <text fg={theme.text}>
          <Switch>
            <Match when={mcpError()}>
              <span style={{ fg: theme.error }}>•</span> mcp errors{" "}
              <span style={{ fg: theme.textMuted }}>ctrl+x s</span>
            </Match>
            <Match when={true}>
              <span style={{ fg: theme.success }}>•</span>{" "}
              {Locale.pluralize(connectedMcpCount(), "{} mcp server", "{} mcp servers")}
            </Match>
          </Switch>
        </text>
      </box>
    </Show>
  )

  let prompt: PromptRef
  const args = useArgs()
  const [hoveredPrompt, setHoveredPrompt] = createSignal<number | null>(null)
  
  onMount(() => {
    if (once) return
    if (route.initialPrompt) {
      prompt.set(route.initialPrompt)
      once = true
    } else if (args.prompt) {
      prompt.set({ input: args.prompt, parts: [] })
      once = true
    }
  })
  const directory = useDirectory()

  const handleStarterClick = (starterPrompt: string) => {
    prompt.set({ input: starterPrompt, parts: [] })
    // Focus the prompt input
    prompt.focus?.()
  }

  return (
    <>
      <box flexGrow={1} justifyContent="center" alignItems="center" paddingLeft={2} paddingRight={2} gap={1}>
        <Logo />
        <box width="100%" maxWidth={75} zIndex={1000} paddingTop={1}>
          <Prompt
            ref={(r) => {
              prompt = r
              promptRef.set(r)
            }}
            hint={Hint}
          />
        </box>
        <Show when={showPrompts()}>
          <box 
            flexDirection={wrapPrompts() ? "column" : "row"} 
            gap={wrapPrompts() ? 0 : 2} 
            justifyContent="center" 
            alignItems="center"
            paddingTop={1}
          >
            <For each={STARTER_PROMPTS}>
              {(prompt, index) => (
                <box
                  onMouseUp={() => handleStarterClick(prompt)}
                  onMouseOver={() => setHoveredPrompt(index())}
                  onMouseOut={() => setHoveredPrompt(null)}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={hoveredPrompt() === index() ? theme.backgroundElement : undefined}
                >
                  <text fg={hoveredPrompt() === index() ? theme.text : theme.textMuted}>
                    {prompt}
                  </text>
                </box>
              )}
            </For>
          </box>
        </Show>
        <Toast />
      </box>
      <box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexDirection="row" flexShrink={0} gap={2}>
        <text fg={theme.textMuted}>{directory()}</text>
        <box gap={1} flexDirection="row" flexShrink={0}>
          <Show when={mcp()}>
            <text fg={theme.text}>
              <Switch>
                <Match when={mcpError()}>
                  <span style={{ fg: theme.error }}>⊙ </span>
                </Match>
                <Match when={true}>
                  <span style={{ fg: theme.success }}>⊙ </span>
                </Match>
              </Switch>
              {connectedMcpCount()} MCP
            </text>
            <text fg={theme.textMuted}>/status</text>
          </Show>
        </box>
        <box flexGrow={1} />
        <box flexShrink={0}>
          <text fg={theme.textMuted}>{Installation.VERSION}</text>
        </box>
      </box>
    </>
  )
}
