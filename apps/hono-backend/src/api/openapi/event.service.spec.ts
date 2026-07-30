import type { OpenAPIEventRepository } from "./event.repository.js";
import type { IngestEvent } from "./event.schema.js";
import { OpenAPIEventService } from "./event.service.js";
import { MODEL_PRICING_VERSION } from "../../common/services/llm-cost.service.js";

function event(overrides: Partial<IngestEvent> = {}): IngestEvent {
  return {
    eventId: "event-1",
    clientId: "client-1",
    runId: "run-1",
    agentName: "support-agent",
    eventType: "USER_INPUT",
    label: "input",
    payload: {},
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("OpenAPIEventService", () => {
  it("rejects a tenant hint that differs from the authenticated workspace", async () => {
    const repository = {
      findEvent: jest.fn(),
      findOrCreateAgent: jest.fn(),
      findOrCreateSession: jest.fn(),
      findOrCreateRun: jest.fn(),
      saveEvent: jest.fn(),
    } as unknown as OpenAPIEventRepository;
    const service = new OpenAPIEventService(repository);

    const result = await service.ingestBatch("workspace-1", "prod", [
      event({ workspaceId: "workspace-2" }),
    ]);

    expect(result).toEqual({
      success: false,
      accepted: 0,
      retryableEventIds: [],
      rejectedEventIds: ["event-1"],
    });
    expect(repository.saveEvent).not.toHaveBeenCalled();
  });

  it("reports transient per-event failures without failing accepted events", async () => {
    const repository = {
      findEvent: jest.fn().mockResolvedValue(null),
      findOrCreateAgent: jest
        .fn()
        .mockResolvedValueOnce({ id: "agent-1" })
        .mockRejectedValueOnce(new Error("database unavailable")),
      findOrCreateSession: jest.fn().mockResolvedValue({ id: "session-1" }),
      findOrCreateRun: jest.fn().mockResolvedValue({ id: "run-1" }),
      saveEvent: jest.fn().mockResolvedValue({ id: "stored-event" }),
    } as unknown as OpenAPIEventRepository;
    const service = new OpenAPIEventService(repository);

    const result = await service.ingestBatch("workspace-1", "prod", [
      event(),
      event({ eventId: "event-2" }),
    ]);

    expect(result.accepted).toBe(1);
    expect(result.retryableEventIds).toEqual(["event-2"]);
    expect(result.rejectedEventIds).toEqual([]);
  });

  it("stores legacy and omitted schema versions as 1.0", async () => {
    const repository = {
      findEvent: jest.fn().mockResolvedValue(null),
      findOrCreateAgent: jest.fn().mockResolvedValue({ id: "agent-1" }),
      findOrCreateSession: jest.fn().mockResolvedValue({ id: "session-1" }),
      findOrCreateRun: jest.fn().mockResolvedValue({ id: "run-1" }),
      saveEvent: jest.fn().mockResolvedValue({ id: "stored-event" }),
    } as unknown as OpenAPIEventRepository;
    const service = new OpenAPIEventService(repository);

    const result = await service.ingestBatch("workspace-1", "prod", [
      event({ schemaVersion: "1" }),
      event({ eventId: "event-2" }),
    ]);

    expect(result.accepted).toBe(2);
    expect(repository.saveEvent).toHaveBeenNthCalledWith(
      1,
      "workspace-1",
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ schemaVersion: "1.0" }),
    );
    expect(repository.saveEvent).toHaveBeenNthCalledWith(
      2,
      "workspace-1",
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ schemaVersion: "1.0" }),
    );
  });

  it("LLM 종료 이벤트에 서버 추정 비용을 저장한다", async () => {
    const repository = {
      findEvent: jest.fn().mockResolvedValue(null),
      findOrCreateAgent: jest.fn().mockResolvedValue({ id: "agent-1" }),
      findOrCreateSession: jest.fn().mockResolvedValue({ id: "session-1" }),
      findOrCreateRun: jest.fn().mockResolvedValue({ id: "run-1" }),
      saveEvent: jest.fn().mockResolvedValue({ id: "stored-event" }),
    } as unknown as OpenAPIEventRepository;
    const service = new OpenAPIEventService(repository);

    await service.ingestBatch("workspace-1", "production", [
      event({
        eventType: "LLM_CALL",
        payload: {
          phase: "end",
          provider: "openai",
          model: "gpt-4.1-mini",
          usage: {
            promptTokens: 1_000,
            completionTokens: 500,
            totalTokens: 1_500,
          },
        },
      }),
    ]);

    expect(repository.saveEvent).toHaveBeenCalledWith(
      "workspace-1",
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({
          cost: 0.0012,
          costSource: "SERVER_ESTIMATED",
          pricingVersion: MODEL_PRICING_VERSION,
        }),
      }),
    );
  });

  it("accepts a concurrent duplicate after confirming that it was stored", async () => {
    const repository = {
      findEvent: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "stored-by-another-request" }),
      findOrCreateAgent: jest.fn().mockResolvedValue({ id: "agent-1" }),
      findOrCreateSession: jest.fn().mockResolvedValue({ id: "session-1" }),
      findOrCreateRun: jest.fn().mockResolvedValue({ id: "run-1" }),
      saveEvent: jest.fn().mockRejectedValue({ code: "23505" }),
    } as unknown as OpenAPIEventRepository;
    const service = new OpenAPIEventService(repository);

    const result = await service.ingestBatch("workspace-1", "prod", [event()]);

    expect(result).toEqual({
      success: true,
      accepted: 1,
      retryableEventIds: [],
      rejectedEventIds: [],
    });
  });

  it("rejects permanent database input errors without asking the SDK to retry", async () => {
    const repository = {
      findEvent: jest.fn().mockResolvedValue(null),
      findOrCreateAgent: jest.fn().mockRejectedValue({ code: "23514" }),
      findOrCreateSession: jest.fn(),
      findOrCreateRun: jest.fn(),
      saveEvent: jest.fn(),
    } as unknown as OpenAPIEventRepository;
    const service = new OpenAPIEventService(repository);

    const result = await service.ingestBatch("workspace-1", "prod", [event()]);

    expect(result).toEqual({
      success: false,
      accepted: 0,
      retryableEventIds: [],
      rejectedEventIds: ["event-1"],
    });
  });
});
