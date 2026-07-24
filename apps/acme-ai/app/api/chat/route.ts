import { NextRequest, NextResponse } from "next/server";
import { LynxTracer } from "@lynxops/sdk";

export const runtime = "nodejs";

type IncomingMessage = {
  role?: string;
  content?: string;
};

type AccountContext = {
  customerId: string;
  plan: string;
  health: "healthy" | "degraded";
  openTickets: number;
  lastSignal: string;
};

type OpenAIResponsesRequest = {
  model: string;
  input: Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
  max_output_tokens: number;
  metadata: Record<string, string>;
};

const tracer = new LynxTracer({
  clientId: process.env.LYNX_CLIENT_ID ?? "acme-ai-demo",
  apiKey: process.env.LYNX_API_KEY,
  workspaceId: process.env.LYNX_WORKSPACE_ID,
  endpoint: process.env.LYNX_ENDPOINT,
  environment: process.env.LYNX_ENVIRONMENT ?? process.env.NODE_ENV,
  appVersion: "acme-ai-demo",
  captureMode: "smart",
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
    cooldownMs: 15000,
  },
});

const openAI = tracer.instrumentLLM(
  {
    responses: {
      create: createOpenAIResponse,
    },
  },
  {
    modelLabel: "openai.responses.create",
    customRule: {
      extractInput: ([request]) => request,
      extractOutput: (result) => ({
        id: result?.id,
        model: result?.model,
        outputText: extractResponseText(result),
        status: result?.status,
      }),
      extractUsage: (result) => {
        const usage = result?.usage;
        if (!usage) return undefined;

        const promptTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
        const completionTokens =
          usage.output_tokens ?? usage.completion_tokens ?? 0;

        return {
          promptTokens,
          completionTokens,
          totalTokens:
            usage.total_tokens ?? promptTokens + completionTokens,
        };
      },
    },
  },
);

const loadAccountContext = tracer.instrumentTool(
  "acme.crm.loadAccountContext",
  async ({
    customerId,
    forceError,
  }: {
    customerId: string;
    forceError: boolean;
  }): Promise<AccountContext> => {
    await delay(180);

    if (forceError) {
      throw new Error("Simulated CRM timeout while loading account context.");
    }

    return {
      customerId,
      plan: "Enterprise",
      health: "degraded",
      openTickets: 3,
      lastSignal: "API latency increased after the last workflow rollout.",
    };
  },
  {
    toolVersion: "demo-v1",
    sideEffect: false,
    riskLevel: "LOW",
    externalTarget: "acme-crm",
  },
);

export async function POST(request: NextRequest) {
  const sessionId =
    request.headers.get("x-lynx-session-id") ?? `acme-ai-${crypto.randomUUID()}`;

  try {
    const body = (await request.json()) as {
      messages?: IncomingMessage[];
      forceError?: boolean;
    };

    const messages = normalizeMessages(body.messages);
    const latestUserMessage =
      [...messages].reverse().find((message) => message.role === "user")
        ?.content ?? "Hello";
    const forceError = body.forceError === true;

    const result = await tracer.run(
      {
        agentName: "AcmeSupportGPT",
        agentId: "acme-support-gpt",
        sessionId,
        workspaceId: process.env.LYNX_WORKSPACE_ID,
      },
      async () => {
        tracer.setAttributes({
          demoApp: "acme-ai",
          promptVersion: "acme-support-v1",
          trigger: forceError ? "forced-tool-error" : "chat",
        });
        tracer.userInput(latestUserMessage, {
          channel: "acme-ai-web",
          sessionId,
        });

        try {
          const accountContext = await loadAccountContext({
            customerId: "cus_demo_123",
            forceError,
          });

          tracer.context("crm.accountContext", accountContext, {
            source: "acme-crm",
          });
          tracer.decision({
            name: "select_response_strategy",
            selected: "openai.responses",
            confidence: 0.84,
            reason:
              "The request needs account context and a concise customer-facing answer.",
            metadata: {
              promptVersion: "acme-support-v1",
              model: getOpenAIModel(),
            },
          });

          const response = await openAI.responses.create({
            model: getOpenAIModel(),
            input: [
              {
                role: "system",
                content:
                  "You are Acme AI, a concise customer support assistant. Use the account context, mention uncertainty when needed, and avoid inventing internal data.",
              },
              {
                role: "user",
                content: buildPrompt(messages, accountContext),
              },
            ],
            temperature: 0.3,
            max_output_tokens: 450,
            metadata: {
              app: "acme-ai",
              promptVersion: "acme-support-v1",
            },
          });

          const assistantText =
            extractResponseText(response) ??
            "I could not read the model response.";

          tracer.outcome({
            status: "COMPLETED",
            businessStatus: "SUCCEEDED",
            reason: "Support answer generated.",
            userImpact: "LOW",
          });

          return {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: assistantText,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Acme AI failed.";

          tracer.outcome({
            status: "FAILED",
            businessStatus: "FAILED",
            reason: message,
            userImpact: "MEDIUM",
            metadata: {
              forceError,
            },
          });

          throw error;
        }
      },
    );

    await tracer.flush().catch(() => undefined);

    return NextResponse.json({
      message: result,
      sessionId,
    });
  } catch (error) {
    await tracer.flush().catch(() => undefined);

    const message =
      error instanceof Error ? error.message : "Acme AI request failed.";

    return NextResponse.json(
      {
        error: message,
        sessionId,
      },
      { status: 500 },
    );
  }
}

async function createOpenAIResponse(request: OpenAIResponsesRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      body?.error?.message ?? `OpenAI request failed with ${response.status}.`;
    throw new Error(errorMessage);
  }

  return body;
}

function normalizeMessages(messages: IncomingMessage[] | undefined) {
  return (messages ?? [])
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-12)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content!.trim(),
    }));
}

function buildPrompt(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  accountContext: AccountContext,
) {
  const conversation = messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  return [
    `Account context: ${JSON.stringify(accountContext)}`,
    "",
    "Conversation:",
    conversation,
    "",
    "Answer the latest user message in a helpful, concise way.",
  ].join("\n");
}

function extractResponseText(response: any): string | undefined {
  if (typeof response?.output_text === "string") {
    return response.output_text;
  }

  const output = response?.output;
  if (!Array.isArray(output)) return undefined;

  const chunks: string[] = [];
  for (const item of output) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim() || undefined;
}

function getOpenAIModel() {
  return process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
