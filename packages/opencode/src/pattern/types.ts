import z from "zod"

export namespace PatternTypes {
  export const PatternInstance = z.object({
    file: z.string(),
    lineStart: z.number(),
    lineEnd: z.number(),
    hash: z.string(),
    content: z.string(),
  })
  export type PatternInstance = z.infer<typeof PatternInstance>

  export const PatternPlaceholder = z.object({
    name: z.string(),
    type: z.enum(["variable", "expression", "block", "identifier"]),
    inferenceHints: z.array(z.string()),
  })
  export type PatternPlaceholder = z.infer<typeof PatternPlaceholder>

  export const PatternTemplate = z.object({
    skeleton: z.string(),
    placeholders: z.array(PatternPlaceholder),
  })
  export type PatternTemplate = z.infer<typeof PatternTemplate>

  export const PatternSemantics = z.object({
    intentTags: z.array(z.string()),
    contextRequirements: z.array(z.string()),
    relatedPatterns: z.array(z.string()),
  })
  export type PatternSemantics = z.infer<typeof PatternSemantics>

  export const PatternConventions = z.object({
    naming: z.string().optional(),
    structure: z.string().optional(),
    errorHandling: z.string().optional(),
    imports: z.array(z.string()).optional(),
  })
  export type PatternConventions = z.infer<typeof PatternConventions>

  // Project-wide style guide derived from the codebase
  export const StyleGuide = z.object({
    // Commenting style
    comments: z.object({
      style: z.enum(["jsdoc", "inline", "block", "none", "mixed"]).optional(),
      density: z.enum(["heavy", "moderate", "minimal", "none"]).optional(),
      examples: z.array(z.string()).optional(),
    }).optional(),
    
    // Naming conventions
    naming: z.object({
      variables: z.enum(["camelCase", "snake_case", "PascalCase", "SCREAMING_SNAKE"]).optional(),
      functions: z.enum(["camelCase", "snake_case", "PascalCase"]).optional(),
      classes: z.enum(["PascalCase", "camelCase"]).optional(),
      constants: z.enum(["SCREAMING_SNAKE", "camelCase", "PascalCase"]).optional(),
      files: z.enum(["kebab-case", "camelCase", "PascalCase", "snake_case"]).optional(),
    }).optional(),
    
    // Formatting
    formatting: z.object({
      semicolons: z.boolean().optional(),
      quotes: z.enum(["single", "double", "backtick"]).optional(),
      indentation: z.enum(["tabs", "2-spaces", "4-spaces"]).optional(),
      trailingCommas: z.boolean().optional(),
      maxLineLength: z.number().optional(),
    }).optional(),
    
    // Error handling
    errorHandling: z.object({
      style: z.enum(["try-catch", "result-pattern", "promise-catch", "throw", "mixed"]).optional(),
      examples: z.array(z.string()).optional(),
    }).optional(),
    
    // Import style
    imports: z.object({
      style: z.enum(["named", "default", "mixed"]).optional(),
      ordering: z.enum(["grouped", "alphabetical", "none"]).optional(),
      pathStyle: z.enum(["relative", "absolute", "alias", "mixed"]).optional(),
    }).optional(),
    
    // Code organization
    organization: z.object({
      style: z.enum(["namespaces", "classes", "functions", "modules", "mixed"]).optional(),
      exportStyle: z.enum(["named", "default", "mixed"]).optional(),
    }).optional(),
    
    // Type usage (for typed languages)
    types: z.object({
      style: z.enum(["strict", "loose", "inferred"]).optional(),
      preferInterface: z.boolean().optional(),
      useZod: z.boolean().optional(),
    }).optional(),
  })
  export type StyleGuide = z.infer<typeof StyleGuide>

  export const ProjectStyle = z.object({
    guide: StyleGuide,
    examples: z.record(z.string(), z.array(z.string())), // category -> code snippets
    rules: z.array(z.string()), // Human-readable style rules
  })
  export type ProjectStyle = z.infer<typeof ProjectStyle>

  export const PatternType = z.enum([
    "component",
    "service",
    "api",
    "hook",
    "utility",
    "test",
    "config",
    "model",
    "controller",
    "middleware",
    "documentation",
    "readme",
    "changelog",
    "unknown",
  ])

  export const PatternMode = z.enum([
    "build",    // Code generation patterns
    "doc",      // Documentation patterns
    "all",      // Applicable to all modes
  ])

  export const Pattern = z.object({
    signature: z.string(),
    type: PatternType,
    mode: PatternMode,
    confidence: z.number().min(0).max(1),
    instances: z.array(PatternInstance),
    template: PatternTemplate,
    semantics: PatternSemantics,
    conventions: PatternConventions,
    language: z.string(),
  })
  export type Pattern = z.infer<typeof Pattern>

  export const PatternRelationship = z.object({
    oftenCombinedWith: z.array(z.string()),
    mutuallyExclusive: z.array(z.string()),
    evolutionPath: z.array(z.string()),
  })
  export type PatternRelationship = z.infer<typeof PatternRelationship>

  export const PatternMetadata = z.object({
    generated: z.number(),
    version: z.string(),
    projectHash: z.string(),
    fileCount: z.number(),
    totalPatterns: z.number(),
    languages: z.array(z.string()),
  })
  export type PatternMetadata = z.infer<typeof PatternMetadata>

  export const ProjectPatterns = z.object({
    metadata: PatternMetadata,
    patterns: z.record(z.string(), Pattern),
    relationships: z.record(z.string(), PatternRelationship),
    style: ProjectStyle.optional(),
  })
  export type ProjectPatterns = z.infer<typeof ProjectPatterns>

  export const PATTERN_VERSION = "1.0.0"
  export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

  export const SUPPORTED_EXTENSIONS: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".kt": "kotlin",
    ".swift": "swift",
    ".rb": "ruby",
    ".php": "php",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".vue": "vue",
    ".svelte": "svelte",
  }
}
