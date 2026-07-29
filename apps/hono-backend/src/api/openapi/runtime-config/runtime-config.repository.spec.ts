import { AgentEntity } from "@repo/database";
import { AppDataSource } from "../../../provider/database/typeorm-config.js";
import { RuntimeConfigRepository } from "./runtime-config.repository.js";

jest.mock("../../../provider/database/typeorm-config.js", () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe("RuntimeConfigRepository", () => {
  it("resolves an SDK agentId through the workspace clientAgentId", async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: "34640358-38db-4bc7-a700-6d61d1536298",
    });
    jest.mocked(AppDataSource.getRepository).mockReturnValue({
      findOne,
    } as never);

    const result = await new RuntimeConfigRepository().resolveAgentId(
      "workspace-1",
      "orbit-assistant",
    );

    expect(AppDataSource.getRepository).toHaveBeenCalledWith(AgentEntity);
    expect(findOne).toHaveBeenCalledWith({
      where: {
        clientAgentId: "orbit-assistant",
        workspace: { id: "workspace-1" },
      },
      select: { id: true },
    });
    expect(result).toBe("34640358-38db-4bc7-a700-6d61d1536298");
  });

  it("returns no internal ID when the Agent has not been registered", async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    jest.mocked(AppDataSource.getRepository).mockReturnValue({
      findOne,
    } as never);

    await expect(
      new RuntimeConfigRepository().resolveAgentId(
        "workspace-1",
        "new-agent",
      ),
    ).resolves.toBeUndefined();
  });

  it("accepts an internal UUID for backward compatibility", async () => {
    const internalAgentId = "34640358-38db-4bc7-a700-6d61d1536298";
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: internalAgentId });
    jest.mocked(AppDataSource.getRepository).mockReturnValue({
      findOne,
    } as never);

    await expect(
      new RuntimeConfigRepository().resolveAgentId(
        "workspace-1",
        internalAgentId,
      ),
    ).resolves.toBe(internalAgentId);
    expect(findOne).toHaveBeenNthCalledWith(2, {
      where: {
        id: internalAgentId,
        workspace: { id: "workspace-1" },
      },
      select: { id: true },
    });
  });
});
