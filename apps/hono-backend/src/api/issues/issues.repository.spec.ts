import {
  IssueActivityEntity,
  IssueEntity,
  UserEntity,
} from "@repo/database";
import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { IssuesRepository } from "./issues.repository.js";

describe("IssuesRepository", () => {
  afterEach(() => jest.restoreAllMocks());

  it("nullable 사용자 관계를 조인하지 않고 이슈 행만 잠근다", async () => {
    const issue = {
      id: "00000000-0000-4000-8000-000000000002",
      workspaceId: "00000000-0000-4000-8000-000000000001",
      status: "OPEN",
      resolvedAt: null,
      resolvedByUserId: null,
      resolvedByUser: null,
    } as IssueEntity;
    const actor = {
      id: "00000000-0000-4000-8000-000000000003",
      name: "Operator",
    } as UserEntity;
    const issueRepository = {
      findOne: jest.fn().mockResolvedValue(issue),
      save: jest.fn(async (value: IssueEntity) => value),
    };
    const userRepository = {
      findOneBy: jest.fn().mockResolvedValue(actor),
    };
    const activityRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === IssueEntity) return issueRepository;
        if (entity === UserEntity) return userRepository;
        if (entity === IssueActivityEntity) return activityRepository;
        throw new Error("UNEXPECTED_REPOSITORY");
      }),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (work) => work(manager));

    const result = await new IssuesRepository().updateStatus({
      workspaceId: issue.workspaceId,
      issueId: issue.id,
      userId: actor.id,
      status: "RESOLVED",
      reason: "Fixed",
    });

    expect(issueRepository.findOne).toHaveBeenCalledWith({
      where: { id: issue.id, workspaceId: issue.workspaceId },
      lock: { mode: "pessimistic_write" },
    });
    expect(result.status).toBe("RESOLVED");
    expect(result.resolvedByUser).toBe(actor);
  });

  it("같은 해결 상태를 재요청하면 해결자를 잠금과 분리해 조회한다", async () => {
    const resolver = {
      id: "00000000-0000-4000-8000-000000000003",
      name: "Operator",
    } as UserEntity;
    const issue = {
      id: "00000000-0000-4000-8000-000000000002",
      workspaceId: "00000000-0000-4000-8000-000000000001",
      status: "RESOLVED",
      resolvedAt: new Date("2026-07-27T12:00:00.000Z"),
      resolvedByUserId: resolver.id,
      resolvedByUser: null,
    } as IssueEntity;
    const issueRepository = {
      findOne: jest.fn().mockResolvedValue(issue),
      save: jest.fn(),
    };
    const userRepository = {
      findOneBy: jest.fn().mockResolvedValue(resolver),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === IssueEntity) return issueRepository;
        if (entity === UserEntity) return userRepository;
        throw new Error("UNEXPECTED_REPOSITORY");
      }),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (work) => work(manager));

    const result = await new IssuesRepository().updateStatus({
      workspaceId: issue.workspaceId,
      issueId: issue.id,
      userId: resolver.id,
      status: "RESOLVED",
    });

    expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: resolver.id });
    expect(issueRepository.save).not.toHaveBeenCalled();
    expect(result.resolvedByUser).toBe(resolver);
  });
});
