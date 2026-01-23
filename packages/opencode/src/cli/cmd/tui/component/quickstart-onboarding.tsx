import { createSignal, onMount, For } from "solid-js"
import { useTheme } from "../context/theme"
import { TextAttributes } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useKV } from "../context/kv"

const STARTER_PROMPTS = [
  { prompt: "Make a snake game", icon: "🎮" },
  { prompt: "Organize my downloads folder", icon: "📁" },
  { prompt: "Do research on recent AI news", icon: "📰" },
] as const

export function QuickStartOnboarding(props: { onSelect: (prompt: string) => void; onSkip: () => void }) {
  const { theme } = useTheme()
  const kv = useKV()
  const dimensions = useTerminalDimensions()
  const [selected, setSelected] = createSignal(0)
  const [ready, setReady] = createSignal(false)

  onMount(() => {
    setTimeout(() => setReady(true), 300)
  })

  const markSeen = () => {
    kv.set("hasSeenQuickStart", true)
  }

  const selectPrompt = (prompt: string) => {
    markSeen()
    props.onSelect(prompt)
  }

  const skip = () => {
    markSeen()
    props.onSkip()
  }

  useKeyboard((evt) => {
    // Always prevent arrow keys from bubbling
    if (evt.name === "up" || evt.name === "down") {
      evt.preventDefault?.()
    }

    if (!ready()) return

    if (evt.name === "up") {
      setSelected((s) => (s > 0 ? s - 1 : STARTER_PROMPTS.length - 1))
    } else if (evt.name === "down") {
      setSelected((s) => (s < STARTER_PROMPTS.length - 1 ? s + 1 : 0))
    } else if (evt.name === "return") {
      evt.preventDefault?.()
      selectPrompt(STARTER_PROMPTS[selected()].prompt)
    } else if (evt.name === "escape") {
      evt.preventDefault?.()
      skip()
    }
  })

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={theme.background}
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
    >
      <box
        width={Math.min(55, dimensions().width - 4)}
        backgroundColor={theme.backgroundPanel}
        paddingTop={2}
        paddingBottom={2}
        paddingLeft={3}
        paddingRight={3}
        gap={1}
      >
        <box gap={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            ◆ Quick Start
          </text>
          <text fg={theme.text}>
            Try one of these prompts to get started:
          </text>
          <box marginTop={1} gap={0}>
            <For each={STARTER_PROMPTS}>
              {(item, index) => {
                const isSelected = () => selected() === index()
                return (
                  <box
                    flexDirection="row"
                    backgroundColor={isSelected() ? theme.primary : undefined}
                    paddingLeft={1}
                    paddingRight={1}
                  >
                    <text fg={isSelected() ? theme.backgroundPanel : theme.text}>
                      {isSelected() ? "▸ " : "  "}{item.icon} {item.prompt}
                    </text>
                  </box>
                )
              }}
            </For>
          </box>
          <box marginTop={2}>
            <text fg={theme.textMuted}>
              ↑↓ navigate • enter select • esc skip
            </text>
          </box>
        </box>
      </box>
    </box>
  )
}

