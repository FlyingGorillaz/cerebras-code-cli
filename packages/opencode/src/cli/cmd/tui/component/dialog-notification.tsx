import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { createSignal, onMount } from "solid-js"
import type { Notification } from "@/notification"

export function FullscreenNotification(props: { notification: Notification; onClose: () => void }) {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const [ready, setReady] = createSignal(false)

  // Wait a moment before accepting key presses to avoid immediate dismiss
  onMount(() => {
    setTimeout(() => setReady(true), 500)
  })

  useKeyboard((evt) => {
    // Any key dismisses (after ready)
    if (ready()) {
      evt.preventDefault?.()
      // @ts-expect-error stopPropagation exists at runtime
      evt.stopPropagation?.()
      // Small delay to prevent key from reaching prompt
      setReady(false)
      setTimeout(() => props.onClose(), 50)
    }
  })

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

  const icon = () => {
    switch (props.notification.type) {
      case "critical":
        return "⚠"
      case "warning":
        return "⚡"
      default:
        return "✦"
    }
  }

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={bgColor()}
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
      gap={2}
    >
      {/* @ts-expect-error fontSize exists at runtime */}
      <text attributes={TextAttributes.BOLD} fg={theme.backgroundPanel} style={{ fontSize: 2 }}>
        {icon()} {props.notification.title}
      </text>
      <box maxWidth={Math.min(80, dimensions().width - 10)} paddingLeft={2} paddingRight={2}>
        {/* @ts-expect-error textAlign exists at runtime */}
        <text fg={theme.backgroundPanel} wrapMode="word" textAlign="center">
          {props.notification.message}
        </text>
      </box>
      <box marginTop={2}>
        <text fg={theme.backgroundPanel} attributes={TextAttributes.DIM}>
          press any key to continue
        </text>
      </box>
    </box>
  )
}
