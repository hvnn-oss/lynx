import { createHash, verify as verifySignature } from "node:crypto";
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
import {
  getDisabledRuntimeConfigCacheStatus,
  RuntimeConfigCache,
} from "./runtime-config-cache.js";
import { LocalPolicyEvaluator } from "../firewall/local-policy-evaluator.js";
import { createStableHash } from "../utils/stable-hash.js";

const DEFAULT_REFRESH_INTERVAL_MS = 60_000;
const MIN_REFRESH_INTERVAL_MS = 5_000;
const DEFAULT_REFRESH_JITTER_RATIO = 0.1;
const DEFAULT_MAX_STALE_AGE_MS = 24 * 60 * 60 * 1_000;

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
  private initializationPromise?: Promise<void>;
  private refreshPromise?: Promise<void>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private hasInitialized = false;
  private isShutdown = false;
  private state: LynxRuntimeConfigStatus["state"] = "NOT_INITIALIZED";
  private lastUpdatedAt?: string;
  private nextRefreshAt?: string;
  private lastError?: string;
  private readonly policyValidator = new LocalPolicyEvaluator();

  constructor(
    private readonly transport: RuntimeConfigTransport,
    private readonly options: LynxRuntimeConfigOptions = {},
    private readonly cache?: RuntimeConfigCache,
    private readonly defaultAssignmentKey = "anonymous",
    private readonly expectedTarget?: {
      environment?: string;
      agentId?: string;
    },
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
    if (this.hasInitialized) return Promise.resolve();
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.performInitialize().finally(() => {
      this.initializationPromise = undefined;
    });
    return this.initializationPromise;
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
  async getPrompt(
    id: string,
    assignmentKey = this.defaultAssignmentKey,
  ): Promise<LynxPromptSnapshot> {
    await this.initialize();
    if (!this.isBundleUsable()) await this.refresh(false);
    if (!this.isBundleUsable()) {
      throw new Error(
        this.getStatus().lastError ??
          "Lynx runtime configuration exceeded its maximum stale age",
      );
    }
    let prompt = this.findPrompt(id, assignmentKey);
    if (!prompt) {
      await this.refresh(false);
      prompt = this.findPrompt(id, assignmentKey);
    }
    if (!prompt) throw new Error(`Lynx prompt "${id}" was not found`);
    return prompt;
  }

  /** Returns the active policy snapshots currently held in memory. */
  getPolicies(): readonly LynxRuntimePolicySnapshot[] {
    return this.isBundleUsable() ? (this.bundle?.policies ?? []) : [];
  }

  /** Returns local cache health without performing a network request. */
  getStatus(): LynxRuntimeConfigStatus {
    const staleAgeMs = this.getStaleAgeMs();
    const isUsable = this.isBundleUsable();
    const targetMismatch = this.hasTargetMismatch();
    const state = this.bundle && !isUsable ? "ERROR" : this.state;
    return {
      state,
      revision: this.bundle?.revision,
      lastUpdatedAt: this.lastUpdatedAt,
      nextRefreshAt: this.nextRefreshAt,
      lastError:
        this.bundle && !isUsable
          ? targetMismatch
            ? "Runtime configuration target does not match the SDK configuration"
            : "Runtime configuration exceeded its maximum stale age"
          : this.lastError,
      promptCount: this.bundle?.prompts.length ?? 0,
      policyCount: this.bundle?.policies.length ?? 0,
      experimentCount: this.bundle?.experiments?.length ?? 0,
      staleAgeMs,
      isUsable,
      target: this.bundle?.target,
      targetMismatch,
      cache: this.cache?.getStatus() ?? getDisabledRuntimeConfigCacheStatus(),
    };
  }

  /** Stops refreshes and waits for the latest cache write to settle. */
  async shutdown(): Promise<void> {
    this.isShutdown = true;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    this.nextRefreshAt = undefined;
    await Promise.allSettled(
      [this.initializationPromise, this.refreshPromise].filter(
        (promise): promise is Promise<void> => Boolean(promise),
      ),
    );
    await this.cache?.shutdown();
  }

  /** Restores disk state first and revalidates it in the background. */
  private async performInitialize(): Promise<void> {
    const cached = await this.cache?.load();
    if (cached) {
      try {
        if (this.hasExceededMaxStaleAge(cached.savedAt)) {
          throw new Error(
            "Runtime configuration cache exceeded its maximum stale age",
          );
        }
        this.validateBundle(cached.bundle);
        this.bundle = this.freezeBundle(cached.bundle);
        this.etag = cached.etag;
        this.state = "READY";
        this.lastUpdatedAt = new Date(cached.savedAt).toISOString();
        this.lastError = undefined;
        this.hasInitialized = true;
        void this.refresh(false);
        return;
      } catch (error) {
        await this.cache?.discard(error);
      }
    }

    await this.refresh(true);
    this.hasInitialized = true;
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
        if (this.shouldRefreshPersistentValidation()) {
          this.cache?.persist({
            bundle: this.bundle,
            etag: this.etag,
          });
        }
      } else {
        this.validateBundle(result.bundle);
        const previousRevision = this.bundle?.revision;
        // Publish only after the entire incoming bundle passes validation.
        this.bundle = this.freezeBundle(result.bundle);
        this.etag = result.etag;
        if (result.bundle.revision !== previousRevision) {
          this.cache?.persist({
            bundle: result.bundle,
            etag: result.etag,
          });
        } else if (this.shouldRefreshPersistentValidation()) {
          this.cache?.persist({
            bundle: result.bundle,
            etag: result.etag,
          });
        }
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
      if (!this.isShutdown && this.options.enabled !== false) {
        this.scheduleRefresh();
      }
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
  private findPrompt(
    id: string,
    assignmentKey: string,
  ): LynxPromptSnapshot | undefined {
    const deployedPrompt = this.bundle?.prompts.find(
      (prompt) => prompt.promptId === id || prompt.name === id,
    );
    if (!deployedPrompt) return undefined;
    const experiment = this.bundle?.experiments?.find(
      (candidate) => candidate.promptId === deployedPrompt.promptId,
    );
    if (!experiment) return deployedPrompt;

    const bucket =
      Number.parseInt(
        createStableHash(`${experiment.assignmentSalt}:${assignmentKey}`).slice(
          0,
          8,
        ),
        16,
      ) % 100;
    let upperBound = 0;
    for (const variant of experiment.variants) {
      upperBound += variant.weight;
      if (bucket < upperBound) return variant.prompt;
    }
    return deployedPrompt;
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
      this.validatePrompt(prompt);
    }
    for (const experiment of bundle.experiments ?? []) {
      if (
        experiment.variants.reduce(
          (total, variant) => total + variant.weight,
          0,
        ) !== 100
      ) {
        throw new Error(
          `Runtime prompt experiment "${experiment.experimentId}" must total 100`,
        );
      }
      for (const variant of experiment.variants) {
        if (variant.prompt.promptId !== experiment.promptId) {
          throw new Error(
            `Runtime prompt experiment "${experiment.experimentId}" references another prompt`,
          );
        }
        this.validatePrompt(variant.prompt);
      }
    }
    for (const policy of bundle.policies) {
      this.policyValidator.validatePolicy(policy);
    }
    if (
      this.options.requireTargetMatch === true &&
      this.hasTargetMismatch(bundle)
    ) {
      throw new Error(
        "Runtime configuration target does not match the SDK configuration",
      );
    }
    this.verifyBundleSignature(bundle);
  }

  /** Verifies the content digest of one immutable prompt snapshot. */
  private validatePrompt(prompt: LynxPromptSnapshot): void {
    const actualHash = createHash("sha256")
      .update(prompt.content, "utf8")
      .digest("hex");
    if (actualHash !== prompt.contentHash) {
      throw new Error(`Runtime prompt "${prompt.name}" failed integrity check`);
    }
  }

  /** Verifies the Ed25519 signature before a bundle becomes executable. */
  private verifyBundleSignature(bundle: RuntimeConfigBundle): void {
    const publicKey = this.options.signaturePublicKey;
    const mustVerify =
      this.options.requireSignature === true || Boolean(publicKey);
    if (!mustVerify) return;
    if (!publicKey || !bundle.signing) {
      throw new Error("Runtime configuration signature is required");
    }
    if (bundle.signing.algorithm !== "Ed25519") {
      throw new Error(
        "Runtime configuration signature algorithm is unsupported",
      );
    }
    const signedPayload: Record<string, unknown> = {
      revision: bundle.revision,
      prompts: bundle.prompts,
      policies: bundle.policies,
    };
    if (bundle.experiments !== undefined) {
      signedPayload.experiments = bundle.experiments;
    }
    if (bundle.target !== undefined) signedPayload.target = bundle.target;
    const payload = JSON.stringify(signedPayload);
    const isValid = verifySignature(
      null,
      Buffer.from(payload, "utf8"),
      publicKey.replace(/\\n/g, "\n"),
      Buffer.from(bundle.signing.signature, "base64url"),
    );
    if (!isValid) {
      throw new Error("Runtime configuration signature verification failed");
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
      policies: Object.freeze(
        policies,
      ) as unknown as LynxRuntimePolicySnapshot[],
      experiments: bundle.experiments
        ? (Object.freeze(
            bundle.experiments.map((experiment) =>
              Object.freeze({
                ...experiment,
                variants: Object.freeze(
                  experiment.variants.map((variant) =>
                    Object.freeze({
                      ...variant,
                      prompt: Object.freeze({ ...variant.prompt }),
                    }),
                  ),
                ),
              }),
            ),
          ) as unknown as RuntimeConfigBundle["experiments"])
        : undefined,
      target: bundle.target ? Object.freeze({ ...bundle.target }) : undefined,
      signing: bundle.signing
        ? Object.freeze({ ...bundle.signing })
        : bundle.signing,
    });
  }

  /** Returns milliseconds since the bundle was last successfully validated. */
  private getStaleAgeMs(): number | undefined {
    if (!this.lastUpdatedAt) return undefined;
    return Math.max(0, Date.now() - Date.parse(this.lastUpdatedAt));
  }

  /** Checks the configured stale deadline against an absolute timestamp. */
  private hasExceededMaxStaleAge(lastValidatedAt: number): boolean {
    const maxStaleAgeMs = Math.max(
      0,
      this.options.maxStaleAgeMs ?? DEFAULT_MAX_STALE_AGE_MS,
    );
    return (
      maxStaleAgeMs !== undefined &&
      maxStaleAgeMs >= 0 &&
      Date.now() - lastValidatedAt > maxStaleAgeMs
    );
  }

  /** Returns whether the current bundle may still execute locally. */
  private isBundleUsable(): boolean {
    if (!this.bundle) return false;
    const staleAgeMs = this.getStaleAgeMs();
    if (
      staleAgeMs !== undefined &&
      staleAgeMs >
        Math.max(0, this.options.maxStaleAgeMs ?? DEFAULT_MAX_STALE_AGE_MS)
    ) {
      return false;
    }
    return !(
      this.options.requireTargetMatch === true && this.hasTargetMismatch()
    );
  }

  /** Compares server-resolved target metadata with local expectations. */
  private hasTargetMismatch(bundle = this.bundle): boolean {
    if (!bundle?.target) {
      return Boolean(
        this.expectedTarget?.environment || this.expectedTarget?.agentId,
      );
    }
    if (
      this.expectedTarget?.environment &&
      bundle.target.environment !== this.expectedTarget.environment
    ) {
      return true;
    }
    if (
      this.expectedTarget?.agentId &&
      (bundle.target.requestedAgentId !== this.expectedTarget.agentId ||
        !bundle.target.resolvedAgentId)
    ) {
      return true;
    }
    return false;
  }

  /** Periodically persists successful 304 validation without writing each minute. */
  private shouldRefreshPersistentValidation(): boolean {
    if (!this.cache) return false;
    const lastSavedAt = this.cache.getStatus().lastSavedAt;
    if (!lastSavedAt) return true;
    const maxStaleAgeMs = Math.max(
      0,
      this.options.maxStaleAgeMs ?? DEFAULT_MAX_STALE_AGE_MS,
    );
    const refreshThreshold = Math.max(
      60_000,
      Math.min(60 * 60_000, Math.floor(maxStaleAgeMs / 2)),
    );
    return Date.now() - Date.parse(lastSavedAt) >= refreshThreshold;
  }
}
