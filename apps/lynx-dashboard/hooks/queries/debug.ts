"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  DebugAnalysisQueryDto,
  DebugEventLogQueryDto,
  DebugPolicySimulationRequestDto,
  DebugReproduceRequestDto,
  DebugSessionListQueryDto,
  DebugTimelineQueryDto,
} from "@repo/dto";
import {
  getDebugBottlenecks,
  getDebugErrors,
  getDebugLatency,
  getDebugLlmCalls,
  getDebugLogs,
  getDebugMemory,
  getDebugPatterns,
  getDebugRootCause,
  getDebugSessionEvents,
  getDebugSessions,
  getDebugTimeline,
  getDebugToolCalls,
  reproduceDebugSession,
  simulateDebugPolicy,
} from "@/services/debug.service";

type OptionalWorkspaceQuery<T extends { workspaceId: string }> = Omit<
  T,
  "workspaceId"
> & {
  workspaceId?: string;
};

function hasWorkspaceId<T extends { workspaceId?: string }>(
  query: T,
): query is T & { workspaceId: string } {
  return Boolean(query.workspaceId);
}

export const debugQueryKeys = {
  all: ["debug"] as const,
  sessions: (query: OptionalWorkspaceQuery<DebugSessionListQueryDto>) =>
    [...debugQueryKeys.all, "sessions", query] as const,
  logs: (query: OptionalWorkspaceQuery<DebugEventLogQueryDto>) =>
    [...debugQueryKeys.all, "logs", query] as const,
  toolCalls: (query: OptionalWorkspaceQuery<DebugEventLogQueryDto>) =>
    [...debugQueryKeys.all, "tool-calls", query] as const,
  llmCalls: (query: OptionalWorkspaceQuery<DebugEventLogQueryDto>) =>
    [...debugQueryKeys.all, "llm-io", query] as const,
  errors: (query: OptionalWorkspaceQuery<DebugEventLogQueryDto>) =>
    [...debugQueryKeys.all, "errors", query] as const,
  events: (
    sessionId: string | undefined,
    query: OptionalWorkspaceQuery<DebugEventLogQueryDto>,
  ) => [...debugQueryKeys.all, "events", sessionId, query] as const,
  timeline: (
    sessionId: string | undefined,
    query: OptionalWorkspaceQuery<DebugTimelineQueryDto>,
  ) => [...debugQueryKeys.all, "timeline", sessionId, query] as const,
  rootCause: (
    sessionId: string | undefined,
    query: OptionalWorkspaceQuery<DebugTimelineQueryDto>,
  ) => [...debugQueryKeys.all, "root-cause", sessionId, query] as const,
  memory: (
    sessionId: string | undefined,
    query: OptionalWorkspaceQuery<DebugTimelineQueryDto>,
  ) => [...debugQueryKeys.all, "memory", sessionId, query] as const,
  patterns: (query: OptionalWorkspaceQuery<DebugAnalysisQueryDto>) =>
    [...debugQueryKeys.all, "patterns", query] as const,
  bottlenecks: (query: OptionalWorkspaceQuery<DebugAnalysisQueryDto>) =>
    [...debugQueryKeys.all, "bottlenecks", query] as const,
  latency: (query: OptionalWorkspaceQuery<DebugAnalysisQueryDto>) =>
    [...debugQueryKeys.all, "latency", query] as const,
};

export function useDebugSessionsQuery(
  query: OptionalWorkspaceQuery<DebugSessionListQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.sessions(query),
    queryFn: () => getDebugSessions(query as DebugSessionListQueryDto),
    enabled: hasWorkspaceId(query),
  });
}

export function useDebugLogsQuery(
  query: OptionalWorkspaceQuery<DebugEventLogQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.logs(query),
    queryFn: () => getDebugLogs(query as DebugEventLogQueryDto),
    enabled: hasWorkspaceId(query),
  });
}

export function useDebugToolCallsQuery(
  query: OptionalWorkspaceQuery<DebugEventLogQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.toolCalls(query),
    queryFn: () => getDebugToolCalls(query as DebugEventLogQueryDto),
    enabled: hasWorkspaceId(query),
  });
}

export function useDebugLlmCallsQuery(
  query: OptionalWorkspaceQuery<DebugEventLogQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.llmCalls(query),
    queryFn: () => getDebugLlmCalls(query as DebugEventLogQueryDto),
    enabled: hasWorkspaceId(query),
  });
}

export function useDebugErrorsQuery(
  query: OptionalWorkspaceQuery<DebugEventLogQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.errors(query),
    queryFn: () => getDebugErrors(query as DebugEventLogQueryDto),
    enabled: hasWorkspaceId(query),
  });
}

export function useDebugSessionEventsQuery(
  sessionId: string | undefined,
  query: OptionalWorkspaceQuery<DebugEventLogQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.events(sessionId, query),
    queryFn: () =>
      getDebugSessionEvents(sessionId!, query as DebugEventLogQueryDto),
    enabled: Boolean(sessionId && hasWorkspaceId(query)),
  });
}

export function useDebugTimelineQuery(
  sessionId: string | undefined,
  query: OptionalWorkspaceQuery<DebugTimelineQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.timeline(sessionId, query),
    queryFn: () => getDebugTimeline(sessionId!, query as DebugTimelineQueryDto),
    enabled: Boolean(sessionId && hasWorkspaceId(query)),
  });
}

export function useDebugRootCauseQuery(
  sessionId: string | undefined,
  query: OptionalWorkspaceQuery<DebugTimelineQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.rootCause(sessionId, query),
    queryFn: () =>
      getDebugRootCause(sessionId!, query as DebugTimelineQueryDto),
    enabled: Boolean(sessionId && hasWorkspaceId(query)),
  });
}

export function useDebugMemoryQuery(
  sessionId: string | undefined,
  query: OptionalWorkspaceQuery<DebugTimelineQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.memory(sessionId, query),
    queryFn: () => getDebugMemory(sessionId!, query as DebugTimelineQueryDto),
    enabled: Boolean(sessionId && hasWorkspaceId(query)),
  });
}

export function useDebugPatternsQuery(
  query: OptionalWorkspaceQuery<DebugAnalysisQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.patterns(query),
    queryFn: () => getDebugPatterns(query as DebugAnalysisQueryDto),
    enabled: hasWorkspaceId(query),
  });
}

export function useDebugBottlenecksQuery(
  query: OptionalWorkspaceQuery<DebugAnalysisQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.bottlenecks(query),
    queryFn: () => getDebugBottlenecks(query as DebugAnalysisQueryDto),
    enabled: hasWorkspaceId(query),
  });
}

export function useDebugLatencyQuery(
  query: OptionalWorkspaceQuery<DebugAnalysisQueryDto>,
) {
  return useQuery({
    queryKey: debugQueryKeys.latency(query),
    queryFn: () => getDebugLatency(query as DebugAnalysisQueryDto),
    enabled: hasWorkspaceId(query),
  });
}

export function useDebugReproduceMutation(sessionId: string) {
  return useMutation({
    mutationFn: (body: DebugReproduceRequestDto) =>
      reproduceDebugSession(sessionId, body),
  });
}

export function useDebugPolicySimulationMutation(sessionId: string) {
  return useMutation({
    mutationFn: (body: DebugPolicySimulationRequestDto) =>
      simulateDebugPolicy(sessionId, body),
  });
}
