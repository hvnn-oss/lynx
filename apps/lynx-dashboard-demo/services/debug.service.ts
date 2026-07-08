import type {
  DebugAnalysisQueryDto,
  DebugBottleneckResponseDto,
  DebugEventLogQueryDto,
  DebugEventLogResponseDto,
  DebugErrorGroupListResponseDto,
  DebugFailurePatternResponseDto,
  DebugLatencyResponseDto,
  DebugLlmCallListResponseDto,
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
  DebugToolCallListResponseDto,
} from "@repo/dto";
import { getJson, postJson, type QueryParams } from "@/lib/api";

const debugBasePath = "/api/v1/debug";

export function getDebugSessions(query: DebugSessionListQueryDto) {
  return getJson<DebugSessionListResponseDto>(
    `${debugBasePath}/sessions`,
    query as QueryParams,
  );
}

export function getDebugLogs(query: DebugEventLogQueryDto) {
  return getJson<DebugEventLogResponseDto>(
    `${debugBasePath}/logs`,
    query as QueryParams,
  );
}

export function getDebugToolCalls(query: DebugEventLogQueryDto) {
  return getJson<DebugToolCallListResponseDto>(
    `${debugBasePath}/tool-calls`,
    query as QueryParams,
  );
}

export function getDebugLlmCalls(query: DebugEventLogQueryDto) {
  return getJson<DebugLlmCallListResponseDto>(
    `${debugBasePath}/llm-io`,
    query as QueryParams,
  );
}

export function getDebugErrors(query: DebugEventLogQueryDto) {
  return getJson<DebugErrorGroupListResponseDto>(
    `${debugBasePath}/errors`,
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

export function getDebugMemory(
  sessionId: string,
  query: DebugTimelineQueryDto,
) {
  return getJson<DebugMemoryResponseDto>(
    `${debugBasePath}/sessions/${sessionId}/memory`,
    query as QueryParams,
  );
}

export function getDebugPatterns(query: DebugAnalysisQueryDto) {
  return getJson<DebugFailurePatternResponseDto>(
    `${debugBasePath}/patterns`,
    query as QueryParams,
  );
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
