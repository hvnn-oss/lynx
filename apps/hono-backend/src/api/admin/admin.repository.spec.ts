import type { OrganizationEntity } from "@repo/database";
import type { DataSource, EntityManager } from "typeorm";
import { AdminRepository } from "./admin.repository.js";

describe("AdminRepository", () => {
  it("파일럿 접근 조회에서 PostgreSQL 예약어를 별칭으로 사용하지 않는다", async () => {
    const selections: string[] = [];
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn((selection: string) => {
        selections.push(selection);
        return queryBuilder;
      }),
      addSelect: jest.fn((selection: string) => {
        selections.push(selection);
        return queryBuilder;
      }),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({ createQueryBuilder }),
    } as unknown as DataSource;
    const repository = new AdminRepository(dataSource);

    await repository.listPilotParticipants({ limit: 25 });

    expect(createQueryBuilder).toHaveBeenCalledWith("accessGrant");
    expect(selections.join("\n")).toContain('"accessGrant"."expiresAt"');
    expect(selections.join("\n")).not.toContain('grant."expiresAt"');
  });

  it("조직 목록 쿼리에 저장 이벤트 수와 최근 이벤트 시각을 포함한다", async () => {
    const selectedAliases: string[] = [];
    const subquerySelectExpressions: string[] = [];
    const subqueryWhereConditions: string[] = [];
    const subqueryBuilder = {
      select: jest.fn((selection: string) => {
        subquerySelectExpressions.push(selection);
        return subqueryBuilder;
      }),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn((condition: string) => {
        subqueryWhereConditions.push(condition);
        return subqueryBuilder;
      }),
    };
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn(
        (
          _selection: string | ((subquery: unknown) => unknown),
          alias?: string,
        ) => {
          if (alias) selectedAliases.push(alias);
          if (typeof _selection === "function") {
            _selection(subqueryBuilder);
          }
          return queryBuilder;
        },
      ),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      }),
    } as unknown as DataSource;
    const repository = new AdminRepository(dataSource);

    await repository.listOrganizations({ limit: 25 });

    expect(selectedAliases).toEqual(
      expect.arrayContaining(["storedEventCount", "latestEventAt"]),
    );
    expect(subqueryWhereConditions).toContain(
      '"eventWorkspace"."organizationId" = "organization"."id"',
    );
    expect(subquerySelectExpressions).toContain(
      'MAX("organizationEvent"."createdAt")',
    );
  });

  it("워크스페이스 이벤트 집계에서 혼합 대소문자 별칭을 인용한다", async () => {
    const subqueryWhereConditions: string[] = [];
    const subqueryBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn((condition: string) => {
        subqueryWhereConditions.push(condition);
        return subqueryBuilder;
      }),
    };
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn(
        (selection: string | ((subquery: unknown) => unknown)) => {
          if (typeof selection === "function") {
            selection(subqueryBuilder);
          }
          return queryBuilder;
        },
      ),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      }),
    } as unknown as DataSource;
    const repository = new AdminRepository(dataSource);

    await repository.listOrganizationWorkspaces(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(subqueryWhereConditions).toContain(
      '"eventSession"."workspaceId" = "workspace"."id"',
    );
  });

  it("요금제 변경 시 eager 관계가 아닌 조직 테이블만 잠근다", async () => {
    const organization = {
      id: "00000000-0000-4000-8000-000000000001",
      planId: "00000000-0000-4000-8000-000000000002",
    } as OrganizationEntity;
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(organization),
    };
    const entityRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save: jest.fn().mockResolvedValue(organization),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(entityRepository),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(async (work) => work(manager)),
    } as unknown as DataSource;
    const repository = new AdminRepository(dataSource);
    const nextPlanId = "00000000-0000-4000-8000-000000000003";

    await expect(
      repository.updateOrganizationPlan(organization.id, nextPlanId),
    ).resolves.toBe(true);

    expect(queryBuilder.setLock).toHaveBeenCalledWith(
      "pessimistic_write",
      undefined,
      ["organization"],
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      "organization.id = :organizationId",
      { organizationId: organization.id },
    );
    expect(organization.planId).toBe(nextPlanId);
    expect(entityRepository.save).toHaveBeenCalledWith(organization);
  });

  it("조직을 찾지 못하면 요금제를 저장하지 않는다", async () => {
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const entityRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(entityRepository),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(async (work) => work(manager)),
    } as unknown as DataSource;
    const repository = new AdminRepository(dataSource);

    await expect(
      repository.updateOrganizationPlan(
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ),
    ).resolves.toBe(false);
    expect(entityRepository.save).not.toHaveBeenCalled();
  });
});
