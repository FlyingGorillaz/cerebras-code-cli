import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog, type DialogContext } from "../ui/dialog"
import { useKeyboard } from "@opentui/solid"
import { createSignal, onMount, Show } from "solid-js"
import open from "open"

const PAYGO_SIGNUP_URL = "https://cloud.cerebras.ai"

export interface DialogRateLimitProps {
  /** If true, shows the "don't show again" option */
  showDontShowAgain?: boolean
  /** Called when user clicks "don't show again" */
  onDismissForever?: () => void
}

export function DialogRateLimit(props: DialogRateLimitProps = {}) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const [focused, setFocused] = createSignal<"signup" | "dismiss" | "never">("signup")

  const focusOptions = () => {
    const options: ("signup" | "dismiss" | "never")[] = ["signup", "dismiss"]
    if (props.showDontShowAgain) options.push("never")
    return options
  }

  const cycleFocus = (direction: 1 | -1) => {
    const options = focusOptions()
    const currentIndex = options.indexOf(focused())
    const nextIndex = (currentIndex + direction + options.length) % options.length
    setFocused(options[nextIndex])
  }

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      dialog.clear()
    }
    if (evt.name === "tab" || evt.name === "right") {
      evt.preventDefault?.()
      cycleFocus(1)
    }
    if (evt.name === "left") {
      evt.preventDefault?.()
      cycleFocus(-1)
    }
    if (evt.name === "return") {
      if (focused() === "signup") {
        handleSignup()
      } else if (focused() === "never") {
        handleDismissForever()
      } else {
        dialog.clear()
      }
    }
  })

  onMount(() => {
    dialog.setSize("large")
  })

  const handleSignup = async () => {
    await open(PAYGO_SIGNUP_URL)
    dialog.clear()
  }

  const handleDismissForever = () => {
    props.onDismissForever?.()
    dialog.clear()
  }

  return (
    <box paddingLeft={3} paddingRight={3} paddingTop={1} paddingBottom={2} gap={1}>
      {/* Header with playful icon */}
      <box alignItems="center" gap={1}>
        <text attributes={TextAttributes.BOLD} fg={theme.warning}>
          ⚡ Whoa there, speed demon! ⚡
        </text>
      </box>

      {/* Main message - playful and self-aware */}
      <box gap={1} paddingTop={1}>
        <text fg={theme.text} wrapMode="word">
          So here's the thing... Cerebras is <b>really</b> fast.
        </text>
      </box>

      {/* Explanation */}
      <box gap={1} paddingTop={1}>
        <text fg={theme.text} wrapMode="word">
          Our free tier is actually pretty generous! But when you're 
          coding at the speed of thought, tokens burn <i>quickly</i>.
        </text>
        
      </box>

      {/* CTA */}
      <box gap={1} paddingTop={1}>
        <text fg={theme.text} wrapMode="word">
          <b>Want no interuptions?</b>
        </text>
        <text fg={theme.textMuted} wrapMode="word">
          Our pay-as-you-go plan removes rate limits so you can 
          keep that flow state going.
        </text>
      </box>

      {/* Buttons */}
      <box flexDirection="row" gap={2} justifyContent="center" paddingTop={2}>
        <box
          paddingLeft={3}
          paddingRight={3}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={focused() === "signup" ? theme.primary : theme.backgroundElement}
          onMouseUp={handleSignup}
          onMouseOver={() => setFocused("signup")}
        >
          <text fg={focused() === "signup" ? theme.selectedListItemText : theme.text}>
            Fill 'er up (Sign up)
          </text>
        </box>
        <box
          paddingLeft={3}
          paddingRight={3}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={focused() === "dismiss" ? theme.backgroundElement : theme.background}
          onMouseUp={() => dialog.clear()}
          onMouseOver={() => setFocused("dismiss")}
        >
          <text fg={theme.textMuted}>
            I'm good for now
          </text>
        </box>
      </box>

      {/* Don't show again option - only when auto-triggered */}
      <Show when={props.showDontShowAgain}>
        <box alignItems="center" paddingTop={1}>
          <box
            paddingLeft={2}
            paddingRight={2}
            onMouseUp={handleDismissForever}
            onMouseOver={() => setFocused("never")}
          >
            <text fg={focused() === "never" ? theme.text : theme.textMuted}>
              {focused() === "never" ? "▸ " : "  "}Don't show this again
            </text>
          </box>
        </box>
      </Show>

      {/* Footer hint */}
      <box alignItems="center" paddingTop={1}>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>tab</span> to switch · <span style={{ fg: theme.text }}>enter</span> to select · <span style={{ fg: theme.text }}>esc</span> to close
        </text>
      </box>
    </box>
  )
}

// Static method to show the dialog manually (from sidebar) - no "don't show again" option
DialogRateLimit.show = (dialog: DialogContext) => {
  dialog.replace(() => <DialogRateLimit />)
}

// Static method to show the dialog automatically (on rate limit) - with "don't show again" option
DialogRateLimit.showAuto = (dialog: DialogContext, onDismissForever: () => void) => {
  dialog.replace(() => (
    <DialogRateLimit 
      showDontShowAgain={true} 
      onDismissForever={onDismissForever} 
    />
  ))
}
