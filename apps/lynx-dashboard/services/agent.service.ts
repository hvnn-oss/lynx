import type {
  AgentDetailQueryDto,
  AgentDetailResponseDto,
  AgentListQueryDto,
  AgentListResponseDto,
} from "@repo/dto";
import { getJson, type QueryParams } from "@/lib/api";

const agentBasePath = "/api/v1/agent";

export function getAgents(query: AgentListQueryDto) {
  return getJson<AgentListResponseDto>(agentBasePath, query as QueryParams);
}

export function getAgentsByKind(
  kind: NonNullable<AgentListQueryDto["kind"]>,
  query: AgentListQueryDto,
) {
  if (
    kind === "latency" ||
    kind === "tokens" ||
    kind === "success-rate" ||
    kind === "cost"
  ) {
    return getJson<AgentListResponseDto>(
      `${agentBasePath}/perf/${kind}`,
      query as QueryParams,
    );
  }

  return getJson<AgentListResponseDto>(
    `${agentBasePath}/${kind}`,
    query as QueryParams,
  );
}

export function getAgentDetail(
  agentId: string,
  query: AgentDetailQueryDto,
) {
  return getJson<AgentDetailResponseDto>(
    `${agentBasePath}/${agentId}`,
    query as QueryParams,
  );
}

