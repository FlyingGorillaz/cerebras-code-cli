import z from "zod"
import { Tool } from "./tool"
import { Pattern } from "../pattern"
import { PatternStorage } from "../pattern/storage"
import DESCRIPTION from "./patterns.txt"

export const PatternsTool = Tool.define("patterns", {
  description: DESCRIPTION,
  parameters: z.object({
    action: z
      .enum(["show", "explain", "discover", "clear"])
      .describe("Action to perform: show patterns, explain a pattern, discover new patterns, or clear cache"),
    pattern_filter: z
      .string()
      .optional()
      .describe("Filter patterns by type (component, api, service, test, etc.) or signature"),
    confidence_threshold: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Minimum confidence threshold for patterns (0-1, default 0.7)"),
  }),
  async execute(params) {
    const threshold = params.confidence_threshold ?? 0.7

    switch (params.action) {
      case "show": {
        const patterns = await Pattern.getPatterns()
        if (!patterns) {
          return {
            title: "No patterns found",
            output: "Pattern discovery is disabled or no patterns have been discovered yet. Run with action='discover' to analyze the project.",
            metadata: { action: "show", count: 0 },
          }
        }

        const filtered = Object.values(patterns.patterns).filter((p) => {
          if (p.confidence < threshold) return false
          if (params.pattern_filter) {
            const filter = params.pattern_filter.toLowerCase()
            return p.type.includes(filter) || p.signature.toLowerCase().includes(filter)
          }
          return true
        })

        const byType = new Map<string, typeof filtered>()
        for (const pattern of filtered) {
          const existing = byType.get(pattern.type) || []
          existing.push(pattern)
          byType.set(pattern.type, existing)
        }

        const lines: string[] = [
          `Found ${filtered.length} patterns (threshold: ${(threshold * 100).toFixed(0)}%)`,
          "",
        ]

        for (const [type, typePatterns] of byType) {
          lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)} Patterns`)
          for (const p of typePatterns.sort((a, b) => b.confidence - a.confidence).slice(0, 5)) {
            lines.push(`- ${p.signature} (${(p.confidence * 100).toFixed(0)}% confidence, ${p.instances.length} instances)`)
          }
          lines.push("")
        }

        return {
          title: `Showing ${filtered.length} patterns`,
          output: lines.join("\n"),
          metadata: { action: "show", count: filtered.length },
        }
      }

      case "explain": {
        if (!params.pattern_filter) {
          return {
            title: "Pattern filter required",
            output: "Please provide a pattern_filter to explain a specific pattern.",
            metadata: { action: "explain", count: 0 },
          }
        }

        const patterns = await Pattern.getPatterns()
        if (!patterns) {
          return {
            title: "No patterns found",
            output: "Pattern discovery is disabled or no patterns have been discovered yet.",
            metadata: { action: "explain", count: 0 },
          }
        }

        const filter = params.pattern_filter.toLowerCase()
        const match = Object.values(patterns.patterns).find(
          (p) => p.signature.toLowerCase().includes(filter) || p.type.includes(filter)
        )

        if (!match) {
          return {
            title: "Pattern not found",
            output: `No pattern matching "${params.pattern_filter}" was found.`,
            metadata: { action: "explain", count: 0 },
          }
        }

        const lines: string[] = [
          `# ${match.signature}`,
          "",
          `**Type**: ${match.type}`,
          `**Language**: ${match.language}`,
          `**Confidence**: ${(match.confidence * 100).toFixed(0)}%`,
          `**Instances**: ${match.instances.length} files`,
          "",
        ]

        if (match.conventions.naming) {
          lines.push(`**Naming Convention**: ${match.conventions.naming}`)
        }
        if (match.conventions.errorHandling) {
          lines.push(`**Error Handling**: ${match.conventions.errorHandling}`)
        }
        lines.push("")

        lines.push("## Template")
        lines.push("```" + match.language)
        lines.push(match.template.skeleton)
        lines.push("```")
        lines.push("")

        if (match.template.placeholders.length > 0) {
          lines.push("## Placeholders")
          for (const ph of match.template.placeholders) {
            lines.push(`- \`{{${ph.name}}}\` (${ph.type}): ${ph.inferenceHints.join(", ")}`)
          }
          lines.push("")
        }

        lines.push("## Example Files")
        for (const instance of match.instances.slice(0, 5)) {
          lines.push(`- ${instance.file}:${instance.lineStart}-${instance.lineEnd}`)
        }

        if (match.semantics.intentTags.length > 0) {
          lines.push("")
          lines.push(`**Intent Tags**: ${match.semantics.intentTags.join(", ")}`)
        }

        return {
          title: `Pattern: ${match.signature}`,
          output: lines.join("\n"),
          metadata: { action: "explain", count: 1 },
        }
      }

      case "discover": {
        const patterns = await Pattern.refresh({ force: true })
        if (!patterns) {
          return {
            title: "Discovery failed",
            output: "Pattern discovery is disabled in configuration.",
            metadata: { action: "discover", count: 0 },
          }
        }

        const lines: string[] = [
          `Discovered ${patterns.metadata.totalPatterns} patterns from ${patterns.metadata.fileCount} files`,
          "",
          `**Languages**: ${patterns.metadata.languages.join(", ")}`,
          `**Generated**: ${new Date(patterns.metadata.generated).toISOString()}`,
          "",
        ]

        const byType = new Map<string, number>()
        for (const pattern of Object.values(patterns.patterns)) {
          byType.set(pattern.type, (byType.get(pattern.type) || 0) + 1)
        }

        lines.push("## Patterns by Type")
        for (const [type, count] of byType) {
          lines.push(`- ${type}: ${count}`)
        }

        return {
          title: `Discovered ${patterns.metadata.totalPatterns} patterns`,
          output: lines.join("\n"),
          metadata: { action: "discover", count: patterns.metadata.totalPatterns },
        }
      }

      case "clear": {
        await PatternStorage.clearCache()
        return {
          title: "Pattern cache cleared",
          output: "Pattern cache has been cleared. Run with action='discover' to re-analyze the project.",
          metadata: { action: "clear", count: 0 },
        }
      }

      default:
        return {
          title: "Unknown action",
          output: `Unknown action: ${params.action}. Valid actions: show, explain, discover, clear`,
          metadata: { action: params.action, count: 0 },
        }
    }
  },
})
