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
  getDebugLatency,
  getDebugMemory,
  getDebugPatterns,
  getDebugRootCause,
  getDebugSessionEvents,
  getDebugSessions,
  getDebugTimeline,
  reproduceDebugSession,
  simulateDebugPolicy,
} from "@/services/debug.service";

export const debugQueryKeys = {
  all: ["debug"] as const,
  sessions: (query: DebugSessionListQueryDto | undefined) =>
    [...debugQueryKeys.all, "sessions", query] as const,
  events: (sessionId: string | undefined, query: DebugEventLogQueryDto) =>
    [...debugQueryKeys.all, "events", sessionId, query] as const,
  timeline: (sessionId: string | undefined, query: DebugTimelineQueryDto) =>
    [...debugQueryKeys.all, "timeline", sessionId, query] as const,
  rootCause: (sessionId: string | undefined, query: DebugTimelineQueryDto) =>
    [...debugQueryKeys.all, "root-cause", sessionId, query] as const,
  memory: (sessionId: string | undefined, query: DebugTimelineQueryDto) =>
    [...debugQueryKeys.all, "memory", sessionId, query] as const,
  patterns: (query: DebugAnalysisQueryDto | undefined) =>
    [...debugQueryKeys.all, "patterns", query] as const,
  bottlenecks: (query: DebugAnalysisQueryDto | undefined) =>
    [...debugQueryKeys.all, "bottlenecks", query] as const,
  latency: (query: DebugAnalysisQueryDto | undefined) =>
    [...debugQueryKeys.all, "latency", query] as const,
};

export function useDebugSessionsQuery(query: DebugSessionListQueryDto) {
  return useQuery({
    queryKey: debugQueryKeys.sessions(query),
    queryFn: () => getDebugSessions(query),
    enabled: Boolean(query.workspaceId),
  });
}

export function useDebugSessionEventsQuery(
  sessionId: string | undefined,
  query: DebugEventLogQueryDto,
) {
  return useQuery({
    queryKey: debugQueryKeys.events(sessionId, query),
    queryFn: () => getDebugSessionEvents(sessionId!, query),
    enabled: Boolean(sessionId && query.workspaceId),
  });
}

export function useDebugTimelineQuery(
  sessionId: string | undefined,
  query: DebugTimelineQueryDto,
) {
  return useQuery({
    queryKey: debugQueryKeys.timeline(sessionId, query),
    queryFn: () => getDebugTimeline(sessionId!, query),
    enabled: Boolean(sessionId && query.workspaceId),
  });
}

export function useDebugRootCauseQuery(
  sessionId: string | undefined,
  query: DebugTimelineQueryDto,
) {
  return useQuery({
    queryKey: debugQueryKeys.rootCause(sessionId, query),
    queryFn: () => getDebugRootCause(sessionId!, query),
    enabled: Boolean(sessionId && query.workspaceId),
  });
}

export function useDebugMemoryQuery(
  sessionId: string | undefined,
  query: DebugTimelineQueryDto,
) {
  return useQuery({
    queryKey: debugQueryKeys.memory(sessionId, query),
    queryFn: () => getDebugMemory(sessionId!, query),
    enabled: Boolean(sessionId && query.workspaceId),
  });
}

export function useDebugPatternsQuery(query: DebugAnalysisQueryDto) {
  return useQuery({
    queryKey: debugQueryKeys.patterns(query),
    queryFn: () => getDebugPatterns(query),
    enabled: Boolean(query.workspaceId),
  });
}

export function useDebugBottlenecksQuery(query: DebugAnalysisQueryDto) {
  return useQuery({
    queryKey: debugQueryKeys.bottlenecks(query),
    queryFn: () => getDebugBottlenecks(query),
    enabled: Boolean(query.workspaceId),
  });
}

export function useDebugLatencyQuery(query: DebugAnalysisQueryDto) {
  return useQuery({
    queryKey: debugQueryKeys.latency(query),
    queryFn: () => getDebugLatency(query),
    enabled: Boolean(query.workspaceId),
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
