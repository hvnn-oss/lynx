import { NextRequest, NextResponse } from "next/server";
import { LynxPolicyError, LynxTracer } from "@lynxops/sdk";

export const runtime = "nodejs";

type ProviderId = "openai" | "anthropic" | "gemini";
type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatRequest = {
  messages?: Array<Partial<ChatMessage>>;
  provider?: ProviderId;
  model?: string;
  toolsEnabled?: boolean;
  settings?: Partial<ChatSettings>;
};
type ChatSettings = {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  responseStyle: "concise" | "balanced" | "detailed";
  language: "auto" | "ko" | "en";
  contextMessages: number;
  memoryEnabled: boolean;
  calculatorEnabled: boolean;
  workspaceSearchEnabled: boolean;
  externalActionsEnabled: boolean;
  captureInput: boolean;
  captureOutput: boolean;
};
type ModelOption = {
  provider: ProviderId;
  model: string;
  label: string;
  configured: boolean;
};
type ProviderRequest = {
  provider: ProviderId;
  model: string;
  messages: ChatMessage[];
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  captureOutput: boolean;
};
type ProviderResult = {
  text: string;
  provider: ProviderId;
  model: string;
  captureOutput: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

const DEFAULT_SYSTEM_PROMPT =
  "You are Orbit, a capable general-purpose AI assistant. Be accurate, direct, and useful. If tool context is provided, use it without inventing additional facts.";
const lynxApiKey = getValidLynxApiKey();

const tracer = new LynxTracer({
  clientId: process.env.LYNX_CLIENT_ID ?? "orbit-chat",
  apiKey: lynxApiKey,
  workspaceId: process.env.LYNX_WORKSPACE_ID,
  endpoint: process.env.LYNX_ENDPOINT,
  environment: process.env.LYNX_ENVIRONMENT ?? process.env.NODE_ENV,
  agentId: "orbit-assistant",
  appVersion: "orbit-chat-v1",
  captureMode: "smart",
  runtimeConfig: {
    enabled: Boolean(lynxApiKey),
    refreshIntervalMs: 60_000,
  },
  delivery: {
    mode: "BACKGROUND",
    timeoutMs: 1000,
    flushOnRunEnd: false,
    flushIntervalMs: 2000,
    batchSize: 10,
    maxQueueSize: 500,
    overflowStrategy: "DROP_OLDEST",
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 2,
    cooldownMs: 15_000,
  },
});

const callModel = tracer.instrumentLLM(callProvider, {
  modelLabel: "orbit.provider.generate",
  customRule: {
    extractInput: ([request]) => ({
      provider: request.provider,
      model: request.model,
      messages: request.messages,
      systemPrompt: request.systemPrompt,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    }),
    extractOutput: (result) => ({
      provider: result.provider,
      model: result.model,
      ...(result.captureOutput ? { text: result.text } : { redacted: true }),
    }),
    extractUsage: (result) => result.usage,
  },
});

const calculate = tracer.instrumentTool(
  "orbit.calculator.evaluate",
  async ({ expression }: { expression: string }) => {
    if (!/^[\d+\-*/().%\s]+$/.test(expression)) {
      throw new Error("The calculator only accepts arithmetic expressions.");
    }
    const value = Function(`"use strict"; return (${expression})`)();
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("The expression did not produce a finite number.");
    }
    return { expression, value };
  },
  { toolVersion: "1", sideEffect: false, riskLevel: "LOW" },
);

const searchWorkspace = tracer.instrumentTool(
  "orbit.workspace.search",
  async ({ query }: { query: string }) => ({
    query,
    results: [
      {
        title: "Q3 product brief",
        excerpt:
          "The team is prioritizing reliability, faster onboarding, and clearer usage reporting.",
      },
      {
        title: "Weekly engineering update",
        excerpt:
          "API latency improved after the cache rollout. One authentication issue remains under review.",
      },
    ],
  }),
  {
    toolVersion: "1",
    sideEffect: false,
    riskLevel: "LOW",
    externalTarget: "orbit-workspace",
  },
);

const performExternalAction = tracer.firewallTool(
  "orbit.external.execute",
  async ({ action }: { action: string }) => ({ completed: true, action }),
  {
    toolVersion: "1",
    sideEffect: true,
    riskLevel: "HIGH",
    failureMode: "FAIL_CLOSED",
    beforeCall: ({ input }) => ({
      action: "BLOCK",
      policyId: "orbit-sensitive-action",
      policyVersion: "1",
      severity: "HIGH",
      reason: `Sensitive action requires explicit approval: ${input.action}`,
    }),
  },
);

export function GET() {
  const models = getModels();
  return NextResponse.json({
    models,
    defaultModel: models.find((model) => model.configured) ?? models[0] ?? null,
    lynxConnected: Boolean(lynxApiKey),
  });
}

export async function POST(request: NextRequest) {
  const sessionId =
    request.headers.get("x-lynx-session-id") ?? `orbit-${crypto.randomUUID()}`;

  try {
    const body = (await request.json()) as ChatRequest;
    const settings = normalizeSettings(body.settings);
    const messages = normalizeMessages(body.messages, settings.contextMessages);
    const latestMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!latestMessage) {
      return NextResponse.json(
        { error: "Enter a message to continue." },
        { status: 400 },
      );
    }

    const selectedModel = resolveModel(body.provider, body.model);
    if (!selectedModel.configured) {
      return NextResponse.json(
        {
          error: `${selectedModel.label} is not configured on this server.`,
        },
        { status: 503 },
      );
    }

    const message = await tracer.run(
      {
        agentName: "OrbitAssistant",
        agentId: "orbit-assistant",
        sessionId,
      },
      async () => {
        tracer.setAttributes({
          app: "orbit-chat",
          provider: selectedModel.provider,
          model: selectedModel.model,
        });
        if (settings.captureInput) {
          tracer.userInput(latestMessage.content, {
            channel: "web",
            sessionId,
          });
        }
        if (settings.memoryEnabled) {
          tracer.memory("read", {
            messageCount: messages.length,
            recentTurns: messages.length,
          });
        }

        try {
          tracer.firewallInput(latestMessage.content, {
            label: "orbit.chat.input",
            riskLevel: "LOW",
          });
          const toolContext =
            body.toolsEnabled === false
              ? undefined
              : await resolveToolContext(latestMessage.content, settings);
          if (toolContext) {
            tracer.context("tool.context", toolContext, {
              source: toolContext.tool,
            });
          }

          const prompt = await getSystemPrompt(settings);
          tracer.decision({
            name: "select_model_and_context",
            selected: `${selectedModel.provider}:${selectedModel.model}`,
            reason: toolContext
              ? "A relevant tool supplied additional context before generation."
              : "The request can be answered directly by the selected model.",
            metadata: { usedTool: toolContext?.tool ?? null },
          });

          const result = await callModel({
            provider: selectedModel.provider,
            model: selectedModel.model,
            systemPrompt: prompt.content,
            messages: appendToolContext(messages, toolContext),
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            captureOutput: settings.captureOutput,
          });
          tracer.firewallOutput(result.text, {
            label: "orbit.chat.output",
            riskLevel: "LOW",
          });

          if (settings.memoryEnabled) {
            tracer.memory("write", {
              role: "assistant",
              chars: result.text.length,
            });
          }
          tracer.outcome({
            status: "COMPLETED",
            businessStatus: "SUCCEEDED",
            reason: "Assistant response generated.",
            userImpact: "LOW",
            metadata: {
              provider: result.provider,
              model: result.model,
              promptVersion: prompt.version,
            },
          });

          return {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: result.text,
            provider: result.provider,
            model: result.model,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Orbit request failed.";
          tracer.outcome({
            status: "FAILED",
            businessStatus: "FAILED",
            reason: errorMessage,
            userImpact: "MEDIUM",
            metadata: {
              firewallBlocked: error instanceof LynxPolicyError,
            },
          });
          throw error;
        }
      },
    );

    await tracer.flush().catch(() => undefined);
    return NextResponse.json({ message, sessionId });
  } catch (error) {
    await tracer.flush().catch(() => undefined);
    const message =
      error instanceof Error ? error.message : "Orbit request failed.";
    return NextResponse.json(
      {
        error: message,
        code: error instanceof LynxPolicyError ? "FIREWALL_BLOCKED" : undefined,
        sessionId,
      },
      { status: error instanceof LynxPolicyError ? 403 : 500 },
    );
  }
}

async function resolveToolContext(input: string, settings: ChatSettings) {
  const lower = input.toLowerCase();
  const expression = input.match(
    /(?:calculate|compute|what is|계산(?:해|해줘)?)[\s:]*([\d+\-*/().%\s]+)/i,
  )?.[1];
  if (settings.calculatorEnabled && expression?.trim()) {
    return { tool: "calculator", result: await calculate({ expression }) };
  }

  if (
    settings.workspaceSearchEnabled &&
    /(workspace|document|brief|engineering update|문서|워크스페이스|업데이트)/i.test(
      input,
    )
  ) {
    return {
      tool: "workspace_search",
      result: await searchWorkspace({ query: input }),
    };
  }

  if (
    settings.externalActionsEnabled &&
    /(delete|remove|send email|publish|삭제|제거|메일 보내|게시)/i.test(lower)
  ) {
    return {
      tool: "external_action",
      result: await performExternalAction({ action: input }),
    };
  }

  return undefined;
}

async function getSystemPrompt(settings: ChatSettings) {
  const preferencePrompt = [
    settings.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
    `Response style: ${settings.responseStyle}.`,
    settings.language === "auto"
      ? "Reply in the user's language."
      : `Reply in ${settings.language === "ko" ? "Korean" : "English"}.`,
  ].join("\n");
  const promptName = process.env.LYNX_PROMPT_NAME;
  if (promptName && lynxApiKey) {
    try {
      const prompt = await tracer.getPrompt(promptName);
      return {
        content: `${prompt.content}\n${preferencePrompt}`,
        version: prompt.version,
      };
    } catch {
      // Chat remains available when the control plane is temporarily unavailable.
    }
  }
  return { content: preferencePrompt, version: "local-v1" };
}

function getModels(): ModelOption[] {
  return [
    {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      label: "OpenAI",
      configured: Boolean(process.env.OPENAI_API_KEY),
    },
    {
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
      label: "Claude",
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    {
      provider: "gemini",
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      label: "Gemini",
      configured: Boolean(process.env.GEMINI_API_KEY),
    },
  ];
}

function resolveModel(provider?: ProviderId, model?: string) {
  const models = getModels();
  const selected =
    models.find(
      (option) =>
        option.provider === provider && (!model || option.model === model),
    ) ??
    models.find((option) => option.configured) ??
    models[0];
  if (!selected) throw new Error("No model providers are available.");
  return selected;
}

/** 클라이언트 메시지를 Provider 공통 입력 필드로 제한하고 정규화합니다. */
function normalizeMessages(
  messages: ChatRequest["messages"],
  contextMessages: number,
): ChatMessage[] {
  return (messages ?? [])
    .filter(
      (message): message is ChatMessage =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-contextMessages)
    .map((message) => ({
      // 화면용 id 등 Provider 계약에 없는 필드는 외부 요청에 전달하지 않습니다.
      role: message.role,
      content: message.content.trim(),
    }));
}

function appendToolContext(
  messages: ChatMessage[],
  context: Awaited<ReturnType<typeof resolveToolContext>>,
) {
  if (!context) return messages;
  return [
    ...messages,
    {
      role: "user" as const,
      content: `Tool context for the previous request:\n${JSON.stringify(context.result)}`,
    },
  ];
}

async function callProvider(request: ProviderRequest): Promise<ProviderResult> {
  if (request.provider === "anthropic") return callAnthropic(request);
  if (request.provider === "gemini") return callGemini(request);
  return callOpenAI(request);
}

async function callOpenAI(request: ProviderRequest): Promise<ProviderResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      instructions: request.systemPrompt,
      input: request.messages,
      temperature: request.temperature,
      max_output_tokens: request.maxTokens,
    }),
  });
  const body = await readProviderBody(response, "OpenAI");
  const text =
    body.output_text ??
    body.output
      ?.flatMap((item: any) => item.content ?? [])
      .map((part: any) => part.text)
      .filter(Boolean)
      .join("\n");
  return {
    text: requireText(text),
    provider: "openai",
    model: body.model ?? request.model,
    captureOutput: request.captureOutput,
    usage: normalizeUsage(body.usage, "input_tokens", "output_tokens"),
  };
}

async function callAnthropic(
  request: ProviderRequest,
): Promise<ProviderResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": requireEnv("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      system: request.systemPrompt,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    }),
  });
  const body = await readProviderBody(response, "Anthropic");
  return {
    text: requireText(
      body.content
        ?.map((part: any) => (part.type === "text" ? part.text : ""))
        .join("\n"),
    ),
    provider: "anthropic",
    model: body.model ?? request.model,
    captureOutput: request.captureOutput,
    usage: normalizeUsage(body.usage, "input_tokens", "output_tokens"),
  };
}

async function callGemini(request: ProviderRequest): Promise<ProviderResult> {
  const key = encodeURIComponent(requireEnv("GEMINI_API_KEY"));
  const model = encodeURIComponent(request.model);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: request.messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      }),
    },
  );
  const body = await readProviderBody(response, "Gemini");
  const usage = body.usageMetadata;
  return {
    text: requireText(
      body.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text)
        .filter(Boolean)
        .join("\n"),
    ),
    provider: "gemini",
    model: request.model,
    captureOutput: request.captureOutput,
    usage: usage
      ? {
          promptTokens: usage.promptTokenCount ?? 0,
          completionTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

async function readProviderBody(response: Response, provider: string) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      body?.error?.message ??
        `${provider} request failed with status ${response.status}.`,
    );
  }
  return body;
}

function normalizeUsage(usage: any, promptKey: string, completionKey: string) {
  if (!usage) return undefined;
  const promptTokens = usage[promptKey] ?? 0;
  const completionTokens = usage[completionKey] ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.total_tokens ?? promptTokens + completionTokens,
  };
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function getValidLynxApiKey() {
  const value = process.env.LYNX_API_KEY?.trim();
  if (!value) return undefined;
  return /^lynx_[^_]+_[0-9a-f-]{36}_.+$/i.test(value) ? value : undefined;
}

function normalizeSettings(input?: Partial<ChatSettings>): ChatSettings {
  return {
    temperature: clampNumber(input?.temperature, 0.7, 0, 2),
    maxTokens: Math.round(clampNumber(input?.maxTokens, 900, 128, 4096)),
    systemPrompt:
      typeof input?.systemPrompt === "string"
        ? input.systemPrompt.slice(0, 8_000)
        : "",
    responseStyle: includes(
      ["concise", "balanced", "detailed"],
      input?.responseStyle,
    )
      ? input.responseStyle
      : "balanced",
    language: includes(["auto", "ko", "en"], input?.language)
      ? input.language
      : "auto",
    contextMessages: Math.round(clampNumber(input?.contextMessages, 16, 2, 40)),
    memoryEnabled: input?.memoryEnabled !== false,
    calculatorEnabled: input?.calculatorEnabled !== false,
    workspaceSearchEnabled: input?.workspaceSearchEnabled !== false,
    externalActionsEnabled: input?.externalActionsEnabled === true,
    captureInput: input?.captureInput !== false,
    captureOutput: input?.captureOutput !== false,
  };
}

function clampNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function includes<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function requireText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("The model returned an empty response.");
  }
  return value.trim();
}
