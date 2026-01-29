import path from "path"
import fs from "fs/promises"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { PatternTypes } from "./types"
import { $ } from "bun"

export namespace PatternStorage {
  const log = Log.create({ service: "pattern.storage" })

  const CACHE_DIR = ".cerebras/patterns"
  const CACHE_FILE = "patterns.json"
  const METADATA_FILE = "metadata.json"
  const MARKDOWN_FILE = "patterns.md"

  function getCacheDir(): string {
    return path.join(Instance.directory, CACHE_DIR)
  }

  async function ensureCacheDir(): Promise<void> {
    const dir = getCacheDir()
    await fs.mkdir(dir, { recursive: true })

    const gitignore = path.join(dir, ".gitignore")
    if (!(await Bun.file(gitignore).exists())) {
      await Bun.write(gitignore, "*.json\n")
    }
  }

  async function getProjectHash(): Promise<string> {
    const result = await $`git rev-parse HEAD`.cwd(Instance.directory).quiet().nothrow().text()
    return result.trim() || "unknown"
  }

  export async function isCacheValid(): Promise<boolean> {
    const file = Bun.file(path.join(getCacheDir(), METADATA_FILE))
    const exists = await file.exists()
    if (!exists) return false

    const data = await file.json().catch(() => null)
    if (!data) return false

    const parsed = PatternTypes.PatternMetadata.safeParse(data)
    if (!parsed.success) return false

    // Check if git HEAD has changed (new commits)
    const currentHash = await getProjectHash()
    const hashChanged = parsed.data.projectHash !== currentHash && parsed.data.projectHash !== "unknown"

    const expired = Date.now() - parsed.data.generated >= PatternTypes.CACHE_MAX_AGE_MS
    const versionMismatch = parsed.data.version !== PatternTypes.PATTERN_VERSION

    const valid = !versionMismatch && !expired && !hashChanged

    log.info("cache check", { 
      valid, 
      hashChanged,
      expired,
      age: Date.now() - parsed.data.generated,
      cachedHash: parsed.data.projectHash.substring(0, 7),
      currentHash: currentHash.substring(0, 7),
    })
    return valid
  }

  export async function loadPatterns(): Promise<PatternTypes.ProjectPatterns | null> {
    const file = Bun.file(path.join(getCacheDir(), CACHE_FILE))
    const exists = await file.exists()
    if (!exists) return null

    const data = await file.json().catch(() => null)
    if (!data) return null

    const parsed = PatternTypes.ProjectPatterns.safeParse(data)
    if (!parsed.success) return null

    return parsed.data
  }

  export async function savePatterns(patterns: PatternTypes.ProjectPatterns): Promise<void> {
    await ensureCacheDir()
    const cacheDir = getCacheDir()

    await Bun.write(path.join(cacheDir, CACHE_FILE), JSON.stringify(patterns, null, 2))

    await Bun.write(path.join(cacheDir, METADATA_FILE), JSON.stringify(patterns.metadata, null, 2))

    const markdown = generateMarkdownReport(patterns)
    await Bun.write(path.join(cacheDir, MARKDOWN_FILE), markdown)

    log.info("saved patterns", {
      patternCount: Object.keys(patterns.patterns).length,
      fileCount: patterns.metadata.fileCount,
    })
  }

  export async function clearCache(): Promise<void> {
    await fs.rm(getCacheDir(), { recursive: true, force: true }).catch(() => {})
    log.info("cleared pattern cache")
  }

  function generateMarkdownReport(patterns: PatternTypes.ProjectPatterns): string {
    const lines: string[] = [
      "# Project Patterns Cache",
      "",
      `Generated: ${new Date(patterns.metadata.generated).toISOString()}`,
      `Version: ${patterns.metadata.version}`,
      `Files Analyzed: ${patterns.metadata.fileCount}`,
      `Total Patterns: ${patterns.metadata.totalPatterns}`,
      `Languages: ${patterns.metadata.languages.join(", ")}`,
      "",
      "---",
      "",
    ]

    const patternsByType = new Map<string, PatternTypes.Pattern[]>()
    for (const pattern of Object.values(patterns.patterns)) {
      const existing = patternsByType.get(pattern.type) || []
      existing.push(pattern)
      patternsByType.set(pattern.type, existing)
    }

    for (const [type, typePatterns] of patternsByType) {
      lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)} Patterns`)
      lines.push("")

      const sorted = typePatterns.sort((a, b) => b.confidence - a.confidence)

      for (const pattern of sorted) {
        lines.push(`### ${pattern.signature} (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`)
        lines.push("")
        lines.push(`**Language**: ${pattern.language}`)
        lines.push(`**Instances**: ${pattern.instances.length} files`)
        lines.push("")

        if (pattern.semantics.intentTags.length > 0) {
          lines.push(`**Intent Tags**: ${pattern.semantics.intentTags.join(", ")}`)
          lines.push("")
        }

        if (pattern.conventions.naming) {
          lines.push(`**Naming Convention**: ${pattern.conventions.naming}`)
        }
        if (pattern.conventions.structure) {
          lines.push(`**Structure**: ${pattern.conventions.structure}`)
        }
        if (pattern.conventions.errorHandling) {
          lines.push(`**Error Handling**: ${pattern.conventions.errorHandling}`)
        }
        lines.push("")

        lines.push("**Template**:")
        lines.push("```" + pattern.language)
        lines.push(pattern.template.skeleton)
        lines.push("```")
        lines.push("")

        if (pattern.template.placeholders.length > 0) {
          lines.push("**Placeholders**:")
          for (const placeholder of pattern.template.placeholders) {
            lines.push(`- \`{{${placeholder.name}}}\` (${placeholder.type})`)
          }
          lines.push("")
        }

        lines.push("---")
        lines.push("")
      }
    }

    return lines.join("\n")
  }

  export async function getMarkdownReport(): Promise<string | null> {
    const file = Bun.file(path.join(getCacheDir(), MARKDOWN_FILE))
    const exists = await file.exists()
    if (!exists) return null
    return file.text().catch(() => null)
  }
}
