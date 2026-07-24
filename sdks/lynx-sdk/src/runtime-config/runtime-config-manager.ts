import { createHash } from "node:crypto";
import type {
  LynxPromptSnapshot,
  LynxRuntimeConfigOptions,
  LynxRuntimeConfigStatus,
  LynxRuntimePolicySnapshot,
} from "../core/types.js";
import type {
  RuntimeConfigBundle,
  RuntimeConfigTransport,
} from "./runtime-config.types.js";

const DEFAULT_REFRESH_INTERVAL_MS = 60_000;
const MIN_REFRESH_INTERVAL_MS = 5_000;
const DEFAULT_REFRESH_JITTER_RATIO = 0.1;

/**
 * Owns the SDK's last-known-good runtime configuration snapshot.
 *
 * The manager coalesces concurrent refreshes, validates prompt integrity,
 * revalidates bundles with ETags, and refreshes in the background without
 * keeping the Node.js process alive.
 */
export class RuntimeConfigManager {
  private bundle?: RuntimeConfigBundle;
  private etag?: string;
  private refreshPromise?: Promise<void>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private state: LynxRuntimeConfigStatus["state"] = "NOT_INITIALIZED";
  private lastUpdatedAt?: string;
  private nextRefreshAt?: string;
  private lastError?: string;

  constructor(
    private readonly transport: RuntimeConfigTransport,
    private readonly options: LynxRuntimeConfigOptions = {},
  ) {}

  /**
   * Loads the initial bundle once.
   *
   * Concurrent callers share the same in-flight request. A previously loaded
   * bundle is returned immediately.
   *
   * @throws When no valid bundle has ever been loaded and the request fails.
   */
  initialize(): Promise<void> {
    if (this.bundle) return Promise.resolve();
    return this.refresh(true);
  }

  /**
   * Resolves a managed prompt by prompt UUID or stable name.
   *
   * A cache miss triggers one immediate refresh so newly published prompts can
   * be discovered before reporting that the identifier is unknown.
   *
   * @param id Prompt UUID or stable prompt name.
   * @returns The current immutable prompt snapshot.
   * @throws When the initial bundle cannot load or the prompt does not exist.
   */
  async getPrompt(id: string): Promise<LynxPromptSnapshot> {
    await this.initialize();
    let prompt = this.findPrompt(id);
    if (!prompt) {
      await this.refresh(false);
      prompt = this.findPrompt(id);
    }
    if (!prompt) throw new Error(`Lynx prompt "${id}" was not found`);
    return prompt;
  }

  /** Returns the active policy snapshots currently held in memory. */
  getPolicies(): readonly LynxRuntimePolicySnapshot[] {
    return this.bundle?.policies ?? [];
  }

  /** Returns local cache health without performing a network request. */
  getStatus(): LynxRuntimeConfigStatus {
    return {
      state: this.state,
      revision: this.bundle?.revision,
      lastUpdatedAt: this.lastUpdatedAt,
      nextRefreshAt: this.nextRefreshAt,
      lastError: this.lastError,
      promptCount: this.bundle?.prompts.length ?? 0,
      policyCount: this.bundle?.policies.length ?? 0,
    };
  }

  /** Stops future background refreshes without discarding the cached bundle. */
  shutdown(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    this.nextRefreshAt = undefined;
  }

  /** Coalesces simultaneous refresh requests into one transport operation. */
  private refresh(throwOnFailure: boolean): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh(throwOnFailure).finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  /** Applies one conditional refresh while preserving a valid stale snapshot. */
  private async performRefresh(throwOnFailure: boolean): Promise<void> {
    this.state = "REFRESHING";
    try {
      const result = await this.transport.fetch(this.etag);
      if (result.status === "NOT_MODIFIED") {
        if (!this.bundle) {
          throw new Error(
            "Runtime configuration returned 304 before an initial bundle",
          );
        }
        this.etag = result.etag ?? this.etag;
      } else {
        this.validateBundle(result.bundle);
        // Publish only after the entire incoming bundle passes validation.
        this.bundle = this.freezeBundle(result.bundle);
        this.etag = result.etag;
      }
      this.state = "READY";
      this.lastUpdatedAt = new Date().toISOString();
      this.lastError = undefined;
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : "Runtime configuration failed";
      this.state = this.bundle ? "STALE" : "ERROR";
      if (throwOnFailure && !this.bundle) throw error;
    } finally {
      if (this.options.enabled !== false) this.scheduleRefresh();
    }
  }

  /** Schedules a jittered refresh to spread requests across SDK instances. */
  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const baseInterval = Math.max(
      MIN_REFRESH_INTERVAL_MS,
      this.options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS,
    );
    const jitterRatio = Math.min(
      1,
      Math.max(
        0,
        this.options.refreshJitterRatio ?? DEFAULT_REFRESH_JITTER_RATIO,
      ),
    );
    const delay = Math.round(
      baseInterval * (1 + (Math.random() * 2 - 1) * jitterRatio),
    );
    this.nextRefreshAt = new Date(Date.now() + delay).toISOString();
    this.refreshTimer = setTimeout(() => {
      void this.refresh(false);
    }, delay);
    this.refreshTimer.unref?.();
  }

  /** Finds a prompt using either its generated UUID or its stable name. */
  private findPrompt(id: string): LynxPromptSnapshot | undefined {
    return this.bundle?.prompts.find(
      (prompt) => prompt.promptId === id || prompt.name === id,
    );
  }

  /** Verifies the bundle shape and every prompt's SHA-256 content digest. */
  private validateBundle(bundle: RuntimeConfigBundle): void {
    if (
      !bundle ||
      typeof bundle.revision !== "string" ||
      !Array.isArray(bundle.prompts) ||
      !Array.isArray(bundle.policies)
    ) {
      throw new Error("Runtime configuration response is invalid");
    }
    for (const prompt of bundle.prompts) {
      const actualHash = createHash("sha256")
        .update(prompt.content, "utf8")
        .digest("hex");
      if (actualHash !== prompt.contentHash) {
        throw new Error(`Runtime prompt "${prompt.name}" failed integrity check`);
      }
    }
  }

  /** Prevents callers from mutating the last-known-good in-memory snapshot. */
  private freezeBundle(bundle: RuntimeConfigBundle): RuntimeConfigBundle {
    const prompts = bundle.prompts.map((prompt) =>
      Object.freeze({ ...prompt }),
    );
    const policies = bundle.policies.map((policy) =>
      Object.freeze({ ...policy }),
    );
    return Object.freeze({
      revision: bundle.revision,
      prompts: Object.freeze(prompts) as unknown as LynxPromptSnapshot[],
      policies: Object.freeze(policies) as unknown as LynxRuntimePolicySnapshot[],
    });
  }
}
