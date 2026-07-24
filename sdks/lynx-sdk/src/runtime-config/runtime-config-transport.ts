import type {
  RuntimeConfigBundle,
  RuntimeConfigTransport,
  RuntimeConfigTransportResult,
} from "./runtime-config.types.js";

/** Connection details for the Lynx runtime configuration endpoint. */
interface HttpRuntimeConfigTransportOptions {
  /** Base URL of the Lynx API. */
  endpoint: string;
  /** Workspace-scoped API key with config and policy read permissions. */
  apiKey?: string;
  /** Stable identifier for the SDK installation or host service. */
  clientId: string;
  /** Maximum duration of one HTTP request. */
  timeoutMs: number;
}

/** Loads managed prompts and policies from the Lynx runtime configuration API. */
export class HttpRuntimeConfigTransport implements RuntimeConfigTransport {
  /** Creates an HTTP transport with fixed authentication and timeout settings. */
  constructor(private readonly options: HttpRuntimeConfigTransportOptions) {}

  /**
   * Requests the latest runtime configuration bundle.
   *
   * The previous ETag is sent through `If-None-Match`, allowing the server to
   * return `304 Not Modified` without transferring the full bundle again.
   *
   * @param etag Entity tag returned by an earlier successful request.
   * @returns An updated bundle or a not-modified result.
   * @throws When authentication is unavailable, the deadline expires, or the
   * server returns a non-success status.
   */
  async fetch(etag?: string): Promise<RuntimeConfigTransportResult> {
    if (!this.options.apiKey) {
      throw new Error("LYNX_API_KEY is required to load runtime configuration");
    }

    const controller = new AbortController();
    // AbortController bounds control-plane latency independently of telemetry.
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    timeout.unref?.();

    try {
      const headers: Record<string, string> = {
        "X-API-Key": this.options.apiKey,
        "X-Lynx-Client-ID": this.options.clientId,
      };
      if (etag) headers["If-None-Match"] = etag;

      const response = await fetch(
        `${this.options.endpoint.replace(/\/$/, "")}/openapi/v1/runtime-config`,
        { method: "GET", headers, signal: controller.signal },
      );
      if (response.status === 304) {
        return {
          status: "NOT_MODIFIED",
          etag: response.headers.get("etag") ?? etag,
        };
      }
      if (!response.ok) {
        throw new Error(
          `Runtime configuration request failed with status ${response.status}`,
        );
      }

      return {
        status: "UPDATED",
        etag: response.headers.get("etag") ?? undefined,
        bundle: (await response.json()) as RuntimeConfigBundle,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
