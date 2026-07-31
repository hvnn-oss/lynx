import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { PromptRepository } from "./prompt.repository.js";

describe("PromptRepository", () => {
  afterEach(() => jest.restoreAllMocks());

  it("does not query Run data when no prompt versions are requested", async () => {
    const query = jest.spyOn(AppDataSource, "query");
    const repository = new PromptRepository();

    await expect(
      repository.getVersionMetricsBatch("workspace-1", []),
    ).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it("aggregates metrics for every requested version in one SQL query", async () => {
    const rows = [
      {
        versionId: "f78f96b3-a1bd-45ce-8b7f-0db424ddaa56",
        runCount: "20",
        successCount: "18",
        errorRunCount: "2",
        totalCost: "1.25",
      },
    ];
    const query = jest
      .spyOn(AppDataSource, "query")
      .mockResolvedValue(rows as never);
    const repository = new PromptRepository();

    await expect(
      repository.getVersionMetricsBatch("workspace-1", [
        "f78f96b3-a1bd-45ce-8b7f-0db424ddaa56",
      ]),
    ).resolves.toEqual(rows);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("jsonb_array_elements_text");
  });

  it("scopes experiment metrics through explicit exposure records", async () => {
    const query = jest.spyOn(AppDataSource, "query").mockResolvedValue([]);
    const repository = new PromptRepository();
    const experimentId = "a247c152-3277-4c91-9b22-95cb7a459d1e";

    await repository.getExperimentMetricsBatch("workspace-1", [experimentId]);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain('"prompt_experiment_exposure"');
    expect(query.mock.calls[0]?.[0]).toContain('matched_runs."experimentId"');
    expect(query.mock.calls[0]?.[1]).toEqual(["workspace-1", [experimentId]]);
  });

  it("uses entity property paths when paginating joined deployment rows", async () => {
    const builder = {
      innerJoinAndSelect: jest.fn(),
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      take: jest.fn(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    for (const method of [
      "innerJoinAndSelect",
      "leftJoinAndSelect",
      "where",
      "andWhere",
      "orderBy",
      "addOrderBy",
      "take",
    ] as const) {
      builder[method].mockReturnValue(builder);
    }
    jest.spyOn(AppDataSource, "getRepository").mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    } as never);
    const repository = new PromptRepository();

    await repository.listDeploymentOperations("workspace-1", { limit: 25 });

    // 조인과 take를 함께 쓸 때 SQL 인용식은 TypeORM alias 메타데이터를 깨뜨립니다.
    expect(builder.orderBy).toHaveBeenCalledWith(
      "deployment.deployedAt",
      "DESC",
    );
  });
});
