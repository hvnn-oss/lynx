import { useQuery } from "@tanstack/react-query";
import type {
  AgentDetailQueryDto,
  AgentListQueryDto,
  AgentPageKind,
} from "@repo/dto";
import { getAgentDetail, getAgentsByKind } from "@/services/agent.service";

type OptionalWorkspaceQuery<T extends { workspaceId: string }> = Omit<
  T,
  "workspaceId"
> & {
  workspaceId?: string;
};

export const agentQueryKeys = {
  all: ["agent"] as const,
  list: (
    kind: AgentPageKind,
    query: OptionalWorkspaceQuery<AgentListQueryDto>,
  ) => [...agentQueryKeys.all, "list", kind, query] as const,
  detail: (
    agentId: string | undefined,
    query: OptionalWorkspaceQuery<AgentDetailQueryDto>,
  ) => [...agentQueryKeys.all, "detail", agentId, query] as const,
};

export function useAgentsQuery(
  kind: AgentPageKind,
  query: OptionalWorkspaceQuery<AgentListQueryDto>,
) {
  return useQuery({
    queryKey: agentQueryKeys.list(kind, query),
    queryFn: () =>
      getAgentsByKind(kind, { ...query, kind } as AgentListQueryDto),
    enabled: Boolean(query.workspaceId),
  });
}

export function useAgentDetailQuery(
  agentId: string | undefined,
  query: OptionalWorkspaceQuery<AgentDetailQueryDto>,
) {
  return useQuery({
    queryKey: agentQueryKeys.detail(agentId, query),
    queryFn: () => getAgentDetail(agentId!, query as AgentDetailQueryDto),
    enabled: Boolean(agentId && query.workspaceId),
  });
}

