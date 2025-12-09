import z from "zod"
import { Log } from "../util/log"
import { Env } from "../env"
import { Instance } from "../project/instance"
import { NamedError } from "@opencode-ai/util/error"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { Auth } from "../auth"
type SDK = any
import path from "path"
import { homedir } from "os"

export namespace Provider {
  const log = Log.create({ service: "provider" })

  async function loadApiKey(): Promise<string | undefined> {
    const envKey = Env.get("CEREBRAS_API_KEY")
    if (envKey) return envKey

    const saved = await Auth.get("cerebras")
    if (saved?.type === "api") return saved.key

    try {
      const credPath = path.join(homedir(), ".cerebras", "credentials")
      const file = Bun.file(credPath)
      if (await file.exists()) {
        const json = await file.json().catch(() => undefined)
        if (json && typeof json.apiKey === "string") {
          return json.apiKey
        }
      }
    } catch (e) {
      log.warn("failed to load Cerebras credentials file", { error: String(e) })
    }
    return undefined
  }

  async function buildCerebrasProvider(): Promise<Info> {
    const apiKey = await loadApiKey()
    return {
      id: "cerebras",
      name: "Cerebras",
      source: "custom",
      env: ["CEREBRAS_API_KEY"],
      key: apiKey ?? undefined,
      options: {
        baseURL: "https://api.cerebras.ai/v1",
      },
      models: {
        "zai-glm-4.6": {
          id: "zai-glm-4.6",
          providerID: "cerebras",
          name: "GLM 4.6",
          api: {
            id: "zai-glm-4.6",
            url: "https://api.cerebras.ai/v1",
            npm: "@ai-sdk/openai-compatible",
          },
          status: "active",
          capabilities: {
            temperature: true,
            reasoning: false,
            attachment: false,
            toolcall: true,
            input: {
              text: true,
              audio: false,
              image: false,
              video: false,
              pdf: false,
            },
            output: {
              text: true,
              audio: false,
              image: false,
              video: false,
              pdf: false,
            },
          },
          cost: {
            input: 0.2, // placeholder
            output: 0.2, // placeholder
            cache: { read: 0, write: 0 },
          },
          limit: {
            context: 131000,
            output: 8192,
          },
          options: {},
          headers: {},
        },
      },
    }
  }

  // Legacy compatibility: server.ts expects this helper.
  export async function fromModelsDevProvider(): Promise<Info> {
    return buildCerebrasProvider()
  }

  export const Model = z
    .object({
      id: z.string(),
      providerID: z.string(),
      api: z.object({
        id: z.string(),
        url: z.string(),
        npm: z.string(),
      }),
      name: z.string(),
      capabilities: z.object({
        temperature: z.boolean(),
        reasoning: z.boolean(),
        attachment: z.boolean(),
        toolcall: z.boolean(),
        input: z.object({
          text: z.boolean(),
          audio: z.boolean(),
          image: z.boolean(),
          video: z.boolean(),
          pdf: z.boolean(),
        }),
        output: z.object({
          text: z.boolean(),
          audio: z.boolean(),
          image: z.boolean(),
          video: z.boolean(),
          pdf: z.boolean(),
        }),
      }),
      cost: z.object({
        input: z.number(),
        output: z.number(),
        cache: z.object({
          read: z.number(),
          write: z.number(),
        }),
        experimentalOver200K: z
          .object({
            input: z.number(),
            output: z.number(),
            cache: z.object({
              read: z.number(),
              write: z.number(),
            }),
          })
          .optional(),
      }),
      limit: z.object({
        context: z.number(),
        output: z.number(),
      }),
      status: z.enum(["alpha", "beta", "deprecated", "active"]),
      options: z.record(z.string(), z.any()),
      headers: z.record(z.string(), z.string()),
    })
    .meta({
      ref: "Model",
    })
  export type Model = z.infer<typeof Model>

  export const Info = z
    .object({
      id: z.string(),
      name: z.string(),
      source: z.enum(["env", "config", "custom", "api"]),
      env: z.string().array(),
      key: z.string().optional(),
      options: z.record(z.string(), z.any()),
      models: z.record(z.string(), Model),
    })
    .meta({
      ref: "Provider",
    })
  export type Info = z.infer<typeof Info>

  const state = Instance.state(async () => {
    using _ = log.time("state")
    
    const providers: Record<string, Info> = {
      cerebras: await buildCerebrasProvider(),
    }

    return {
      models: new Map<string, any>(),
      providers,
      sdk: new Map<number, SDK>(),
      modelLoaders: {},
    }
  })

  export async function list() {
    return state().then((state) => state.providers)
  }

  async function getSDK(model: Model) {
    try {
      using _ = log.time("getSDK", {
        providerID: "cerebras",
      })
      
      const apiKey = await loadApiKey()
      if (!apiKey) {
        throw new InitError({ providerID: "cerebras" }, { cause: "CEREBRAS_API_KEY not set" })
      }

      const options: Record<string, any> = {
        baseURL: "https://api.cerebras.ai/v1",
        apiKey,
      }

      const key = "cerebras-sdk"
      const s = await state()
      const existing = s.sdk.get(Bun.hash.xxHash32(key))
      if (existing) return existing

      // Use OpenAI Compatible provider
      const loaded = createOpenAICompatible({
        name: "cerebras",
        ...options
      })
      
      s.sdk.set(Bun.hash.xxHash32(key), loaded)
      return loaded as SDK
    } catch (e) {
      throw new InitError({ providerID: "cerebras" }, { cause: e })
    }
  }

  export async function getProvider(providerID: string) {
    return state().then((s) => s.providers[providerID])
  }

  export async function getModel(providerID: string, modelID: string) {
    const s = await state()
    // Always fall back to Cerebras model if something else is requested
    const provider = s.providers["cerebras"]
    return provider.models["zai-glm-4.6"]
  }

  export async function getLanguage(model: Model) {
    const s = await state()
    // Hardcode key for single model
    const key = "cerebras/zai-glm-4.6"
    if (s.models.has(key)) return s.models.get(key)!

    // Force Cerebras model
    const actualModel = s.providers["cerebras"].models["zai-glm-4.6"]
    const sdk = await getSDK(actualModel)

    const language = sdk.languageModel(actualModel.api.id)
    s.models.set(key, language)
    return language
  }

  export async function closest(providerID: string, query: string[]) {
    // Only return Cerebras
    return {
      providerID: "cerebras",
      modelID: "zai-glm-4.6"
    }
  }

  export async function getSmallModel(providerID: string) {
    // Force use of the main model for everything
    return getModel("cerebras", "zai-glm-4.6")
  }

  export function sort(models: Model[]) {
    return models.slice().sort((a, b) => a.id.localeCompare(b.id))
  }

  export async function defaultModel() {
    return {
      providerID: "cerebras",
      modelID: "zai-glm-4.6",
    }
  }

  export function parseModel(model: string) {
    const [providerID, ...rest] = model.split("/")
    return {
      providerID: providerID,
      modelID: rest.join("/"),
    }
  }

  export const ModelNotFoundError = NamedError.create(
    "ProviderModelNotFoundError",
    z.object({
      providerID: z.string(),
      modelID: z.string(),
      suggestions: z.array(z.string()).optional(),
    }),
  )

  export const InitError = NamedError.create(
    "ProviderInitError",
    z.object({
      providerID: z.string(),
    }),
  )
}
