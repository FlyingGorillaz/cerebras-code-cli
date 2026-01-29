import path from "path"
import z from "zod"
import { generateText } from "ai"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { PatternTypes } from "./types"
import { PatternStorage } from "./storage"
import { Ripgrep } from "../file/ripgrep"
import { Provider } from "../provider/provider"
import { ProviderTransform } from "../provider/transform"
import { Config } from "../config/config"
import { $ } from "bun"

export namespace PatternDiscovery {
  const log = Log.create({ service: "pattern.discovery" })

  const MIN_PATTERN_INSTANCES = 2
  const MAX_FILES_TO_ANALYZE = 500
  const MAX_FILE_SIZE_BYTES = 100_000

  interface FileStructure {
    file: string
    language: string
    content: string
    structures: ExtractedStructure[]
  }

  interface ExtractedStructure {
    type: PatternTypes.Pattern["type"]
    signature: string
    content: string
    lineStart: number
    lineEnd: number
    conventions: PatternTypes.PatternConventions
  }

  const STRUCTURE_PATTERNS: Record<string, RegExp[]> = {
    typescript: [
      /^export\s+(const|function|class|interface|type)\s+(\w+)/gm,
      /^(const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>/gm,
      /^export\s+default\s+(function|class)/gm,
    ],
    javascript: [
      /^export\s+(const|function|class)\s+(\w+)/gm,
      /^(const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>/gm,
      /^module\.exports\s*=/gm,
    ],
    python: [
      /^(def|class|async\s+def)\s+(\w+)/gm,
      /^@\w+\s*\n(def|class|async\s+def)\s+(\w+)/gm,
    ],
    go: [
      /^func\s+(\w+|\([^)]+\)\s+\w+)\s*\(/gm,
      /^type\s+(\w+)\s+(struct|interface)/gm,
    ],
    rust: [
      /^(pub\s+)?(fn|struct|enum|impl|trait)\s+(\w+)/gm,
      /^#\[.*\]\s*\n(pub\s+)?(fn|struct|enum)\s+(\w+)/gm,
    ],
    java: [
      /^(public|private|protected)?\s*(static)?\s*(class|interface|enum)\s+(\w+)/gm,
      /^(public|private|protected)?\s*(static)?\s*\w+\s+(\w+)\s*\(/gm,
    ],
    kotlin: [
      /^(fun|class|interface|object|data\s+class)\s+(\w+)/gm,
    ],
    ruby: [
      /^(def|class|module)\s+(\w+)/gm,
    ],
    php: [
      /^(function|class|interface|trait)\s+(\w+)/gm,
      /^(public|private|protected)\s+(static\s+)?function\s+(\w+)/gm,
    ],
  }

  const TYPE_INDICATORS: Record<string, string[]> = {
    component: ["Component", "Page", "View", "Screen", "Layout", "Widget", "render", "jsx", "tsx", "useState", "useEffect"],
    api: ["router", "endpoint", "route", "handler", "controller", "api", "request", "response", "req", "res"],
    service: ["Service", "service", "Provider", "Repository", "Manager", "Client"],
    test: ["test", "spec", "describe", "it", "expect", "assert", "mock", "jest", "vitest"],
    config: ["config", "Config", "settings", "Settings", "options", "Options", "env"],
    hook: ["use", "hook", "Hook"],
    utility: ["util", "Util", "helper", "Helper", "utils", "helpers"],
    model: ["Model", "Schema", "Entity", "Type", "Interface"],
    controller: ["Controller", "controller", "Handler", "handler"],
    middleware: ["middleware", "Middleware", "interceptor", "guard"],
  }

  export async function discover(options?: {
    forceRefresh?: boolean
    maxFiles?: number
  }): Promise<PatternTypes.ProjectPatterns> {
    const forceRefresh = options?.forceRefresh ?? false
    const maxFiles = options?.maxFiles ?? MAX_FILES_TO_ANALYZE

    if (!forceRefresh && (await PatternStorage.isCacheValid())) {
      const cached = await PatternStorage.loadPatterns()
      if (cached) {
        log.info("using cached patterns", { patternCount: Object.keys(cached.patterns).length })
        return cached
      }
    }

    log.info("discovering patterns", { maxFiles })
    const startTime = Date.now()

    const files = await collectFiles(maxFiles)
    log.info("collected files", { count: files.length })

    const structures = await analyzeFiles(files)
    const totalStructures = structures.reduce((sum, s) => sum + s.structures.length, 0)
    log.info("analyzed structures", { fileCount: structures.length, totalStructures })

    let patterns = clusterPatterns(structures)
    log.info("clustered patterns", { count: Object.keys(patterns).length })

    // Validate low-confidence patterns with LLM if enabled
    patterns = await validatePatterns(patterns)

    const relationships = analyzeRelationships(patterns)
    
    // Analyze project-wide coding style
    const style = await analyzeStyle(structures)
    log.info("analyzed style", { rules: style.rules.length })

    const projectHash = await getProjectHash()
    const languages = Array.from(new Set(structures.map((s) => s.language)))

    const result: PatternTypes.ProjectPatterns = {
      metadata: {
        generated: Date.now(),
        version: PatternTypes.PATTERN_VERSION,
        projectHash,
        fileCount: files.length,
        totalPatterns: Object.keys(patterns).length,
        languages,
      },
      patterns,
      relationships,
      style,
    }

    await PatternStorage.savePatterns(result)

    log.info("pattern discovery complete", {
      duration: Date.now() - startTime,
      patterns: Object.keys(patterns).length,
      files: files.length,
    })

    return result
  }

  async function getProjectHash(): Promise<string> {
    const result = await $`git rev-parse HEAD`.cwd(Instance.directory).quiet().nothrow().text()
    return result.trim() || "unknown"
  }

  async function collectFiles(maxFiles: number): Promise<string[]> {
    const files: string[] = []
    const extensions = Object.keys(PatternTypes.SUPPORTED_EXTENSIONS)

    for await (const file of Ripgrep.files({ cwd: Instance.directory })) {
      const ext = path.extname(file)
      if (!extensions.includes(ext)) continue

      const fullPath = path.join(Instance.directory, file)
      const stat = await Bun.file(fullPath).stat().catch(() => null)
      if (stat && stat.size <= MAX_FILE_SIZE_BYTES) {
        files.push(file)
      }

      if (files.length >= maxFiles) break
    }

    return files
  }

  async function analyzeFiles(files: string[]): Promise<FileStructure[]> {
    const results: FileStructure[] = []

    const analyzeFile = async (file: string): Promise<FileStructure | null> => {
      const ext = path.extname(file)
      const language = PatternTypes.SUPPORTED_EXTENSIONS[ext]
      if (!language) return null

      const fullPath = path.join(Instance.directory, file)
      const content = await Bun.file(fullPath).text().catch(() => null)
      if (!content) return null

      const structures = extractStructures(content, language, file)
      if (structures.length === 0) return null

      return { file, language, content, structures }
    }

    const batchSize = 50
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map(analyzeFile))
      results.push(...batchResults.filter((r): r is FileStructure => r !== null))
    }

    return results
  }

  function extractStructures(content: string, language: string, file: string): ExtractedStructure[] {
    const structures: ExtractedStructure[] = []
    const lines = content.split("\n")
    const patterns = STRUCTURE_PATTERNS[language] || STRUCTURE_PATTERNS.typescript

    for (const pattern of patterns) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = pattern.exec(content)) !== null) {
        const startIndex = match.index
        const lineStart = content.substring(0, startIndex).split("\n").length
        const structureContent = extractStructureContent(lines, lineStart - 1)

        if (structureContent.length < 3) continue

        const type = inferStructureType(structureContent, file, match[0])
        const signature = generateSignature(structureContent, type, language)
        const conventions = extractConventions(structureContent, language)

        structures.push({
          type,
          signature,
          content: structureContent,
          lineStart,
          lineEnd: lineStart + structureContent.split("\n").length - 1,
          conventions,
        })
      }
    }

    return structures
  }

  function extractStructureContent(lines: string[], startLine: number): string {
    const result: string[] = []
    const maxLines = 100
    const state = { depth: 0, started: false }

    for (const i of Array.from({ length: Math.min(maxLines, lines.length - startLine) }, (_, k) => startLine + k)) {
      const line = lines[i]
      result.push(line)

      for (const char of line) {
        if (char === "{" || char === "(" || char === "[") {
          state.depth++
          state.started = true
        }
        if (char === "}" || char === ")" || char === "]") state.depth--
      }

      if (state.started && state.depth <= 0) break
    }

    return result.join("\n")
  }

  function inferStructureType(content: string, file: string, match: string): PatternTypes.Pattern["type"] {
    const combined = (content + " " + file + " " + match).toLowerCase()

    for (const [type, indicators] of Object.entries(TYPE_INDICATORS)) {
      for (const indicator of indicators) {
        if (combined.includes(indicator.toLowerCase())) {
          return type as PatternTypes.Pattern["type"]
        }
      }
    }

    return "unknown"
  }

  function generateSignature(content: string, type: string, language: string): string {
    const first = content.split("\n")[0].trim()
    
    // Extract structural pattern (e.g., "export function", "export const", "class")
    const pattern = first
      .replace(/["'`][^"'`]*["'`]/g, '""')
      .replace(/\b[a-z][a-zA-Z0-9]*\b/g, "x")
      .replace(/\b[A-Z][a-zA-Z0-9]*\b/g, "X")
      .replace(/\s+/g, " ")
      .substring(0, 50)

    return `${type}-${language}-${hashString(pattern)}`
  }

  function hashString(str: string): string {
    const hash = str.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) & 0xffffffff, 0)
    return Math.abs(hash).toString(36).substring(0, 8)
  }

  function extractConventions(content: string, language: string): PatternTypes.PatternConventions {
    const conventions: PatternTypes.PatternConventions = {}

    const camelCase = /\b[a-z][a-zA-Z0-9]*\b/g
    const pascalCase = /\b[A-Z][a-zA-Z0-9]*\b/g
    const snakeCase = /\b[a-z]+_[a-z_]+\b/g

    const camelMatches = content.match(camelCase)?.length || 0
    const pascalMatches = content.match(pascalCase)?.length || 0
    const snakeMatches = content.match(snakeCase)?.length || 0

    if (camelMatches > pascalMatches && camelMatches > snakeMatches) conventions.naming = "camelCase"
    if (pascalMatches > camelMatches && pascalMatches > snakeMatches) conventions.naming = "PascalCase"
    if (snakeMatches > camelMatches && snakeMatches > pascalMatches) conventions.naming = "snake_case"

    if (content.includes("Result<") || content.includes("Result.")) conventions.errorHandling = "result-pattern"
    if (!conventions.errorHandling && (content.includes(".catch(") || content.includes(".then("))) conventions.errorHandling = "promise-catch"
    if (!conventions.errorHandling && content.includes("try") && content.includes("catch")) conventions.errorHandling = "try-catch"

    const importMatches = content.match(/^import\s+.*$/gm) || []
    if (importMatches.length > 0) {
      conventions.imports = importMatches.slice(0, 5)
    }

    return conventions
  }

  function clusterPatterns(structures: FileStructure[]): Record<string, PatternTypes.Pattern> {
    const clusters = new Map<string, { structure: ExtractedStructure; file: FileStructure }[]>()

    for (const fileStructure of structures) {
      for (const structure of fileStructure.structures) {
        const existing = clusters.get(structure.signature) || []
        existing.push({ structure, file: fileStructure })
        clusters.set(structure.signature, existing)
      }
    }

    const patterns: Record<string, PatternTypes.Pattern> = {}

    for (const [signature, instances] of clusters) {
      if (instances.length < MIN_PATTERN_INSTANCES) continue

      const first = instances[0]
      const confidence = Math.min(1, instances.length / 10)

      const template = generateTemplate(instances.map((i) => i.structure.content))

      const allConventions = instances.map((i) => i.structure.conventions)
      const mergedConventions = mergeConventions(allConventions)

      const intentTags = inferIntentTags(instances.map((i) => i.structure))

      const mode = inferPatternMode(first.file.file, first.structure.type, first.file.language)

      patterns[signature] = {
        signature,
        type: first.structure.type,
        mode,
        confidence,
        language: first.file.language,
        instances: instances.map((i) => ({
          file: i.file.file,
          lineStart: i.structure.lineStart,
          lineEnd: i.structure.lineEnd,
          hash: hashString(i.structure.content),
          content: i.structure.content.substring(0, 500),
        })),
        template,
        semantics: {
          intentTags,
          contextRequirements: [],
          relatedPatterns: [],
        },
        conventions: mergedConventions,
      }
    }

    return patterns
  }

  function generateTemplate(contents: string[]): PatternTypes.PatternTemplate {
    if (contents.length === 0) {
      return { skeleton: "", placeholders: [] }
    }

    const first = contents[0]
    const lines = first.split("\n")
    const placeholders: PatternTypes.PatternPlaceholder[] = []

    const skeleton = lines
      .map((line) => {
        return line
          .replace(/["'`][^"'`]*["'`]/g, (match) => {
            const name = `string_${placeholders.length}`
            placeholders.push({
              name,
              type: "expression",
              inferenceHints: ["string literal"],
            })
            return `{{${name}}}`
          })
          .replace(/\b([a-z][a-zA-Z0-9]{2,})\b(?=\s*[=:(])/g, (match) => {
            if (["const", "let", "var", "function", "class", "return", "import", "export", "from", "async", "await"].includes(match)) {
              return match
            }
            const name = `identifier_${placeholders.length}`
            placeholders.push({
              name,
              type: "identifier",
              inferenceHints: ["variable or function name"],
            })
            return `{{${name}}}`
          })
      })
      .join("\n")

    return { skeleton, placeholders }
  }

  function mergeConventions(conventions: PatternTypes.PatternConventions[]): PatternTypes.PatternConventions {
    const namingCounts = new Map<string, number>()
    const errorHandlingCounts = new Map<string, number>()

    for (const conv of conventions) {
      if (conv.naming) {
        namingCounts.set(conv.naming, (namingCounts.get(conv.naming) || 0) + 1)
      }
      if (conv.errorHandling) {
        errorHandlingCounts.set(conv.errorHandling, (errorHandlingCounts.get(conv.errorHandling) || 0) + 1)
      }
    }

    const mostCommonNaming = [...namingCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const mostCommonErrorHandling = [...errorHandlingCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

    return {
      naming: mostCommonNaming,
      errorHandling: mostCommonErrorHandling,
    }
  }

  function inferIntentTags(structures: ExtractedStructure[]): string[] {
    const tags = new Set<string>()

    for (const structure of structures) {
      tags.add(structure.type)

      const content = structure.content.toLowerCase()
      if (content.includes("async") || content.includes("await") || content.includes("promise")) {
        tags.add("async")
      }
      if (content.includes("fetch") || content.includes("http") || content.includes("request")) {
        tags.add("network")
      }
      if (content.includes("state") || content.includes("store") || content.includes("redux")) {
        tags.add("state-management")
      }
      if (content.includes("render") || content.includes("jsx") || content.includes("component")) {
        tags.add("ui")
      }
      if (content.includes("validate") || content.includes("schema") || content.includes("zod")) {
        tags.add("validation")
      }
    }

    return [...tags]
  }

  function analyzeRelationships(patterns: Record<string, PatternTypes.Pattern>): Record<string, PatternTypes.PatternRelationship> {
    const relationships: Record<string, PatternTypes.PatternRelationship> = {}

    const patternFiles = new Map<string, Set<string>>()
    for (const [signature, pattern] of Object.entries(patterns)) {
      const files = new Set(pattern.instances.map((i) => i.file))
      patternFiles.set(signature, files)
    }

    for (const [signature, files] of patternFiles) {
      const combinedWith: string[] = []

      for (const [otherSignature, otherFiles] of patternFiles) {
        if (signature === otherSignature) continue

        const intersection = [...files].filter((f) => otherFiles.has(f))
        if (intersection.length >= 2) {
          combinedWith.push(otherSignature)
        }
      }

      relationships[signature] = {
        oftenCombinedWith: combinedWith.slice(0, 5),
        mutuallyExclusive: [],
        evolutionPath: [],
      }
    }

    return relationships
  }

  export async function getPatternForIntent(intent: string): Promise<PatternTypes.Pattern[]> {
    const patterns = await discover()
    const intentLower = intent.toLowerCase()

    const matches: { pattern: PatternTypes.Pattern; score: number }[] = []

    for (const pattern of Object.values(patterns.patterns)) {
      let score = 0

      for (const tag of pattern.semantics.intentTags) {
        if (intentLower.includes(tag.toLowerCase())) {
          score += 2
        }
      }

      if (intentLower.includes(pattern.type)) {
        score += 3
      }

      if (pattern.conventions.naming && intentLower.includes(pattern.conventions.naming.toLowerCase())) {
        score += 1
      }

      if (score > 0) {
        matches.push({ pattern, score: score * pattern.confidence })
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((m) => m.pattern)
  }

  function inferPatternMode(
    filePath: string,
    patternType: z.infer<typeof PatternTypes.PatternType>,
    language: string
  ): z.infer<typeof PatternTypes.PatternMode> {
    const lowerPath = filePath.toLowerCase()

    // Documentation patterns
    const docPatterns = [
      /\/docs?\//,
      /\/documentation\//,
      /readme/i,
      /changelog/i,
      /contributing/i,
      /license/i,
      /\.md$/,
      /\.mdx$/,
      /\.rst$/,
      /\.txt$/,
    ]

    for (const pattern of docPatterns) {
      if (pattern.test(lowerPath)) {
        return "doc"
      }
    }

    // Documentation pattern types
    if (["documentation", "readme", "changelog"].includes(patternType)) {
      return "doc"
    }

    // Config patterns are applicable to all modes
    if (patternType === "config") {
      return "all"
    }

    // Test patterns are build-specific
    if (patternType === "test") {
      return "build"
    }

    // Source code patterns are build mode
    const codeExtensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h"]
    for (const ext of codeExtensions) {
      if (lowerPath.endsWith(ext)) {
        return "build"
      }
    }

    // Default to all if unclear
    return "all"
  }

  // LLM-based pattern analysis for validation and enhancement
  export async function analyzeWithLLM(samples: string[]): Promise<{
    patterns: Array<{
      name: string
      description: string
      type: PatternTypes.Pattern["type"]
      conventions: PatternTypes.PatternConventions
    }>
  } | null> {
    const cfg = await Config.get()
    if (!cfg.experimental?.patterns) return null

    const model = await Provider.defaultModel().catch(() => null)
    if (!model) {
      log.info("skipping LLM analysis - no model configured")
      return null
    }

    const small = await Provider.getSmallModel(model.providerID).catch(() => null)
    if (!small) {
      log.info("skipping LLM analysis - no small model available")
      return null
    }

    log.info("using model for pattern analysis", { provider: small.providerID, model: small.id })

    const language = await Provider.getLanguage(small)
    const options = ProviderTransform.smallOptions(small)

    const prompt = `Analyze these code samples and identify coding patterns, conventions, and styles.

<samples>
${samples.slice(0, 5).map((s, i) => `--- Sample ${i + 1} ---\n${s.substring(0, 500)}`).join("\n\n")}
</samples>

Respond with JSON only:
{
  "patterns": [
    {
      "name": "pattern name",
      "description": "what this pattern does",
      "type": "component|service|api|hook|utility|test|config|model|controller|middleware|unknown",
      "conventions": {
        "naming": "camelCase|PascalCase|snake_case",
        "errorHandling": "try-catch|result-pattern|promise-catch"
      }
    }
  ]
}`

    log.info("analyzing with LLM", { samples: samples.length })

    const result = await generateText({
      model: language,
      maxOutputTokens: 500,
      providerOptions: ProviderTransform.providerOptions(small.api.npm, small.providerID, options),
      messages: [{ role: "user", content: prompt }],
      headers: small.headers,
      experimental_telemetry: { isEnabled: cfg.experimental?.openTelemetry },
    }).catch((err: unknown) => {
      log.error("LLM analysis failed", { error: err })
      return null
    })

    if (!result) return null

    const json = result.text.match(/\{[\s\S]*\}/)?.[0]
    if (!json) return null

    try {
      return JSON.parse(json)
    } catch {
      return null
    }
  }

  // Validate and enhance patterns using LLM
  export async function validatePatterns(
    patterns: Record<string, PatternTypes.Pattern>
  ): Promise<Record<string, PatternTypes.Pattern>> {
    const cfg = await Config.get()
    if (!cfg.experimental?.patternsLLM) return patterns

    const lowConfidence = Object.values(patterns).filter((p) => p.confidence < 0.5)
    if (lowConfidence.length === 0) return patterns

    log.info("validating low confidence patterns with LLM", { count: lowConfidence.length })

    const samples = lowConfidence.flatMap((p) => p.instances.slice(0, 2).map((i) => i.content))
    const analysis = await analyzeWithLLM(samples).catch((e) => {
      log.info("LLM analysis error", { error: String(e) })
      return null
    })
    if (!analysis) return patterns

    // Merge LLM insights back into patterns
    for (const llmPattern of analysis.patterns) {
      const match = Object.values(patterns).find(
        (p) => p.type === llmPattern.type || p.signature.includes(llmPattern.type)
      )
      if (match) {
        match.confidence = Math.min(1, match.confidence + 0.2)
        if (llmPattern.conventions.naming) match.conventions.naming = llmPattern.conventions.naming
        if (llmPattern.conventions.errorHandling) match.conventions.errorHandling = llmPattern.conventions.errorHandling
      }
    }

    return patterns
  }

  // Analyze project-wide coding style from file samples
  export async function analyzeStyle(files: FileStructure[]): Promise<PatternTypes.ProjectStyle> {
    const guide: PatternTypes.StyleGuide = {}
    const examples: Record<string, string[]> = {}
    const rules: string[] = []

    // Sample files for analysis
    const samples = files.slice(0, 50)
    
    // Analyze commenting style
    const commentStats = analyzeComments(samples)
    guide.comments = commentStats.guide
    if (commentStats.examples.length > 0) {
      examples.comments = commentStats.examples
    }
    if (commentStats.rule) rules.push(commentStats.rule)

    // Analyze naming conventions
    const namingStats = analyzeNaming(samples)
    guide.naming = namingStats.guide
    if (namingStats.rule) rules.push(namingStats.rule)

    // Analyze formatting
    const formatStats = analyzeFormatting(samples)
    guide.formatting = formatStats.guide
    if (formatStats.rule) rules.push(formatStats.rule)

    // Analyze error handling
    const errorStats = analyzeErrorHandling(samples)
    guide.errorHandling = errorStats.guide
    if (errorStats.examples.length > 0) {
      examples.errorHandling = errorStats.examples
    }
    if (errorStats.rule) rules.push(errorStats.rule)

    // Analyze imports
    const importStats = analyzeImports(samples)
    guide.imports = importStats.guide
    if (importStats.rule) rules.push(importStats.rule)

    // Analyze code organization
    const orgStats = analyzeOrganization(samples)
    guide.organization = orgStats.guide
    if (orgStats.rule) rules.push(orgStats.rule)

    // Analyze type usage
    const typeStats = analyzeTypes(samples)
    guide.types = typeStats.guide
    if (typeStats.rule) rules.push(typeStats.rule)

    return { guide, examples, rules }
  }

  function analyzeComments(files: FileStructure[]): { guide: PatternTypes.StyleGuide["comments"], examples: string[], rule?: string } {
    let jsdoc = 0, inline = 0, block = 0, total = 0
    const examples: string[] = []

    for (const file of files) {
      const lines = file.content.split("\n")
      for (const line of lines) {
        if (/^\s*\/\*\*/.test(line)) { jsdoc++; total++ }
        if (/^\s*\/\//.test(line)) { inline++; total++ }
        if (/^\s*\/\*[^*]/.test(line)) { block++; total++ }
      }
      
      // Extract JSDoc examples
      const jsdocMatch = file.content.match(/\/\*\*[\s\S]*?\*\//g)
      if (jsdocMatch && examples.length < 2) {
        examples.push(jsdocMatch[0].substring(0, 200))
      }
    }

    const lineCount = files.reduce((sum, f) => sum + f.content.split("\n").length, 0)
    const density = total / lineCount

    let style: "jsdoc" | "inline" | "block" | "none" | "mixed" = "none"
    if (jsdoc > inline && jsdoc > block) style = "jsdoc"
    else if (inline > jsdoc && inline > block) style = "inline"
    else if (block > 0) style = "block"
    else if (total > 0) style = "mixed"

    let densityLevel: "heavy" | "moderate" | "minimal" | "none" = "none"
    if (density > 0.2) densityLevel = "heavy"
    else if (density > 0.1) densityLevel = "moderate"
    else if (density > 0.02) densityLevel = "minimal"

    const rule = style !== "none" 
      ? `Use ${style} comments with ${densityLevel} density`
      : undefined

    return { guide: { style, density: densityLevel, examples }, examples, rule }
  }

  function analyzeNaming(files: FileStructure[]): { guide: PatternTypes.StyleGuide["naming"], rule?: string } {
    let camel = 0, snake = 0, pascal = 0, screaming = 0

    for (const file of files) {
      // Count variable naming patterns
      const vars = file.content.match(/(?:const|let|var)\s+(\w+)/g) || []
      for (const v of vars) {
        const name = v.replace(/(?:const|let|var)\s+/, "")
        if (/^[a-z][a-zA-Z0-9]*$/.test(name)) camel++
        else if (/^[a-z][a-z0-9_]*$/.test(name)) snake++
        else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) pascal++
        else if (/^[A-Z][A-Z0-9_]*$/.test(name)) screaming++
      }
    }

    const total = camel + snake + pascal + screaming
    let variables: "camelCase" | "snake_case" | "PascalCase" | "SCREAMING_SNAKE" = "camelCase"
    if (snake > camel && snake > pascal) variables = "snake_case"
    else if (pascal > camel && pascal > snake) variables = "PascalCase"
    else if (screaming > camel) variables = "SCREAMING_SNAKE"

    const rule = total > 10 ? `Use ${variables} for variable names` : undefined

    return { 
      guide: { 
        variables, 
        functions: "camelCase", 
        classes: "PascalCase",
        constants: screaming > 5 ? "SCREAMING_SNAKE" : "camelCase"
      }, 
      rule 
    }
  }

  function analyzeFormatting(files: FileStructure[]): { guide: PatternTypes.StyleGuide["formatting"], rule?: string } {
    let semicolons = 0, noSemicolons = 0
    let singleQuotes = 0, doubleQuotes = 0
    let tabs = 0, twoSpaces = 0, fourSpaces = 0

    for (const file of files) {
      const lines = file.content.split("\n")
      for (const line of lines) {
        if (/;\s*$/.test(line)) semicolons++
        else if (/[^;{]\s*$/.test(line) && line.trim().length > 0) noSemicolons++
        
        singleQuotes += (line.match(/'/g) || []).length
        doubleQuotes += (line.match(/"/g) || []).length
        
        if (/^\t/.test(line)) tabs++
        else if (/^  [^ ]/.test(line)) twoSpaces++
        else if (/^    [^ ]/.test(line)) fourSpaces++
      }
    }

    const useSemicolons = semicolons > noSemicolons
    const quotes = singleQuotes > doubleQuotes ? "single" : "double"
    let indentation: "tabs" | "2-spaces" | "4-spaces" = "2-spaces"
    if (tabs > twoSpaces && tabs > fourSpaces) indentation = "tabs"
    else if (fourSpaces > twoSpaces) indentation = "4-spaces"

    const rules: string[] = []
    if (semicolons + noSemicolons > 50) {
      rules.push(useSemicolons ? "Use semicolons" : "Omit semicolons")
    }
    rules.push(`Use ${quotes} quotes`)
    rules.push(`Use ${indentation} for indentation`)

    return { 
      guide: { semicolons: useSemicolons, quotes, indentation }, 
      rule: rules.join(", ") 
    }
  }

  function analyzeErrorHandling(files: FileStructure[]): { guide: PatternTypes.StyleGuide["errorHandling"], examples: string[], rule?: string } {
    let tryCatch = 0, resultPattern = 0, promiseCatch = 0, throwCount = 0
    const examples: string[] = []

    for (const file of files) {
      tryCatch += (file.content.match(/try\s*\{/g) || []).length
      promiseCatch += (file.content.match(/\.catch\s*\(/g) || []).length
      throwCount += (file.content.match(/throw\s+/g) || []).length
      resultPattern += (file.content.match(/Result\.|Ok\(|Err\(/g) || []).length

      // Extract error handling examples
      const catchMatch = file.content.match(/\.catch\s*\([^)]*\)\s*=>\s*\{[^}]{0,100}\}/g)
      if (catchMatch && examples.length < 2) {
        examples.push(catchMatch[0])
      }
    }

    let style: "try-catch" | "result-pattern" | "promise-catch" | "throw" | "mixed" = "mixed"
    const max = Math.max(tryCatch, resultPattern, promiseCatch)
    if (resultPattern === max && resultPattern > 5) style = "result-pattern"
    else if (promiseCatch === max && promiseCatch > 5) style = "promise-catch"
    else if (tryCatch === max && tryCatch > 5) style = "try-catch"

    const rule = style !== "mixed" ? `Use ${style} for error handling` : undefined

    return { guide: { style, examples }, examples, rule }
  }

  function analyzeImports(files: FileStructure[]): { guide: PatternTypes.StyleGuide["imports"], rule?: string } {
    let named = 0, defaultImport = 0
    let relative = 0, absolute = 0, alias = 0

    for (const file of files) {
      named += (file.content.match(/import\s*\{/g) || []).length
      defaultImport += (file.content.match(/import\s+\w+\s+from/g) || []).length
      
      relative += (file.content.match(/from\s+["']\.\//g) || []).length
      relative += (file.content.match(/from\s+["']\.\.\//g) || []).length
      absolute += (file.content.match(/from\s+["'][^.@]/g) || []).length
      alias += (file.content.match(/from\s+["']@\//g) || []).length
    }

    const style = named > defaultImport ? "named" : "default"
    let pathStyle: "relative" | "absolute" | "alias" | "mixed" = "mixed"
    const maxPath = Math.max(relative, absolute, alias)
    if (alias === maxPath && alias > 5) pathStyle = "alias"
    else if (relative === maxPath) pathStyle = "relative"
    else if (absolute === maxPath) pathStyle = "absolute"

    const rule = `Use ${style} imports with ${pathStyle} paths`

    return { guide: { style, pathStyle }, rule }
  }

  function analyzeOrganization(files: FileStructure[]): { guide: PatternTypes.StyleGuide["organization"], rule?: string } {
    let namespaces = 0, classes = 0, functions = 0

    for (const file of files) {
      namespaces += (file.content.match(/export\s+namespace\s+/g) || []).length
      classes += (file.content.match(/export\s+(class|abstract\s+class)\s+/g) || []).length
      functions += (file.content.match(/export\s+(function|const\s+\w+\s*=)/g) || []).length
    }

    let style: "namespaces" | "classes" | "functions" | "modules" | "mixed" = "mixed"
    const max = Math.max(namespaces, classes, functions)
    if (namespaces === max && namespaces > 3) style = "namespaces"
    else if (classes === max && classes > 3) style = "classes"
    else if (functions === max && functions > 3) style = "functions"

    const rule = style !== "mixed" ? `Organize code using ${style}` : undefined

    return { guide: { style, exportStyle: "named" }, rule }
  }

  function analyzeTypes(files: FileStructure[]): { guide: PatternTypes.StyleGuide["types"], rule?: string } {
    let interfaces = 0, types = 0, zod = 0, any = 0

    for (const file of files) {
      if (file.language !== "typescript") continue
      interfaces += (file.content.match(/interface\s+\w+/g) || []).length
      types += (file.content.match(/type\s+\w+\s*=/g) || []).length
      zod += (file.content.match(/z\.\w+\(/g) || []).length
      any += (file.content.match(/:\s*any\b/g) || []).length
    }

    const preferInterface = interfaces > types
    const useZod = zod > 10
    const style = any > 10 ? "loose" : "strict"

    const rules: string[] = []
    if (useZod) rules.push("Use Zod for runtime validation")
    if (preferInterface) rules.push("Prefer interfaces over type aliases")
    rules.push(`Use ${style} typing`)

    return { 
      guide: { style, preferInterface, useZod }, 
      rule: rules.join(", ") 
    }
  }
}
