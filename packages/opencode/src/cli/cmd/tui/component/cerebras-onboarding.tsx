import { createSignal, createEffect, Show, onMount, For } from "solid-js"
import { useSync } from "@tui/context/sync"
import { useSDK } from "../context/sdk"
import { useTheme } from "../context/theme"
import { TextAttributes, TextareaRenderable } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useKV } from "../context/kv"
import { useLocal } from "../context/local"

const WELCOME_OPTIONS = [
  { id: "setup", label: "Set up Cerebras API key", description: "Connect to the fastest inference" },
  { id: "skip", label: "Skip for now", description: "Configure later" },
] as const

type WelcomeOptionId = typeof WELCOME_OPTIONS[number]["id"]

export function CerebrasOnboarding(props: { onComplete: () => void }) {
  const { theme } = useTheme()
  const sdk = useSDK()
  const sync = useSync()
  const kv = useKV()
  const local = useLocal()
  const dimensions = useTerminalDimensions()
  const [step, setStep] = createSignal<"welcome" | "apikey">("welcome")
  const [selected, setSelected] = createSignal(0)
  const [error, setError] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [ready, setReady] = createSignal(false)
  let textarea: TextareaRenderable

  // Small delay before accepting input to avoid accidental dismiss
  onMount(() => {
    setTimeout(() => setReady(true), 300)
  })

  // Focus textarea when step changes to apikey
  createEffect(() => {
    if (step() === "apikey" && textarea) {
      setTimeout(() => textarea.focus(), 50)
    }
  })

  const markSeen = () => {
    kv.set("hasSeenCerebrasOnboarding", true)
  }

  const complete = () => {
    markSeen()
    props.onComplete()
  }

  const selectOption = (optionId: WelcomeOptionId) => {
    if (optionId === "setup") {
      setStep("apikey")
    } else {
      complete()
    }
  }

  useKeyboard((evt) => {
    // Always prevent arrow keys from bubbling during onboarding
    if (evt.name === "up" || evt.name === "down") {
      evt.preventDefault?.()
    }
    
    if (!ready()) return
    if (loading()) return

    if (step() === "welcome") {
      if (evt.name === "up") {
        setSelected((s) => (s > 0 ? s - 1 : WELCOME_OPTIONS.length - 1))
      } else if (evt.name === "down") {
        setSelected((s) => (s < WELCOME_OPTIONS.length - 1 ? s + 1 : 0))
      } else if (evt.name === "return") {
        evt.preventDefault?.()
        selectOption(WELCOME_OPTIONS[selected()].id)
      } else if (evt.name === "escape") {
        evt.preventDefault?.()
        complete()
      }
    } else if (step() === "apikey") {
      if (evt.name === "escape") {
        evt.preventDefault?.()
        setStep("welcome")
      }
    }
  })

  const handleSubmit = async () => {
    const key = textarea?.plainText?.trim() ?? ""
    if (!key) {
      setError("Please enter your API key")
      return
    }

    setLoading(true)
    setError("")

    try {
      await sdk.client.auth.set({
        providerID: "cerebras",
        auth: {
          type: "api",
          key: key,
        },
      })
      await sdk.client.instance.dispose()
      await sync.bootstrap()
      
      // Set Cerebras as the default model
      local.model.set({ providerID: "cerebras", modelID: "zai-glm-4.7" }, { recent: true })
      
      complete()
    } catch (e) {
      setError("Failed to connect. Please check your API key.")
      setLoading(false)
    }
  }

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
        width={Math.min(60, dimensions().width - 4)}
        backgroundColor={theme.backgroundPanel}
        paddingTop={2}
        paddingBottom={2}
        paddingLeft={3}
        paddingRight={3}
        gap={1}
      >
        <Show when={step() === "welcome"}>
          <box gap={1}>
            <text fg={theme.primary} attributes={TextAttributes.BOLD}>
              ◆ Welcome to Cerebras Code CLI
            </text>
            <text fg={theme.text}>
              The fastest AI coding assistant, powered by Cerebras inference.
            </text>
            <box marginTop={1}>
              <text fg={theme.textMuted}>Get your free API key at:</text>
              <text fg={theme.accent}>https://cloud.cerebras.ai?utm-source=cli</text>
            </box>
            <box marginTop={2} gap={0}>
              <For each={WELCOME_OPTIONS}>
                {(option, index) => {
                  const isSelected = () => selected() === index()
                  return (
                    <box
                      flexDirection="row"
                      backgroundColor={isSelected() ? theme.primary : undefined}
                      paddingLeft={1}
                      paddingRight={1}
                    >
                      <text fg={isSelected() ? theme.backgroundPanel : theme.text}>
                        {isSelected() ? "▸ " : "  "}{option.label}
                        <span style={{ fg: isSelected() ? theme.backgroundPanel : theme.textMuted }}>
                          {" "}— {option.description}
                        </span>
                      </text>
                    </box>
                  )
                }}
              </For>
            </box>
            <box marginTop={1}>
              <text fg={theme.textMuted}>
                ↑↓ navigate • enter select • esc skip
              </text>
            </box>
          </box>
        </Show>

        <Show when={step() === "apikey"}>
          <box gap={1}>
            <box flexDirection="row" justifyContent="space-between">
              <text fg={theme.text} attributes={TextAttributes.BOLD}>
                Enter Cerebras API Key
              </text>
              <text fg={theme.textMuted}>esc to go back</text>
            </box>
            <text fg={theme.textMuted}>
              Paste your API key from cloud.cerebras.ai?utm-source=cli
            </text>
            <box marginTop={1}>
              <textarea
                ref={(r: TextareaRenderable) => (textarea = r)}
                onSubmit={handleSubmit}
                onContentChange={() => setError("")}
                height={1}
                keyBindings={[{ name: "return", action: "submit" }]}
                placeholder="csk-..."
                textColor={theme.text}
                focusedTextColor={theme.text}
                cursorColor={theme.text}
                backgroundColor={theme.backgroundElement}
                focusedBackgroundColor={theme.backgroundElement}
              />
            </box>
            <Show when={error()}>
              <text fg={theme.error}>{error()}</text>
            </Show>
            <Show when={loading()}>
              <text fg={theme.textMuted}>Connecting...</text>
            </Show>
            <box marginTop={1}>
              <text fg={theme.textMuted}>
                Press <span style={{ fg: theme.text }}>enter</span> to connect
              </text>
            </box>
          </box>
        </Show>
      </box>
    </box>
  )
}
