import { TextAttributes } from "@opentui/core"
import { For } from "solid-js"
import { useTheme } from "@tui/context/theme"

// "Cerebras" in block characters
const LOGO_LINE1 = [
  `█▀▀▀ █▀▀▀ █▀▀█ █▀▀▀ █▀▀▄ █▀▀█ █▀▀█ █▀▀▀`,
  `█░░░ █▀▀▀ █▀▀▄ █▀▀▀ █▀▀▄ █▀▀▄ █▀▀█ ▀▀▀█`,
  `▀▀▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀▀▀  ▀  ▀ ▀  ▀ ▀▀▀▀`,
]

// "Code CLI" in block characters (spaced to align with CEREBRAS)
const LOGO_LINE2 = [
  `█▀▀▀  █▀▀█  █▀▀▄  █▀▀▀   █▀▀▀  █░░  ▀█▀`,
  `█░░░  █░░█  █░░█  █▀▀▀   █░░░  █░░  ░█░`,
  `▀▀▀▀  ▀▀▀▀  ▀▀▀   ▀▀▀▀   ▀▀▀▀  ▀▀▀  ▀▀▀`,
]

export function Logo() {
  const { theme } = useTheme()
  return (
    <box>
      <For each={LOGO_LINE1}>
        {(line) => (
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            {line}
          </text>
        )}
      </For>
      <For each={LOGO_LINE2}>
        {(line) => (
          <text fg={theme.textMuted}>{line}</text>
        )}
      </For>
    </box>
  )
}
