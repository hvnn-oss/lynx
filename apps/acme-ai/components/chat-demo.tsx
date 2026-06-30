"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bot, Send, Sparkles, UserRound } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type ChatResponse = {
  message?: ChatMessage;
  error?: string;
};

const STARTER_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Hi, I am Acme AI. Ask me a support question, then open Lynx to inspect the recorded session, LLM call, tool call, and outcome.",
  },
];

const EXAMPLE_PROMPTS = [
  "Can you check whether my enterprise workspace is healthy?",
  "Summarize the last support signal for customer cus_demo_123.",
  "Draft a short response for a customer waiting on an SLA update.",
];

function createBrowserSessionId() {
  if (typeof window === "undefined") return "acme-ai-demo-session";

  const existingSessionId = window.localStorage.getItem("acme-ai-session-id");
  if (existingSessionId) return existingSessionId;

  const nextSessionId = `acme-ai-${crypto.randomUUID()}`;
  window.localStorage.setItem("acme-ai-session-id", nextSessionId);
  return nextSessionId;
}

export function ChatDemo() {
  const sessionId = useMemo(createBrowserSessionId, []);
  const [messages, setMessages] = useState<ChatMessage[]>(STARTER_MESSAGES);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function sendMessage(forceError = false) {
    const trimmedInput = forceError
      ? "Trigger the failing CRM lookup path."
      : input.trim();

    if (!trimmedInput || isSending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedInput,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setLastError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lynx-session-id": sessionId,
        },
        body: JSON.stringify({
          messages: nextMessages,
          forceError,
        }),
      });

      const body = (await response.json()) as ChatResponse;

      if (!response.ok || body.error) {
        throw new Error(body.error ?? "The demo request failed.");
      }

      const assistantMessage = body.message;
      if (assistantMessage) {
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            ...assistantMessage,
            id: assistantMessage.id ?? crypto.randomUUID(),
          },
        ]);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The demo request failed.";
      setLastError(message);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `The demo run failed on purpose: ${message}`,
        },
      ]);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(false);
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" />
              Lynx SDK demo
            </div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">
              Acme AI
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A GPT-style support app that records user input, context loading,
              OpenAI calls, tool calls, and failed outcomes with Lynx.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Session</div>
            <div className="mt-0.5 max-w-[260px] truncate font-mono">
              {sessionId}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-border bg-background p-4">
              <h2 className="text-sm font-semibold">Demo controls</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Send a normal prompt or trigger a failing tool call to inspect
                the error path in Lynx.
              </p>

              <div className="mt-4 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => void sendMessage(false)}
                  disabled={isSending || input.trim().length === 0}
                >
                  <Send className="size-4" />
                  Send prompt
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="justify-start"
                  onClick={() => void sendMessage(true)}
                  disabled={isSending}
                >
                  <AlertTriangle className="size-4" />
                  Trigger tool error
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-background p-4">
              <h2 className="text-sm font-semibold">Try a prompt</h2>
              <div className="mt-3 flex flex-col gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-background p-4">
              <h2 className="text-sm font-semibold">Captured by Lynx</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Run and session context</li>
                <li>User input and agent decision</li>
                <li>OpenAI Responses API call</li>
                <li>CRM context tool result or error</li>
                <li>Final session outcome</li>
              </ul>
            </section>
          </aside>

          <section className="flex min-h-[680px] flex-col rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Chat</h2>
                <p className="text-xs text-muted-foreground">
                  Every request creates a traceable AcmeSupportGPT run.
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-xs font-medium",
                  isSending
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700",
                )}
              >
                {isSending ? "Running" : "Ready"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {isSending ? (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex size-8 items-center justify-center rounded-full border border-border bg-muted">
                      <Bot className="size-4" />
                    </div>
                    Acme AI is thinking...
                  </div>
                ) : null}
              </div>
            </div>

            {lastError ? (
              <div className="border-t border-border bg-destructive/5 px-4 py-2 text-sm text-destructive">
                {lastError}
              </div>
            ) : null}

            <form
              className="border-t border-border bg-muted/20 p-4"
              onSubmit={handleSubmit}
            >
              <div className="mx-auto flex max-w-3xl gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask Acme AI a support question..."
                  rows={2}
                  className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage(false);
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="icon-lg"
                  disabled={isSending || input.trim().length === 0}
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <article
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser ? (
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
          <Bot className="size-4" />
        </div>
      ) : null}

      <div
        className={cn(
          "max-w-[82%] rounded-lg border px-4 py-3 text-sm leading-6",
          isUser
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-muted/40 text-foreground",
        )}
      >
        {message.content}
      </div>

      {isUser ? (
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background">
          <UserRound className="size-4" />
        </div>
      ) : null}
    </article>
  );
}
