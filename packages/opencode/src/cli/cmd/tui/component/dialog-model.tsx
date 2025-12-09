import { createMemo } from "solid-js"
import { Dialog } from "@tui/ui/dialog"

// Legacy hook consumer shim: always "connected" since we only support Cerebras.
export function useConnected() {
  return () => true
}

// Simple informational dialog for the fixed model.
export function DialogModel() {
  const provider = createMemo(() => "Cerebras")
  const model = createMemo(() => "GLM 4.6")

  return (
    <Dialog title="Model">
      <box padding={1} flexDirection="column" gap={1}>
        <text>Cerebras Code is configured to use a single provider/model.</text>
        <text>
          Provider: {provider()} • Model: {model()}
        </text>
      </box>
    </Dialog>
  )
}
