import { useQuery } from "@tanstack/react-query";
import type {
  SessionDetailQueryDto,
  SessionListQueryDto,
  SessionPageKind,
} from "@repo/dto";
import {
  getSessionDetail,
  getSessionsByKind,
  getSessionTimeline,
} from "@/services/session.service";

type OptionalWorkspaceQuery<T extends { workspaceId: string }> = Omit<
  T,
  "workspaceId"
> & {
  workspaceId?: string;
};

export const sessionQueryKeys = {
  all: ["session"] as const,
  list: (
    kind: SessionPageKind,
    query: OptionalWorkspaceQuery<SessionListQueryDto>,
  ) => [...sessionQueryKeys.all, "list", kind, query] as const,
  detail: (
    sessionId: string | undefined,
    query: OptionalWorkspaceQuery<SessionDetailQueryDto>,
  ) => [...sessionQueryKeys.all, "detail", sessionId, query] as const,
  timeline: (
    sessionId: string | undefined,
    query: OptionalWorkspaceQuery<SessionDetailQueryDto>,
  ) => [...sessionQueryKeys.all, "timeline", sessionId, query] as const,
};

export function useSessionsQuery(
  kind: SessionPageKind,
  query: OptionalWorkspaceQuery<SessionListQueryDto>,
) {
  return useQuery({
    queryKey: sessionQueryKeys.list(kind, query),
    queryFn: () =>
      getSessionsByKind(kind, {
        ...query,
        kind,
      } as SessionListQueryDto),
    enabled: Boolean(query.workspaceId),
  });
}

export function useSessionDetailQuery(
  sessionId: string | undefined,
  query: OptionalWorkspaceQuery<SessionDetailQueryDto>,
) {
  return useQuery({
    queryKey: sessionQueryKeys.detail(sessionId, query),
    queryFn: () => getSessionDetail(sessionId!, query as SessionDetailQueryDto),
    enabled: Boolean(sessionId && query.workspaceId),
  });
}

export function useSessionTimelineQuery(
  sessionId: string | undefined,
  query: OptionalWorkspaceQuery<SessionDetailQueryDto>,
) {
  return useQuery({
    queryKey: sessionQueryKeys.timeline(sessionId, query),
    queryFn: () =>
      getSessionTimeline(sessionId!, query as SessionDetailQueryDto),
    enabled: Boolean(sessionId && query.workspaceId),
  });
}
