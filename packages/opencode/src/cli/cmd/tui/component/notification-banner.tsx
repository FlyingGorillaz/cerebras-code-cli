import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { createSignal, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { Notification } from "@/notification"

export function NotificationBanner(props: { notification: Notification; onDismiss: () => void }) {
  const { theme } = useTheme()
  const [visible, setVisible] = createSignal(true)

  const bgColor = () => {
    switch (props.notification.type) {
      case "critical":
        return theme.error
      case "warning":
        return theme.warning
      default:
        return theme.primary
    }
  }

  const dismiss = () => {
    setVisible(false)
    props.onDismiss()
  }

  useKeyboard((evt) => {
    if (evt.name === "escape" && visible()) {
      dismiss()
    }
  })

  return (
    <Show when={visible()}>
      <box
        width="100%"
        backgroundColor={bgColor()}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={0}
      >
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <text attributes={TextAttributes.BOLD} fg={theme.backgroundPanel}>
            {props.notification.title}
          </text>
          <text fg={theme.backgroundPanel} onMouseUp={dismiss}>
            ✕ esc to dismiss
          </text>
        </box>
        <text fg={theme.backgroundPanel}>{props.notification.message}</text>
      </box>
    </Show>
  )
}

