import type { LanguageModelV2FinishReason } from "@ai-sdk/provider"

export function mapOpenAIResponseFinishReason({
  finishReason,
  hasFunctionCall,
}: {
  finishReason: string | Record<string, unknown> | null | undefined
  // flag that checks if there have been client-side tool calls (not executed by openai)
  hasFunctionCall: boolean
}): LanguageModelV2FinishReason {
  // Handle object reason (some models return an object instead of string)
  const reasonStr = typeof finishReason === "object" && finishReason !== null
    ? (finishReason as Record<string, unknown>).type as string ?? JSON.stringify(finishReason)
    : finishReason

  switch (reasonStr) {
    case undefined:
    case null:
      return hasFunctionCall ? "tool-calls" : "stop"
    case "max_output_tokens":
      return "length"
    case "content_filter":
      return "content-filter"
    default:
      return hasFunctionCall ? "tool-calls" : "unknown"
  }
}
