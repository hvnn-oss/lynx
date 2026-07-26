import {
  AgentEntity,
  EventEntity,
  FirewallPolicyEntity,
  FirewallViolationEntity,
  RunEntity,
  SessionEntity,
} from "@repo/database";
import type { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { OpenAPIEventRepository } from "./event.repository.js";

describe("OpenAPIEventRepository", () => {
  afterEach(() => jest.restoreAllMocks());

  it("비허용 정책 평가 이벤트와 violation을 같은 트랜잭션에 저장한다", async () => {
    const savedEvent = { id: "event-db-id" } as EventEntity;
    const policy = { id: 7 } as FirewallPolicyEntity;
    const eventRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(savedEvent),
    };
    const violationRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue({ id: "violation-id" }),
    };
    const policyRepository = {
      findOne: jest.fn().mockResolvedValue(policy),
    };
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const runRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(updateBuilder),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === EventEntity) return eventRepository;
        if (entity === FirewallViolationEntity) return violationRepository;
        if (entity === FirewallPolicyEntity) return policyRepository;
        if (entity === RunEntity) return runRepository;
        throw new Error("Unexpected repository");
      }),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback) => callback(manager));

    await new OpenAPIEventRepository().saveEvent(
      "00000000-0000-4000-8000-000000000001",
      { id: "agent-id" } as AgentEntity,
      { id: "session-id", name: "session" } as SessionEntity,
      { id: "run-id" } as RunEntity,
      {
        eventId: "client-event-id",
        clientId: "sdk-instance",
        runId: "run",
        agentName: "agent",
        eventType: "POLICY_EVALUATION",
        label: "policy:delete_user",
        timestamp: Date.parse("2026-07-25T00:00:00.000Z"),
        payload: {
          action: "BLOCK",
          policyId: "7",
          toolName: "delete_user",
          severity: "CRITICAL",
          reason: "Destructive action",
          metadata: { managedPolicy: true },
        },
      },
    );

    expect(policyRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 7,
        workspace: { id: "00000000-0000-4000-8000-000000000001" },
      },
    });
    expect(violationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "BLOCK",
        eventId: "event-db-id",
        reportedPolicyId: "7",
        toolName: "delete_user",
        reason: policy,
      }),
    );
    expect(violationRepository.save).toHaveBeenCalledTimes(1);
  });

  it("ALLOW 정책 평가는 violation으로 저장하지 않는다", async () => {
    const eventRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue({ id: "event-db-id" }),
    };
    const violationRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === EventEntity) return eventRepository;
        if (entity === FirewallViolationEntity) return violationRepository;
        if (entity === RunEntity) {
          return { createQueryBuilder: () => updateBuilder };
        }
        return {} as Repository<never>;
      }),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback) => callback(manager));

    await new OpenAPIEventRepository().saveEvent(
      "00000000-0000-4000-8000-000000000001",
      { id: "agent-id" } as AgentEntity,
      { id: "session-id", name: "session" } as SessionEntity,
      { id: "run-id" } as RunEntity,
      {
        eventId: "client-event-id",
        clientId: "sdk-instance",
        runId: "run",
        agentName: "agent",
        eventType: "POLICY_EVALUATION",
        label: "policy:safe_tool",
        timestamp: Date.parse("2026-07-25T00:00:00.000Z"),
        payload: { action: "ALLOW" },
      },
    );

    expect(violationRepository.save).not.toHaveBeenCalled();
  });
});
