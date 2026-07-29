import { organizationContract } from "@repo/contract";
import type { OrganizationListResponseDto } from "@repo/dto";
import { requestContract } from "./api";

/** 현재 사용자가 참여 중인 조직을 조회합니다. */
export async function listAvailableOrganizations(): Promise<OrganizationListResponseDto> {
  return requestContract({
    basePath: organizationContract.basePath,
    endpoint: organizationContract.list,
  });
}
