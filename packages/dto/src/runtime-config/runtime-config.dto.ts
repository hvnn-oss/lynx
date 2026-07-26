import { z } from "zod";
import {
  SdkRuntimeConfigRequestSchema,
  SdkRuntimeConfigResponseSchema,
  SdkRuntimePolicySchema,
  SdkRuntimePromptSchema,
} from "@repo/sdk-types";

/** SDK에 배포되는 현재 프롬프트 버전의 응답 구조입니다. */
const LegacyRuntimePromptSchema = z.object({
  promptId: z.string().uuid(),
  name: z.string(),
  versionId: z.string().uuid(),
  version: z.string(),
  content: z.string(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
});

/** SDK가 로컬에서 평가할 활성 방화벽 정책의 응답 구조입니다. */
const LegacyRuntimePolicySchema = z.object({
  policyId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.string(),
  condition: z.string(),
  severity: z.string(),
  action: z.string(),
});

/** 런타임 설정 조회 요청에는 별도 쿼리 파라미터가 없습니다. */
export const RuntimePromptSchema = SdkRuntimePromptSchema;
export const RuntimePolicySchema = SdkRuntimePolicySchema;
export const RuntimeConfigRequestSchema = SdkRuntimeConfigRequestSchema;

/** 워크스페이스의 프롬프트와 정책을 한 번에 전달하는 응답 구조입니다. */
export const RuntimeConfigResponseSchema = SdkRuntimeConfigResponseSchema;

/** 런타임 설정 조회 API가 반환하는 DTO입니다. */
export type RuntimeConfigResponseDto = z.infer<
  typeof RuntimeConfigResponseSchema
>;
