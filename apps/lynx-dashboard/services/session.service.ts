import type {
  SessionDetailQueryDto,
  SessionDetailResponseDto,
  SessionListQueryDto,
  SessionListResponseDto,
  SessionTimelineResponseDto,
} from "@repo/dto";
import { getJson, type QueryParams } from "@/lib/api";

const sessionBasePath = "/api/v1/session";

export function getSessions(query: SessionListQueryDto) {
  return getJson<SessionListResponseDto>(sessionBasePath, query as QueryParams);
}

export function getSessionsByKind(
  kind: NonNullable<SessionListQueryDto["kind"]>,
  query: SessionListQueryDto,
) {
  return getJson<SessionListResponseDto>(
    `${sessionBasePath}/${kind}`,
    query as QueryParams,
  );
}

export function getSessionDetail(
  sessionId: string,
  query: SessionDetailQueryDto,
) {
  return getJson<SessionDetailResponseDto>(
    `${sessionBasePath}/${sessionId}`,
    query as QueryParams,
  );
}

export function getSessionTimeline(
  sessionId: string,
  query: SessionDetailQueryDto,
) {
  return getJson<SessionTimelineResponseDto>(
    `${sessionBasePath}/${sessionId}/timeline`,
    query as QueryParams,
  );
}
