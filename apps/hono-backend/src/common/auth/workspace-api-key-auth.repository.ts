import { AppDataSource, WorkspaceApiKeyEntity } from "@repo/database";

/** Workspace API 키 인증에 필요한 최소 저장소 작업을 제공합니다. */
export class WorkspaceApiKeyAuthRepository {
  /** 공개 식별자로 API 키 record를 조회합니다. */
  findById(apiKeyId: string): Promise<WorkspaceApiKeyEntity | null> {
    return AppDataSource.getRepository(WorkspaceApiKeyEntity).findOneBy({
      id: apiKeyId,
    });
  }
}

/** 애플리케이션에서 공유하는 Workspace API 키 인증 저장소입니다. */
export const workspaceApiKeyAuthRepository =
  new WorkspaceApiKeyAuthRepository();
