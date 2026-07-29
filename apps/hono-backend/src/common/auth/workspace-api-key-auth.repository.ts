import { WorkspaceApiKeyEntity } from "@repo/database";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

/** Workspace API 키 인증에 필요한 최소 저장소 작업을 제공합니다. */
export class WorkspaceApiKeyAuthRepository {
  /** 공개 식별자로 API 키 record를 조회합니다. */
  findById(apiKeyId: string): Promise<WorkspaceApiKeyEntity | null> {
    return AppDataSource.getRepository(WorkspaceApiKeyEntity).findOneBy({
      id: apiKeyId,
    });
  }

  /** 최근 사용 시각을 갱신하되 짧은 간격의 중복 쓰기는 건너뜁니다. */
  async touchLastUsed(
    apiKeyId: string,
    usedAt: Date,
    staleBefore: Date,
  ): Promise<void> {
    await AppDataSource.getRepository(WorkspaceApiKeyEntity)
      .createQueryBuilder()
      .update()
      .set({ lastUsedAt: usedAt })
      .where("id = :apiKeyId", { apiKeyId })
      .andWhere(
        '("lastUsedAt" IS NULL OR "lastUsedAt" < :staleBefore)',
        { staleBefore },
      )
      .execute();
  }
}

/** 애플리케이션에서 공유하는 Workspace API 키 인증 저장소입니다. */
export const workspaceApiKeyAuthRepository =
  new WorkspaceApiKeyAuthRepository();
