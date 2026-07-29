import type { DataSource } from "typeorm";
import { OpenApiUsageService } from "./openapi-usage.service.js";

describe("OpenApiUsageService", () => {
  it("records one hourly aggregate without storing request payloads", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const service = new OpenApiUsageService({
      query,
    } as unknown as Pick<DataSource, "query">);

    await service.record({
      apiKeyId: "70302e18-767c-42d3-9674-80c302475981",
      workspaceId: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      endpoint: "POST /openapi/v1/events",
      statusCode: 202,
      latencyMs: 12.8,
      requestBytes: 120,
      responseBytes: 45,
      rateLimited: false,
      acceptedEventCount: 3,
      rejectedEventCount: 1,
      occurredAt: new Date("2026-07-29T10:34:56.000Z"),
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "openapi_api_key_usage_hourly"');
    expect(parameters).toEqual([
      "70302e18-767c-42d3-9674-80c302475981",
      "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      new Date("2026-07-29T10:00:00.000Z"),
      "POST /openapi/v1/events",
      1,
      0,
      0,
      0,
      3,
      1,
      120,
      45,
      12,
    ]);
  });

  it("classifies rate-limited client errors and clamps invalid counters", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const service = new OpenApiUsageService({
      query,
    } as unknown as Pick<DataSource, "query">);

    await service.record({
      apiKeyId: "70302e18-767c-42d3-9674-80c302475981",
      workspaceId: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      endpoint: "GET /openapi/v1/runtime-config",
      statusCode: 429,
      latencyMs: Number.NaN,
      requestBytes: -1,
      responseBytes: Number.POSITIVE_INFINITY,
      rateLimited: true,
      acceptedEventCount: -2,
      rejectedEventCount: 0,
      occurredAt: new Date("2026-07-29T10:34:56.000Z"),
    });

    const parameters = query.mock.calls[0]?.[1] as unknown[];
    expect(parameters.slice(4)).toEqual([
      0,
      1,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
    ]);
  });
});
