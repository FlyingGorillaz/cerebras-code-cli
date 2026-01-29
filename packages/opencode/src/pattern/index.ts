import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { Config } from "../config/config"
import { PatternTypes } from "./types"
import { PatternStorage } from "./storage"
import { PatternDiscovery } from "./discovery"

export namespace Pattern {
  const log = Log.create({ service: "pattern" })

  export const Types = PatternTypes
  export const Storage = PatternStorage
  export const Discovery = PatternDiscovery

  const state = Instance.state(async () => {
    const config = await Config.get()
    const enabled = config.experimental?.patterns !== false

    if (!enabled) {
      log.info("patterns disabled by config")
      return { enabled: false, patterns: null }
    }

    log.info("initializing pattern system")

    const patterns = await PatternDiscovery.discover().catch((e) => {
      log.error("failed to discover patterns", { error: e })
      return null
    })

    return { enabled: true, patterns }
  })

  export async function isEnabled(): Promise<boolean> {
    const s = await state()
    return s.enabled
  }

  export async function getPatterns(): Promise<PatternTypes.ProjectPatterns | null> {
    const s = await state()
    return s.patterns
  }

  export async function refresh(options?: { force?: boolean }): Promise<PatternTypes.ProjectPatterns | null> {
    const config = await Config.get()
    if (config.experimental?.patterns === false) {
      return null
    }

    if (options?.force) {
      await PatternStorage.clearCache()
    }

    return PatternDiscovery.discover({ forceRefresh: options?.force })
  }

  export type PatternMode = "build" | "doc" | "all"

  export async function getPatternForIntent(
    intent: string,
    mode?: PatternMode
  ): Promise<PatternTypes.Pattern[]> {
    const enabled = await isEnabled()
    if (!enabled) return []

    const patterns = await PatternDiscovery.getPatternForIntent(intent)

    // Filter by mode if specified
    if (mode && mode !== "all") {
      return patterns.filter((p) => p.mode === mode || p.mode === "all")
    }

    return patterns
  }

  export async function getPatternContext(intent: string, mode?: PatternMode): Promise<string> {
    const projectPatterns = await getPatterns()
    const patterns = await getPatternForIntent(intent, mode)
    
    if (patterns.length === 0 && !projectPatterns?.style) return ""

    const lines: string[] = [
      "<project_style_guide>",
      "This project has specific coding conventions. Apply these style rules to ALL code you generate, regardless of programming language:",
      "",
    ]

    // Add project-wide style rules first (language-agnostic)
    if (projectPatterns?.style?.rules && projectPatterns.style.rules.length > 0) {
      lines.push("## Coding Style Rules")
      for (const rule of projectPatterns.style.rules) {
        lines.push(`- ${rule}`)
      }
      lines.push("")
    }

    // Add style guide details with language tagging
    if (projectPatterns?.style?.guide) {
      const g = projectPatterns.style.guide
      const langs = projectPatterns?.metadata?.languages || []
      const langTag = langs.length > 0 ? ` [${langs.join(", ")}]` : ""
      
      // Universal conventions (apply to all languages)
      lines.push("## Universal Conventions (all languages)")
      if (g.naming) {
        if (g.naming.variables) lines.push(`- Variables: ${g.naming.variables}`)
        if (g.naming.functions) lines.push(`- Functions: ${g.naming.functions}`)
        if (g.naming.classes) lines.push(`- Classes/Types: ${g.naming.classes}`)
      }
      if (g.comments) {
        if (g.comments.style) lines.push(`- Comment style: ${g.comments.style}`)
        if (g.comments.density) lines.push(`- Comment density: ${g.comments.density}`)
      }
      if (g.formatting?.indentation) lines.push(`- Indentation: ${g.formatting.indentation}`)
      lines.push("")

      // Language-specific conventions
      if (g.formatting || g.imports || g.types || g.errorHandling || g.organization) {
        lines.push(`## Language-Specific Conventions${langTag}`)
        lines.push("(Apply these when writing in the same or similar languages)")
        lines.push("")
        
        if (g.formatting) {
          if (g.formatting.semicolons !== undefined) {
            lines.push(`- Semicolons: ${g.formatting.semicolons ? "required" : "omit"} [JS/TS]`)
          }
          if (g.formatting.quotes) lines.push(`- Quotes: ${g.formatting.quotes} [JS/TS/Python]`)
        }

        if (g.imports) {
          if (g.imports.style) lines.push(`- Import style: ${g.imports.style} [JS/TS]`)
          if (g.imports.pathStyle) lines.push(`- Path style: ${g.imports.pathStyle} [JS/TS]`)
        }

        if (g.types) {
          if (g.types.useZod) lines.push("- Runtime validation: Zod [TypeScript]")
          if (g.types.preferInterface) lines.push("- Prefer interfaces over type aliases [TypeScript]")
          if (g.types.style) lines.push(`- Typing style: ${g.types.style} [typed languages]`)
        }

        if (g.errorHandling) {
          if (g.errorHandling.style) {
            const errLang = g.errorHandling.style === "promise-catch" ? "[JS/TS]" : 
                           g.errorHandling.style === "try-catch" ? "[all]" : "[all]"
            lines.push(`- Error handling: ${g.errorHandling.style} ${errLang}`)
          }
        }

        if (g.organization) {
          if (g.organization.style) lines.push(`- Code organization: ${g.organization.style} [JS/TS]`)
          if (g.organization.exportStyle) lines.push(`- Export style: ${g.organization.exportStyle} [JS/TS]`)
        }
        lines.push("")
      }
    }

    // Add pattern-specific examples
    if (patterns.length > 0) {
      lines.push("## Code Examples from This Project")
      lines.push("Follow these patterns when creating similar code:")
      lines.push("")

      for (const pattern of patterns.slice(0, 2)) {
        const examples = pattern.instances.slice(0, 1)
        for (const example of examples) {
          lines.push(`### ${pattern.type} (${example.file})`)
          lines.push("```" + pattern.language)
          lines.push(example.content.substring(0, 500))
          lines.push("```")
          lines.push("")
        }
      }
    }

    lines.push("</project_style_guide>")

    return lines.join("\n")
  }

  export function init() {
    state()
  }
}
