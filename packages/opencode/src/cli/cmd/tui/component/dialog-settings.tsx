import { createMemo } from "solid-js"
import { useSync } from "@tui/context/sync"
import { useDialog } from "@tui/ui/dialog"
import { DialogSelect } from "@tui/ui/dialog-select"
import { Config } from "@/config/config"
import { useToast } from "@tui/ui/toast"
import { pipe, flatMap, entries, filter, sortBy, map } from "remeda"
import { produce } from "solid-js/store"

type ModelOption = {
  type: "model"
  key: string
  title: string
  value: string | undefined
}

type ToggleOption = {
  type: "toggle"
  key: string
  title: string
  value: boolean
}

type SettingsOption = ModelOption | ToggleOption

export function DialogSettings() {
  const sync = useSync()
  const dialog = useDialog()
  const toast = useToast()

  const config = createMemo(() => sync.data.config as any)

  const options = createMemo((): SettingsOption[] => [
    {
      type: "toggle",
      key: "auto_switch_models",
      title: "Auto-Switch Modes",
      value: config().auto_switch_models !== false,
    },
    {
      type: "model",
      key: "build_model",
      title: "Build Mode",
      value: config().build_model,
    },
    {
      type: "model",
      key: "plan_model",
      title: "Plan Mode",
      value: config().plan_model,
    },
    {
      type: "model",
      key: "docs_model",
      title: "Docs Mode",
      value: config().docs_model,
    },
  ])

  // Directly update the sync store config - bypasses server cache issues
  const updateConfigValue = (key: string, value: any) => {
    sync.set(
      produce((draft: any) => {
        draft.config[key] = value
      })
    )
  }

  const handleModelSelect = async (option: ModelOption) => {
    dialog.replace(() => (
      <DialogModelSelector
        title={`Select ${option.title}`}
        currentValue={option.value as string | undefined}
        onSelect={async (model) => {
          try {
            await Config.updateGlobal({ [option.key]: model || undefined })
            updateConfigValue(option.key, model || undefined)
            toast.show({
              variant: "success",
              message: model ? `${option.title} set to ${model}` : `${option.title} cleared`,
              duration: 2000,
            })
            dialog.clear()
          } catch (err: any) {
            console.error("Config update error:", err)
            toast.show({
              variant: "error",
              message: `Failed to update ${option.title}: ${err?.message || "Unknown error"}`,
              duration: 5000,
            })
          }
        }}
      />
    ))
  }

  const handleToggle = async (option: ToggleOption) => {
    const newValue = !option.value
    try {
      await Config.updateGlobal({ [option.key]: newValue })
      updateConfigValue(option.key, newValue)
      toast.show({
        variant: "success",
        message: `${option.title} ${newValue ? "enabled" : "disabled"}`,
        duration: 2000,
      })
    } catch (err: any) {
      console.error("Config update error:", err)
      toast.show({
        variant: "error",
        message: `Failed to update ${option.title}: ${err?.message || "Unknown error"}`,
        duration: 5000,
      })
    }
  }

  const formatValue = (option: SettingsOption) => {
    if (option.type === "toggle") {
      return option.value ? "Enabled" : "Disabled"
    }
    if (option.value) {
      return option.value as string
    }
    return "Not configured"
  }

  // Set dialog to large size
  dialog.setSize("large")
  
  return (
    <DialogSelect
      title="Mode Settings"
      options={options().map((option) => ({
        value: option,
        title: option.title,
        footer: formatValue(option),
        onSelect: () => option.type === "toggle" ? handleToggle(option) : handleModelSelect(option),
      }))}
    />
  )
}

function DialogModelSelector(props: {
  title: string
  currentValue: string | undefined
  onSelect: (model: string) => void
}) {
  const sync = useSync()
  const dialog = useDialog()

  // Set dialog to large size
  dialog.setSize("large")

  const options = createMemo(() => {
    return [
      // Add "Clear" option
      {
        value: "",
        title: "Clear (use main model)",
        onSelect: () => {
          props.onSelect("")
        },
      },
      // Add all available models
      ...pipe(
        sync.data.provider,
        sortBy(
          (provider) => provider.id !== "cerebras",
          (provider) => provider.id !== "anthropic",
          (provider) => provider.name,
        ),
        flatMap((provider) =>
          pipe(
            provider.models,
            entries(),
            filter(([_, info]) => info.status !== "deprecated"),
            map(([modelId, info]) => {
              const fullModel = `${provider.id}/${modelId}`
              return {
                value: fullModel,
                title: info.name ?? modelId,
                category: provider.name,
                footer: props.currentValue === fullModel ? "Current" : undefined,
                onSelect: () => {
                  props.onSelect(fullModel)
                },
              }
            }),
            sortBy((x) => x.title),
          ),
        ),
      ),
    ]
  })

  return (
    <DialogSelect
      title={props.title}
      current={props.currentValue}
      options={options()}
    />
  )
}
