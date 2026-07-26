import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type {
  LynxRuntimeConfigCacheOptions,
  LynxRuntimeConfigCacheStatus,
  LynxRuntimeConfigCacheStorage,
} from "../core/types.js";
import { FileRuntimeConfigCacheStorage } from "./file-runtime-config-cache-storage.js";
import {
  decodeRuntimeConfigCache,
  encodeRuntimeConfigCache,
} from "./runtime-config-cache-codec.js";
import type { RuntimeConfigCacheSnapshot } from "./runtime-config.types.js";

interface CreateRuntimeConfigCacheInput {
  options?: LynxRuntimeConfigCacheOptions;
  endpoint: string;
  workspaceId?: string;
  clientId: string;
  agentId?: string;
  apiKey?: string;
}

/** Coordinates portable cache encoding with an environment-specific storage. */
export class RuntimeConfigCache {
  private pendingWrite: Promise<void> = Promise.resolve();
  private state: LynxRuntimeConfigCacheStatus["state"] = "EMPTY";
  private loadedFromCache = false;
  private lastSavedAt?: string;
  private lastError?: string;

  constructor(
    private readonly storage: LynxRuntimeConfigCacheStorage,
    private readonly identity: string,
    private readonly path?: string,
  ) {}

  /** Restores a matching cache and removes corrupt or cross-environment data. */
  async load(): Promise<RuntimeConfigCacheSnapshot | null> {
    try {
      const bytes = await this.storage.read();
      if (!bytes) {
        this.state = "EMPTY";
        return null;
      }
      const snapshot = await decodeRuntimeConfigCache(bytes);
      if (snapshot.identity !== this.identity) {
        throw new Error("Runtime configuration cache identity does not match");
      }
      this.state = "READY";
      this.loadedFromCache = true;
      this.lastSavedAt = new Date(snapshot.savedAt).toISOString();
      this.lastError = undefined;
      return snapshot;
    } catch (error) {
      this.state = "ERROR";
      this.lastError = readErrorMessage(error);
      await this.storage.remove?.().catch(() => undefined);
      return null;
    }
  }

  /** Queues one non-blocking atomic write while preserving write order. */
  persist(snapshot: Omit<RuntimeConfigCacheSnapshot, "identity" | "savedAt">) {
    this.pendingWrite = this.pendingWrite
      .catch(() => undefined)
      .then(async () => {
        try {
          const savedAt = Date.now();
          const encoded = await encodeRuntimeConfigCache({
            ...snapshot,
            identity: this.identity,
            savedAt,
          });
          await this.storage.write(encoded);
          this.state = "READY";
          this.lastSavedAt = new Date(savedAt).toISOString();
          this.lastError = undefined;
        } catch (error) {
          this.state = "ERROR";
          this.lastError = readErrorMessage(error);
        }
      });
  }

  /** Waits for the last queued cache write during graceful shutdown. */
  async shutdown(): Promise<void> {
    await this.pendingWrite;
  }

  /** Removes a cache that passed framing checks but failed bundle validation. */
  async discard(error: unknown): Promise<void> {
    this.state = "ERROR";
    this.loadedFromCache = false;
    this.lastError = readErrorMessage(error);
    await this.storage.remove?.().catch(() => undefined);
  }

  /** Returns cache diagnostics without performing filesystem access. */
  getStatus(): LynxRuntimeConfigCacheStatus {
    return {
      state: this.state,
      path: this.path,
      loadedFromCache: this.loadedFromCache,
      lastSavedAt: this.lastSavedAt,
      lastError: this.lastError,
    };
  }
}

/** Creates a disabled or file/custom-backed cache from public SDK options. */
export function createRuntimeConfigCache(
  input: CreateRuntimeConfigCacheInput,
): RuntimeConfigCache | undefined {
  if (input.options?.enabled !== true) return undefined;

  const identity = createHash("sha256")
    .update(
      [
        input.endpoint,
        input.workspaceId ?? "",
        input.clientId,
        input.agentId ?? "",
        input.apiKey
          ? createHash("sha256").update(input.apiKey, "utf8").digest("hex")
          : "anonymous",
      ].join("\0"),
      "utf8",
    )
    .digest("hex");
  if (input.options.storage) {
    return new RuntimeConfigCache(input.options.storage, identity);
  }

  const path = resolveCachePath(input.options.path, identity);
  return new RuntimeConfigCache(
    new FileRuntimeConfigCacheStorage(path),
    identity,
    path,
  );
}

/** Returns the default OS cache path or resolves an explicit file path. */
function resolveCachePath(
  configuredPath: string | undefined,
  identity: string,
) {
  if (configuredPath) {
    return isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath);
  }

  const fileName = `${identity.slice(0, 20)}.lynxconf`;
  if (process.platform === "win32") {
    const base =
      process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    return join(base, "Lynx", "Cache", fileName);
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Caches", "Lynx", fileName);
  }

  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  return join(base, "lynx", fileName);
}

/** Converts unknown storage errors into stable diagnostic text. */
function readErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Runtime configuration cache failed";
}

/** Status returned when persistent runtime configuration caching is disabled. */
export function getDisabledRuntimeConfigCacheStatus(): LynxRuntimeConfigCacheStatus {
  return {
    state: "DISABLED",
    loadedFromCache: false,
  };
}
