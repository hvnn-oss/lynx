"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Database,
  Eye,
  Gauge,
  LockKeyhole,
  Menu,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  provider?: string;
  model?: string;
};
type ModelOption = {
  provider: "openai" | "anthropic" | "gemini";
  model: string;
  label: string;
  configured: boolean;
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
type SettingsMetadata = {
  providers: Array<{
    id: string;
    label: string;
    configured: boolean;
    model: string;
  }>;
  lynx: {
    connected: boolean;
    endpoint: string;
    workspaceConfigured: boolean;
    managedPrompt: string | null;
    environment: string;
  };
};

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello — I’m Orbit. Ask a question, work through an idea, summarize a document, or use one of the available tools.",
};
const SUGGESTIONS = [
  {
    title: "Plan a project",
    prompt: "Create a practical launch plan for a small SaaS product.",
  },
  {
    title: "Analyze information",
    prompt: "Compare REST and GraphQL for a new public API.",
  },
  { title: "Use the calculator", prompt: "Calculate (128 * 37) + 450." },
  {
    title: "Search my workspace",
    prompt: "Summarize the latest engineering update in my workspace.",
  },
];

function createSessionId() {
  if (typeof window === "undefined") return "orbit-session";
  const current = window.localStorage.getItem("orbit-session-id");
  if (current) return current;
  const next = `orbit-${crypto.randomUUID()}`;
  window.localStorage.setItem("orbit-session-id", next);
  return next;
}

export function ChatDemo() {
  const sessionId = useMemo(createSessionId, []);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void fetch("/api/chat")
      .then((response) => response.json())
      .then((body) => {
        setModels(body.models ?? []);
        setSelectedModel(body.defaultModel ?? null);
      })
      .catch(() => setError("Could not load the available models."));
  }, []);

  function startNewChat() {
    window.localStorage.setItem(
      "orbit-session-id",
      `orbit-${crypto.randomUUID()}`,
    );
    window.location.reload();
  }

  async function sendMessage(prompt = input) {
    const content = prompt.trim();
    if (!content || isSending) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
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
          provider: selectedModel?.provider,
          model: selectedModel?.model,
          toolsEnabled,
        }),
      });
      const body = await response.json();
      if (!response.ok || body.error)
        throw new Error(body.error ?? "Request failed.");
      setMessages((current) => [...current, body.message]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage();
  }

  const isEmpty = messages.length === 1;

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-muted/30 transition-[width] md:flex",
          isSidebarOpen ? "w-64" : "w-16",
        )}
      >
        <div className="flex h-14 items-center justify-between px-3">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 px-1 font-semibold">
              <span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
                <Sparkles className="size-4" />
              </span>
              Orbit
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen((value) => !value)}
            aria-label="Toggle sidebar"
          >
            <PanelLeftClose
              className={cn("size-4", !isSidebarOpen && "rotate-180")}
            />
          </Button>
        </div>
        <div className="px-3">
          <Button
            variant="outline"
            className={cn("w-full", isSidebarOpen ? "justify-start" : "px-0")}
            onClick={startNewChat}
          >
            <Plus className="size-4" />
            {isSidebarOpen ? "New chat" : null}
          </Button>
        </div>
        {isSidebarOpen ? (
          <div className="mt-5 flex-1 px-3">
            <p className="px-2 text-xs font-medium text-muted-foreground">
              Recent
            </p>
            <button className="mt-2 flex w-full items-center gap-2 rounded-md bg-muted px-2.5 py-2 text-left text-sm">
              <MessageSquare className="size-4 shrink-0" />
              <span className="truncate">New conversation</span>
            </button>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="border-t border-border p-3">
          <button
            className={cn(
              "flex w-full items-center rounded-md p-2 text-sm text-muted-foreground hover:bg-muted",
              isSidebarOpen ? "gap-3" : "justify-center",
            )}
          >
            <Settings2 className="size-4" />
            {isSidebarOpen ? "Settings" : null}
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Menu className="size-5 md:hidden" />
            <label className="relative">
              <select
                className="appearance-none bg-transparent py-1 pr-7 text-sm font-medium outline-none"
                value={
                  selectedModel
                    ? `${selectedModel.provider}:${selectedModel.model}`
                    : ""
                }
                onChange={(event) => {
                  const [provider, ...modelParts] =
                    event.target.value.split(":");
                  const model = modelParts.join(":");
                  setSelectedModel(
                    models.find(
                      (option) =>
                        option.provider === provider && option.model === model,
                    ) ?? null,
                  );
                }}
              >
                {models.map((model) => (
                  <option
                    key={`${model.provider}:${model.model}`}
                    value={`${model.provider}:${model.model}`}
                    disabled={!model.configured}
                  >
                    {model.label} · {model.model}
                    {model.configured ? "" : " (not configured)"}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setToolsEnabled((value) => !value)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium",
              toolsEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-border text-muted-foreground",
            )}
          >
            {toolsEnabled ? (
              <Check className="size-3.5" />
            ) : (
              <Wrench className="size-3.5" />
            )}
            Tools {toolsEnabled ? "on" : "off"}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4">
            {isEmpty ? (
              <div className="my-auto py-12">
                <div className="mx-auto mb-8 flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40">
                  <Sparkles className="size-5" />
                </div>
                <h1 className="text-center text-2xl font-semibold tracking-tight">
                  What can I help you with?
                </h1>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map((item) => (
                    <button
                      key={item.title}
                      className="rounded-xl border border-border p-4 text-left transition hover:bg-muted/50"
                      onClick={() => void sendMessage(item.prompt)}
                    >
                      <span className="block text-sm font-medium">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {item.prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-7 py-8">
                {messages.slice(1).map((message) => (
                  <Message key={message.id} message={message} />
                ))}
                {isSending ? (
                  <div className="flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border">
                      <Bot className="size-4" />
                    </div>
                    <div className="flex items-center gap-1 py-2">
                      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
                      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 bg-background px-4 pb-4 pt-2">
          {error ? (
            <div className="mx-auto mb-2 max-w-3xl rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/20"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Message Orbit"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-xl"
              disabled={
                isSending || !input.trim() || !selectedModel?.configured
              }
              aria-label="Send message"
            >
              <Send className="size-4" />
            </Button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
            Orbit can make mistakes. Check important information.
          </p>
        </div>
      </section>
    </main>
  );
}

function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-sm leading-6">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <article className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border">
        <Bot className="size-4" />
      </div>
      <div className="min-w-0 flex-1 whitespace-pre-wrap pt-1 text-sm leading-7">
        {message.content}
        {message.model ? (
          <div className="mt-2 text-[11px] text-muted-foreground">
            {message.provider} · {message.model}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SettingsPanel({
  settings,
  metadata,
  onClose,
  onSave,
}: {
  settings: ChatSettings;
  metadata: SettingsMetadata | null;
  onClose: () => void;
  onSave: (settings: ChatSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [section, setSection] = useState<
    "model" | "instructions" | "tools" | "memory" | "lynx"
  >("model");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const sections = [
    { id: "model" as const, label: "Model", icon: Gauge },
    { id: "instructions" as const, label: "Instructions", icon: Sparkles },
    { id: "tools" as const, label: "Tools & actions", icon: Wrench },
    { id: "memory" as const, label: "Memory & privacy", icon: Eye },
    { id: "lynx" as const, label: "Lynx integration", icon: ShieldCheck },
  ];

  function update<Key extends keyof ChatSettings>(
    key: Key,
    value: ChatSettings[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/30 md:justify-end">
      <button
        aria-label="Close settings"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="relative flex h-full w-full flex-col bg-background shadow-xl md:max-w-4xl">
        <header className="flex h-16 items-center justify-between border-b px-5">
          <div>
            <h2 className="font-semibold">Settings</h2>
            <p className="text-xs text-muted-foreground">
              Configure how Orbit responds, uses tools, and records runs.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <nav className="w-48 shrink-0 border-r bg-muted/20 p-3 max-sm:w-14">
            {sections.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                    section === item.id
                      ? "bg-muted font-medium"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="max-sm:hidden">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {section === "model" ? (
              <SettingsSection
                title="Model behavior"
                description="Generation controls apply to every provider."
              >
                <RangeField
                  label="Temperature"
                  description="Lower values are more predictable; higher values are more varied."
                  value={draft.temperature}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(value) => update("temperature", value)}
                />
                <RangeField
                  label="Maximum output tokens"
                  description="Limits the length of each model response."
                  value={draft.maxTokens}
                  min={128}
                  max={4096}
                  step={128}
                  onChange={(value) => update("maxTokens", value)}
                />
                <RangeField
                  label="Conversation context"
                  description="Number of recent messages sent to the model."
                  value={draft.contextMessages}
                  min={2}
                  max={40}
                  step={2}
                  onChange={(value) => update("contextMessages", value)}
                />
                <SelectField
                  label="Response style"
                  value={draft.responseStyle}
                  onChange={(value) =>
                    update(
                      "responseStyle",
                      value as ChatSettings["responseStyle"],
                    )
                  }
                  options={[
                    ["concise", "Concise"],
                    ["balanced", "Balanced"],
                    ["detailed", "Detailed"],
                  ]}
                />
                <SelectField
                  label="Response language"
                  value={draft.language}
                  onChange={(value) =>
                    update("language", value as ChatSettings["language"])
                  }
                  options={[
                    ["auto", "Match the user"],
                    ["ko", "Korean"],
                    ["en", "English"],
                  ]}
                />
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-medium">Available providers</h4>
                  <div className="mt-3 space-y-2">
                    {(metadata?.providers ?? []).map((provider) => (
                      <StatusRow
                        key={provider.id}
                        label={`${provider.label} · ${provider.model}`}
                        ok={provider.configured}
                        detail={
                          provider.configured ? "Ready" : "API key missing"
                        }
                      />
                    ))}
                  </div>
                </div>
              </SettingsSection>
            ) : null}

            {section === "instructions" ? (
              <SettingsSection
                title="Custom instructions"
                description="Add persistent instructions after the managed Orbit prompt."
              >
                <label className="block">
                  <span className="text-sm font-medium">System prompt</span>
                  <textarea
                    value={draft.systemPrompt}
                    onChange={(event) =>
                      update("systemPrompt", event.target.value)
                    }
                    maxLength={8000}
                    rows={12}
                    placeholder="Describe the assistant's role, preferred format, constraints, and domain context."
                    className="mt-2 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <span className="mt-1 block text-right text-xs text-muted-foreground">
                    {draft.systemPrompt.length.toLocaleString()} / 8,000
                  </span>
                </label>
                <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                  <p className="font-medium">Prompt order</p>
                  <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
                    <li>Lynx managed prompt, when configured</li>
                    <li>Your custom instructions</li>
                    <li>Response style and language preference</li>
                    <li>Conversation and tool context</li>
                  </ol>
                </div>
              </SettingsSection>
            ) : null}

            {section === "tools" ? (
              <SettingsSection
                title="Tools and actions"
                description="Choose which capabilities Orbit may invoke while answering."
              >
                <ToggleField
                  label="Calculator"
                  description="Evaluate arithmetic expressions locally."
                  checked={draft.calculatorEnabled}
                  onChange={(value) => update("calculatorEnabled", value)}
                />
                <ToggleField
                  label="Workspace search"
                  description="Search connected workspace documents and updates."
                  checked={draft.workspaceSearchEnabled}
                  onChange={(value) => update("workspaceSearchEnabled", value)}
                />
                <ToggleField
                  label="External actions"
                  description="Allow requests that may change external systems. Lynx Firewall still evaluates every call."
                  checked={draft.externalActionsEnabled}
                  onChange={(value) => update("externalActionsEnabled", value)}
                  warning
                />
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex gap-2 font-medium">
                    <LockKeyhole className="mt-0.5 size-4" />
                    Sensitive actions remain protected
                  </div>
                  <p className="mt-1 pl-6 text-amber-800">
                    Enabling external actions permits evaluation, but the
                    current Firewall policy blocks execution until an approval
                    workflow is configured.
                  </p>
                </div>
              </SettingsSection>
            ) : null}

            {section === "memory" ? (
              <SettingsSection
                title="Memory and privacy"
                description="Control conversation context and what Lynx records."
              >
                <ToggleField
                  label="Conversation memory"
                  description="Record memory read/write events and use recent messages as context."
                  checked={draft.memoryEnabled}
                  onChange={(value) => update("memoryEnabled", value)}
                />
                <ToggleField
                  label="Capture user input"
                  description="Attach user messages to Lynx runs for debugging."
                  checked={draft.captureInput}
                  onChange={(value) => update("captureInput", value)}
                />
                <ToggleField
                  label="Capture model output"
                  description="Allow model output content in Lynx instrumentation."
                  checked={draft.captureOutput}
                  onChange={(value) => update("captureOutput", value)}
                />
                <div className="rounded-lg border p-4 text-sm">
                  <div className="flex gap-2 font-medium">
                    <Database className="size-4" />
                    Device-local preferences
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    These preferences are validated by the server and stored in
                    this browser. Provider credentials remain server-only.
                  </p>
                </div>
              </SettingsSection>
            ) : null}

            {section === "lynx" ? (
              <SettingsSection
                title="Lynx integration"
                description="Read-only runtime status from the Orbit server."
              >
                <StatusCard
                  title="Workspace API key"
                  ok={metadata?.lynx.connected === true}
                  value={
                    metadata?.lynx.connected
                      ? "Connected"
                      : "Missing or invalid"
                  }
                />
                <StatusCard
                  title="Workspace"
                  ok={metadata?.lynx.workspaceConfigured === true}
                  value={
                    metadata?.lynx.workspaceConfigured
                      ? "Configured"
                      : "Not configured"
                  }
                />
                <ReadOnlyField
                  label="Endpoint"
                  value={metadata?.lynx.endpoint ?? "Loading…"}
                />
                <ReadOnlyField
                  label="Environment"
                  value={metadata?.lynx.environment ?? "Loading…"}
                />
                <ReadOnlyField
                  label="Managed prompt"
                  value={
                    metadata?.lynx.managedPrompt ?? "Local fallback prompt"
                  }
                />
                <div className="rounded-lg border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
                  API keys and endpoints are configured through server
                  environment variables. They are intentionally not editable or
                  returned to the browser.
                </div>
              </SettingsSection>
            ) : null}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t px-5 py-3">
          <div className="text-xs text-destructive">{saveError}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={isSaving}
              onClick={() => {
                setIsSaving(true);
                setSaveError(null);
                void onSave(draft)
                  .catch((caught) =>
                    setSaveError(
                      caught instanceof Error
                        ? caught.message
                        : "Could not save settings.",
                    ),
                  )
                  .finally(() => setIsSaving(false));
              }}
            >
              {isSaving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
  warning = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  warning?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-4">
      <span>
        <span className="flex items-center gap-2 text-sm font-medium">
          {warning ? <CircleAlert className="size-4 text-amber-600" /> : null}
          {label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-foreground"
      />
    </label>
  );
}

function RangeField({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-lg border p-4">
      <span className="flex justify-between text-sm font-medium">
        {label}
        <span className="font-mono">{value}</span>
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">
        {description}
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-4 w-full accent-foreground"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border p-4 text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border bg-background px-3 py-2 font-normal"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusRow({
  label,
  detail,
  ok,
}: {
  label: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span
        className={cn(
          "flex items-center gap-1 text-xs",
          ok ? "text-emerald-700" : "text-muted-foreground",
        )}
      >
        {ok ? (
          <CircleCheck className="size-3.5" />
        ) : (
          <CircleAlert className="size-3.5" />
        )}
        {detail}
      </span>
    </div>
  );
}

function StatusCard({
  title,
  value,
  ok,
}: {
  title: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <span className="text-sm font-medium">{title}</span>
      <span
        className={cn("text-sm", ok ? "text-emerald-700" : "text-amber-700")}
      >
        {value}
      </span>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-mono text-sm">{value}</div>
    </div>
  );
}
