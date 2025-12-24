import { TextareaRenderable, TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { createSignal, onMount } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { Installation } from "@/installation"

const FEEDBACK_ENDPOINT = "https://cerebras-code-cli-feedback.kevin-taylor-d8d.workers.dev"

export function DialogFeedback(props: { onClose: () => void }) {
  const dialog = useDialog()
  const { theme } = useTheme()
  let textarea: TextareaRenderable
  const [status, setStatus] = createSignal<"idle" | "sending" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = createSignal("")
  const [focused, setFocused] = createSignal<"textarea" | "button">("textarea")

  // Note: Global keybinds are automatically disabled when dialog.stack.length > 0
  // (see CommandProvider in dialog-command.tsx)

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      props.onClose()
    }
    if (evt.name === "tab") {
      evt.preventDefault?.()
      if (focused() === "textarea") {
        setFocused("button")
        textarea?.blur()
      } else {
        setFocused("textarea")
        textarea?.focus()
      }
    }
    if (evt.name === "return") {
      if (focused() === "button") {
        submit()
      } else {
        // Manually insert newline when textarea is focused
        textarea?.insertText("\n")
      }
    }
  })

  onMount(() => {
    dialog.setSize("medium")
    setTimeout(() => {
      textarea?.focus()
    }, 1)
  })

  const submit = async () => {
    const message = textarea.plainText.trim()
    if (!message) return

    setStatus("sending")
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          version: Installation.VERSION,
          os: process.platform,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      setStatus("success")
      setTimeout(() => props.onClose(), 1500)
    } catch (e) {
      setStatus("error")
      setErrorMsg(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD}>Send Feedback</text>
        <text fg={theme.textMuted}>esc to close</text>
      </box>

      {status() === "idle" || status() === "sending" ? (
        <box gap={1}>
          <text fg={theme.textMuted}>Describe your feedback, bug, or feature request:</text>
          <textarea
            height={5}
            ref={(val: TextareaRenderable) => (textarea = val)}
            placeholder="Your feedback..."
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
          />
          <box paddingBottom={1} flexDirection="row" justifyContent="space-between">
            <text fg={theme.textMuted}>tab to switch focus</text>
            <box
              paddingLeft={2}
              paddingRight={2}
              backgroundColor={focused() === "button" ? theme.primary : theme.backgroundElement}
              onMouseUp={submit}
            >
              <text fg={focused() === "button" ? theme.selectedListItemText : theme.text}>
                {status() === "sending" ? "Sending..." : "Submit"}
              </text>
            </box>
          </box>
        </box>
      ) : status() === "success" ? (
        <box padding={1}>
          <text fg={theme.success}>✓ Feedback sent! Thank you.</text>
        </box>
      ) : (
        <box padding={1} gap={1}>
          <text fg={theme.error}>✗ Failed to send: {errorMsg()}</text>
          <text fg={theme.textMuted}>Please try again or email support directly.</text>
        </box>
      )}
    </box>
  )
}

