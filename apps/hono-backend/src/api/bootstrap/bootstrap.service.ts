import type { DashboardBootstrapResponseDto } from "@repo/dto";
import {
  OrganizationService,
  orgService,
} from "../organization/organization.service.js";
import { ProfileService, profileService } from "../profile/profile.service.js";
import {
  WorkspaceService,
  workspaceService,
} from "../workspace/workspace.service.js";
import {
  ProductAccessService,
  productAccessService,
} from "../../common/access-control/product-access.service.js";

/**
 * 대시보드 첫 로드에 필요한 사용자 컨텍스트를 하나의 응답으로 구성합니다.
 */
export class BootstrapService {
  constructor(
    private readonly profiles: Pick<
      ProfileService,
      "getProfile"
    > = profileService,
    private readonly organizations: Pick<
      OrganizationService,
      "listOrganizations"
    > = orgService,
    private readonly workspaces: Pick<
      WorkspaceService,
      "listWorkspaces"
    > = workspaceService,
    private readonly productAccess: Pick<
      ProductAccessService,
      "getUserContext"
    > = productAccessService,
  ) {}

  /**
   * 사용자, 참여 조직, 접근 가능한 워크스페이스를 병렬로 조회합니다.
   *
   * @param userId 인증된 사용자의 식별자입니다.
   * @returns 대시보드 전역 상태를 초기화할 사용자 컨텍스트입니다.
   */
  async getDashboardContext(
    userId: string,
  ): Promise<DashboardBootstrapResponseDto> {
    const [user, access] = await Promise.all([
      this.profiles.getProfile(userId),
      this.productAccess.getUserContext(userId),
    ]);
    if (!access.canUseProduct) {
      return { user, access, organizations: [], workspaces: [] };
    }

    const [organizations, workspaces] = await Promise.all([
      this.organizations.listOrganizations(userId),
      this.workspaces.listWorkspaces(userId),
    ]);

    return {
      user,
      access,
      organizations: organizations.items,
      workspaces: workspaces.items,
    };
  }
}

/** 애플리케이션에서 공유하는 대시보드 초기화 서비스입니다. */
export const bootstrapService = new BootstrapService();
