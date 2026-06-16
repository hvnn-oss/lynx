export const PROMPT_TYPE = {
  SYSTEM: "SYSTEM",
  SAFETY: "SAFETY",
  TOOL: "TOOL",
  FORMATTING: "FORMATTING",
  CUSTOM: "CUSTOM",
};

export type PromptType = (typeof PROMPT_TYPE)[keyof typeof PROMPT_TYPE];
