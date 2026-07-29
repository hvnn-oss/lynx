import { z } from "zod";
import { OrganizationListItemSchema } from "../organization/profile.dto.js";
import { UserProfileResponseSchema } from "../profile/profile.dto.js";
import { WorkspaceResponseSchema } from "../workspace/create.dto.js";
import { ProductAccessContextSchema } from "../access/access.dto.js";

/**
 * 대시보드가 첫 화면을 그릴 때 필요한 현재 사용자 컨텍스트입니다.
 *
 * 사용자, 조직, 워크스페이스를 한 응답에 담아 초기 중복 요청을 줄입니다.
 */
export const DashboardBootstrapResponseSchema = z.object({
  user: UserProfileResponseSchema,
  access: ProductAccessContextSchema,
  organizations: z.array(OrganizationListItemSchema),
  workspaces: z.array(WorkspaceResponseSchema),
});

export type DashboardBootstrapResponseDto = z.infer<
  typeof DashboardBootstrapResponseSchema
>;
