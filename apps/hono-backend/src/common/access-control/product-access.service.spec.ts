import {
  ERROR_CODES,
  PRODUCT_ACCESS_CAPABILITY,
  PRODUCT_ACCESS_GRANT_STATUS,
  PRODUCT_ACCESS_MODE,
  PRODUCT_ACCESS_STATUS,
  PRODUCT_ACCESS_SUBJECT_TYPE,
} from "@repo/constants";
import { ProductAccessGrantEntity } from "@repo/database";
import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { env } from "../config/config.js";
import { ProductAccessService } from "./product-access.service.js";

describe("ProductAccessService", () => {
  const originalMode = env.PRODUCT_ACCESS_MODE;

  afterEach(() => {
    env.PRODUCT_ACCESS_MODE = originalMode;
    jest.restoreAllMocks();
  });

  it("PUBLIC 모드에서는 grant 조회 없이 제품 사용을 허용한다", async () => {
    env.PRODUCT_ACCESS_MODE = PRODUCT_ACCESS_MODE.PUBLIC;
    const getRepository = jest.spyOn(AppDataSource, "getRepository");

    await expect(
      new ProductAccessService().getUserContext("user-1"),
    ).resolves.toEqual({
      mode: PRODUCT_ACCESS_MODE.PUBLIC,
      status: PRODUCT_ACCESS_STATUS.ACTIVE,
      canUseProduct: true,
      canCreateWorkspace: true,
      reason: null,
    });
    expect(getRepository).not.toHaveBeenCalled();
  });

  it("INVITE_ONLY 모드에서 grant가 없으면 승인 대기 상태를 반환한다", async () => {
    env.PRODUCT_ACCESS_MODE = PRODUCT_ACCESS_MODE.INVITE_ONLY;
    jest.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOneBy: jest.fn().mockResolvedValue(null),
    } as never);

    await expect(
      new ProductAccessService().getUserContext("user-1"),
    ).resolves.toMatchObject({
      mode: PRODUCT_ACCESS_MODE.INVITE_ONLY,
      status: PRODUCT_ACCESS_STATUS.PENDING,
      canUseProduct: false,
      reason: ERROR_CODES.PRODUCT_ACCESS_NOT_GRANTED,
    });
  });

  it("활성 grant와 만료 시각을 함께 확인한다", async () => {
    env.PRODUCT_ACCESS_MODE = PRODUCT_ACCESS_MODE.INVITE_ONLY;
    const findOneBy = jest
      .fn()
      .mockResolvedValueOnce({
        status: PRODUCT_ACCESS_GRANT_STATUS.ACTIVE,
        expiresAt: null,
      })
      .mockResolvedValueOnce({
        status: PRODUCT_ACCESS_GRANT_STATUS.ACTIVE,
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      });
    jest
      .spyOn(AppDataSource, "getRepository")
      .mockReturnValue({ findOneBy } as never);
    const service = new ProductAccessService();

    await expect(service.getUserContext("user-1")).resolves.toMatchObject({
      status: PRODUCT_ACCESS_STATUS.ACTIVE,
      canUseProduct: true,
    });
    await expect(service.getUserContext("user-2")).resolves.toMatchObject({
      status: PRODUCT_ACCESS_STATUS.EXPIRED,
      canUseProduct: false,
    });
  });

  it("Workspace grant가 없으면 기존 API Key 사용도 거부한다", async () => {
    env.PRODUCT_ACCESS_MODE = PRODUCT_ACCESS_MODE.INVITE_ONLY;
    const findOneBy = jest.fn().mockResolvedValue(null);
    jest
      .spyOn(AppDataSource, "getRepository")
      .mockReturnValue({ findOneBy } as never);

    await expect(
      new ProductAccessService().assertWorkspaceAccess("workspace-1"),
    ).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.PRODUCT_ACCESS_NOT_GRANTED,
    });
    expect(findOneBy).toHaveBeenCalledWith({
      subjectType: PRODUCT_ACCESS_SUBJECT_TYPE.WORKSPACE,
      subjectId: "workspace-1",
      capability: PRODUCT_ACCESS_CAPABILITY.LYNX_CORE,
    });
  });

  it("초대 수락 트랜잭션에서 사용자 grant를 upsert한다", async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const manager = {
      getRepository: jest.fn((entity) => {
        expect(entity).toBe(ProductAccessGrantEntity);
        return { upsert };
      }),
    } as unknown as EntityManager;

    await new ProductAccessService().grantUser(
      manager,
      "user-1",
      "admin-1",
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectType: PRODUCT_ACCESS_SUBJECT_TYPE.USER,
        subjectId: "user-1",
        capability: PRODUCT_ACCESS_CAPABILITY.LYNX_CORE,
        status: PRODUCT_ACCESS_GRANT_STATUS.ACTIVE,
        grantedByUserId: "admin-1",
      }),
      ["subjectType", "subjectId", "capability"],
    );
  });

  it("워크스페이스 생성 트랜잭션에서 Workspace grant를 upsert한다", async () => {
    env.PRODUCT_ACCESS_MODE = PRODUCT_ACCESS_MODE.INVITE_ONLY;
    const upsert = jest.fn().mockResolvedValue(undefined);
    const manager = {
      getRepository: jest.fn((entity) => {
        expect(entity).toBe(ProductAccessGrantEntity);
        return { upsert };
      }),
    } as unknown as EntityManager;

    await new ProductAccessService().grantWorkspace(
      manager,
      "user-1",
      "workspace-1",
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectType: PRODUCT_ACCESS_SUBJECT_TYPE.WORKSPACE,
        subjectId: "workspace-1",
        capability: PRODUCT_ACCESS_CAPABILITY.LYNX_CORE,
        status: PRODUCT_ACCESS_GRANT_STATUS.ACTIVE,
        grantedByUserId: "user-1",
      }),
      ["subjectType", "subjectId", "capability"],
    );
  });
});
