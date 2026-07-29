import { TokenUsage } from "../core/types.js";

/**
 * Extracts normalized token usage from common provider and framework responses.
 *
 * @param result Provider response that may contain usage metadata.
 * @returns Normalized prompt, completion, and total token counts when available.
 */
export function extractTokenUsage(result: any): TokenUsage | undefined {
  if (!result || typeof result !== "object") return undefined;

  const usage =
    result.usage ??
    result.llmOutput?.tokenUsage ??
    result.generationInfo?.tokenUsage ??
    result.response_metadata?.tokenUsage ??
    result.response_metadata?.usage;
  if (usage) {
    const promptTokens =
      usage.prompt_tokens ??
      usage.input_tokens ??
      usage.promptTokens ??
      usage.inputTokens ??
      0;
    const completionTokens =
      usage.completion_tokens ??
      usage.output_tokens ??
      usage.completionTokens ??
      usage.outputTokens ??
      0;
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  const usageMetadata = result.usageMetadata;
  if (usageMetadata) {
    const promptTokens = usageMetadata.promptTokenCount ?? 0;
    const completionTokens =
      usageMetadata.candidatesTokenCount ??
      usageMetadata.completionTokenCount ??
      0;
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  return undefined;
}
