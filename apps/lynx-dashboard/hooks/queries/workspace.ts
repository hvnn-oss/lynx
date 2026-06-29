"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateOrganizationDto, CreateWorkspaceDto } from "@repo/dto";
import {
  createOrganization,
  createWorkspace,
  getWorkspace,
  getOrganizations,
  getWorkspaces,
  rotateWorkspaceApiKey,
  updateWorkspace,
} from "@/services/workspace.service";
import type { UpdateWorkspaceDto } from "@repo/dto";

export const workspaceQueryKeys = {
  all: ["workspace"] as const,
  list: () => [...workspaceQueryKeys.all, "list"] as const,
  organizations: () => [...workspaceQueryKeys.all, "organizations"] as const,
  detail: (workspaceId: string | undefined) =>
    [...workspaceQueryKeys.all, "detail", workspaceId] as const,
};

export function useOrganizationsQuery() {
  return useQuery({
    queryKey: workspaceQueryKeys.organizations(),
    queryFn: getOrganizations,
  });
}

export function useWorkspacesQuery() {
  return useQuery({
    queryKey: workspaceQueryKeys.list(),
    queryFn: getWorkspaces,
  });
}

export function useWorkspaceDetailQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceQueryKeys.detail(workspaceId),
    queryFn: () => getWorkspace(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateOrganizationDto) => createOrganization(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.organizations(),
      });
    },
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateWorkspaceDto) => createWorkspace(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.list() });
    },
  });
}

export function useUpdateWorkspaceMutation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateWorkspaceDto) => {
      if (!workspaceId) {
        throw new Error("Workspace is not selected.");
      }
      return updateWorkspace(workspaceId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.detail(workspaceId),
      });
    },
  });
}

export function useRotateWorkspaceApiKeyMutation(
  workspaceId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!workspaceId) {
        throw new Error("Workspace is not selected.");
      }
      return rotateWorkspaceApiKey(workspaceId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.detail(workspaceId),
      });
    },
  });
}
