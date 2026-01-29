import type { CommandModule } from "yargs"
import { UI } from "../ui"
import { Pattern } from "../../pattern"
import { PatternStorage } from "../../pattern/storage"
import { Instance } from "../../project/instance"
import { Project } from "../../project/project"

export const PatternsCommand: CommandModule<{}, { action: string; filter?: string; threshold?: number }> = {
  command: "patterns <action>",
  describe: "Discover and manage project code patterns",
  builder: (yargs) =>
    yargs
      .positional("action", {
        describe: "Action to perform",
        choices: ["show", "explain", "discover", "clear", "export", "context"] as const,
        demandOption: true,
      })
      .option("filter", {
        alias: "f",
        describe: "Filter patterns by type or signature",
        type: "string",
      })
      .option("threshold", {
        alias: "t",
        describe: "Minimum confidence threshold (0-1)",
        type: "number",
        default: 0.7,
      }),
  handler: async (args) => {
    const directory = process.cwd()
    await Instance.provide({
      directory,
      fn: async () => {
        const threshold = args.threshold ?? 0.7

        switch (args.action) {
          case "show": {
            const patterns = await Pattern.getPatterns()
            if (!patterns) {
              UI.println(UI.Style.TEXT_DANGER + "Pattern discovery is disabled or no patterns found.")
              UI.println("Run 'opencode patterns discover' to analyze the project.")
              return
            }

            const filtered = Object.values(patterns.patterns).filter((p) => {
              if (p.confidence < threshold) return false
              if (args.filter) {
                const filter = args.filter.toLowerCase()
                return p.type.includes(filter) || p.signature.toLowerCase().includes(filter)
              }
              return true
            })

            UI.println(`\n${UI.Style.TEXT_HIGHLIGHT_BOLD}Found ${filtered.length} patterns (threshold: ${(threshold * 100).toFixed(0)}%)${UI.Style.TEXT_NORMAL}\n`)

            const byType = new Map<string, typeof filtered>()
            for (const pattern of filtered) {
              const existing = byType.get(pattern.type) || []
              existing.push(pattern)
              byType.set(pattern.type, existing)
            }

            for (const [type, typePatterns] of byType) {
              UI.println(`${UI.Style.TEXT_DIM}── ${type.toUpperCase()} ──${UI.Style.TEXT_NORMAL}`)
              for (const p of typePatterns.sort((a, b) => b.confidence - a.confidence).slice(0, 10)) {
                const confidence = (p.confidence * 100).toFixed(0)
                UI.println(`  ${UI.Style.TEXT_HIGHLIGHT}${p.signature}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${confidence}%, ${p.instances.length} instances)${UI.Style.TEXT_NORMAL}`)
              }
              UI.println("")
            }
            break
          }

          case "explain": {
            if (!args.filter) {
              UI.error("Please provide a pattern filter with --filter")
              return
            }

            const patterns = await Pattern.getPatterns()
            if (!patterns) {
              UI.error("No patterns found.")
              return
            }

            const filter = args.filter.toLowerCase()
            const match = Object.values(patterns.patterns).find(
              (p) => p.signature.toLowerCase().includes(filter) || p.type.includes(filter)
            )

            if (!match) {
              UI.error(`No pattern matching "${args.filter}" found.`)
              return
            }

            UI.println(`\n${UI.Style.TEXT_HIGHLIGHT_BOLD}${match.signature}${UI.Style.TEXT_NORMAL}\n`)
            UI.println(`${UI.Style.TEXT_DIM}Type:${UI.Style.TEXT_NORMAL} ${match.type}`)
            UI.println(`${UI.Style.TEXT_DIM}Language:${UI.Style.TEXT_NORMAL} ${match.language}`)
            UI.println(`${UI.Style.TEXT_DIM}Confidence:${UI.Style.TEXT_NORMAL} ${(match.confidence * 100).toFixed(0)}%`)
            UI.println(`${UI.Style.TEXT_DIM}Instances:${UI.Style.TEXT_NORMAL} ${match.instances.length} files`)

            if (match.conventions.naming) {
              UI.println(`${UI.Style.TEXT_DIM}Naming:${UI.Style.TEXT_NORMAL} ${match.conventions.naming}`)
            }
            if (match.conventions.errorHandling) {
              UI.println(`${UI.Style.TEXT_DIM}Error Handling:${UI.Style.TEXT_NORMAL} ${match.conventions.errorHandling}`)
            }

            UI.println(`\n${UI.Style.TEXT_DIM}Template:${UI.Style.TEXT_NORMAL}\n`)
            UI.println(match.template.skeleton.substring(0, 1000))

            UI.println(`\n${UI.Style.TEXT_DIM}Example Files:${UI.Style.TEXT_NORMAL}`)
            for (const instance of match.instances.slice(0, 5)) {
              UI.println(`  - ${instance.file}:${instance.lineStart}-${instance.lineEnd}`)
            }
            break
          }

          case "discover": {
            UI.println(`${UI.Style.TEXT_INFO}Discovering patterns...${UI.Style.TEXT_NORMAL}`)
            const startTime = Date.now()

            const patterns = await Pattern.refresh({ force: true })
            if (!patterns) {
              UI.error("Pattern discovery is disabled in configuration.")
              return
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(1)
            UI.println(
              `${UI.Style.TEXT_SUCCESS}Discovered ${patterns.metadata.totalPatterns} patterns from ${patterns.metadata.fileCount} files in ${duration}s${UI.Style.TEXT_NORMAL}`
            )

            UI.println(`\n${UI.Style.TEXT_DIM}Languages:${UI.Style.TEXT_NORMAL} ${patterns.metadata.languages.join(", ")}`)

            const byType = new Map<string, number>()
            for (const pattern of Object.values(patterns.patterns)) {
              byType.set(pattern.type, (byType.get(pattern.type) || 0) + 1)
            }

            UI.println(`\n${UI.Style.TEXT_DIM}Patterns by Type:${UI.Style.TEXT_NORMAL}`)
            for (const [type, count] of byType) {
              UI.println(`  - ${type}: ${count}`)
            }
            break
          }

          case "clear": {
            await PatternStorage.clearCache()
            UI.println(`${UI.Style.TEXT_SUCCESS}Pattern cache cleared.${UI.Style.TEXT_NORMAL}`)
            UI.println("Run 'opencode patterns discover' to re-analyze the project.")
            break
          }

          case "export": {
            const markdown = await PatternStorage.getMarkdownReport()
            if (!markdown) {
              UI.error("No patterns found. Run 'opencode patterns discover' first.")
              return
            }
            UI.println(markdown)
            break
          }

          case "context": {
            const intent = args.filter || "create a hello world"
            UI.println(`${UI.Style.TEXT_DIM}Testing pattern context for: "${intent}"${UI.Style.TEXT_NORMAL}\n`)
            
            const context = await Pattern.getPatternContext(intent, "build")
            if (!context) {
              UI.error("No pattern context generated. Check if patterns are enabled.")
              return
            }
            
            UI.println(`${UI.Style.TEXT_SUCCESS}Generated context (${context.length} chars):${UI.Style.TEXT_NORMAL}\n`)
            UI.println(context)
            break
          }
        }
      },
    })
  },
}
