import type {
  DebugAnalysisQueryDto,
  DebugBottleneckResponseDto,
  DebugEventLogQueryDto,
  DebugEventLogResponseDto,
  DebugLatencyResponseDto,
  DebugMemoryResponseDto,
  DebugPolicySimulationRequestDto,
  DebugPolicySimulationResponseDto,
  DebugReproduceRequestDto,
  DebugReproduceResponseDto,
  DebugRootCauseResponseDto,
  DebugSessionListQueryDto,
  DebugSessionListResponseDto,
  DebugTimelineQueryDto,
  DebugTimelineResponseDto,
} from "@repo/dto";
import { getJson, postJson, type QueryParams } from "@/lib/api";

const debugBasePath = "/api/v1/debug";

export function getDebugSessions(query: DebugSessionListQueryDto) {
  return getJson<DebugSessionListResponseDto>(
    `${debugBasePath}/sessions`,
    query as QueryParams,
  );
}

export function getDebugSessionEvents(
  sessionId: string,
  query: DebugEventLogQueryDto,
) {
  return getJson<DebugEventLogResponseDto>(
    `${debugBasePath}/sessions/${sessionId}/events`,
    query as QueryParams,
  );
}

export function getDebugTimeline(
  sessionId: string,
  query: DebugTimelineQueryDto,
) {
  return getJson<DebugTimelineResponseDto>(
    `${debugBasePath}/sessions/${sessionId}/timeline`,
    query as QueryParams,
  );
}

export function getDebugRootCause(
  sessionId: string,
  query: DebugTimelineQueryDto,
) {
  return getJson<DebugRootCauseResponseDto>(
    `${debugBasePath}/sessions/${sessionId}/root-cause`,
    query as QueryParams,
  );
}

export function getDebugMemory(sessionId: string, query: DebugTimelineQueryDto) {
  return getJson<DebugMemoryResponseDto>(
    `${debugBasePath}/sessions/${sessionId}/memory`,
    query as QueryParams,
  );
}

export function getDebugPatterns(query: DebugAnalysisQueryDto) {
  return getJson(`${debugBasePath}/patterns`, query as QueryParams);
}

export function getDebugBottlenecks(query: DebugAnalysisQueryDto) {
  return getJson<DebugBottleneckResponseDto>(
    `${debugBasePath}/bottlenecks`,
    query as QueryParams,
  );
}

export function getDebugLatency(query: DebugAnalysisQueryDto) {
  return getJson<DebugLatencyResponseDto>(
    `${debugBasePath}/latency`,
    query as QueryParams,
  );
}

export function reproduceDebugSession(
  sessionId: string,
  body: DebugReproduceRequestDto,
) {
  return postJson<DebugReproduceResponseDto, DebugReproduceRequestDto>(
    `${debugBasePath}/sessions/${sessionId}/reproduce`,
    body,
  );
}

export function simulateDebugPolicy(
  sessionId: string,
  body: DebugPolicySimulationRequestDto,
) {
  return postJson<
    DebugPolicySimulationResponseDto,
    DebugPolicySimulationRequestDto
  >(`${debugBasePath}/sessions/${sessionId}/policy/simulate`, body);
}
