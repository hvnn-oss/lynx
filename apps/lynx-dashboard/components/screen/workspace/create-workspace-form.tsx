"use client";

import { createWorkspace } from "@/lib/dashboard";
import { listAvailableOrganizations } from "@/lib/organizations";
import { ERROR_CODES, USER_PERMISSIONS } from "@repo/constants";
import type { WorkspaceListResponseDto } from "@repo/dto";
import { Button } from "@repo/ui/components/ui/button";
import { DashRing } from "@repo/ui/components/ui/dash-ring";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import axios from "axios";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

const WORKSPACE_CREATOR_ROLES = new Set<string>([
  USER_PERMISSIONS.OWNER,
  USER_PERMISSIONS.ADMIN,
]);

/** 조직을 선택하고 첫 워크스페이스를 생성하는 폼입니다. */
export function CreateWorkspaceForm() {
  const t = useTranslations("workspace.create");
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizations = useQuery({
    queryKey: ["organizations", "available"],
    queryFn: listAvailableOrganizations,
  });
  const availableOrganizations = useMemo(
    () =>
      organizations.data?.items.filter((organization) =>
        WORKSPACE_CREATOR_ROLES.has(organization.role),
      ) ?? [],
    [organizations.data],
  );
  const [organizationId, setOrganizationId] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedOrganizationId = availableOrganizations.some(
    (organization) => organization.id === organizationId,
  )
    ? organizationId
    : (availableOrganizations[0]?.id ?? "");

  /** 생성된 워크스페이스를 캐시에 반영한 뒤 Overview로 이동합니다. */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const workspaceName = name.trim();
    if (!workspaceName || !selectedOrganizationId || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      const workspace = await createWorkspace({
        name: workspaceName,
        orgId: selectedOrganizationId,
      });
      queryClient.setQueryData<WorkspaceListResponseDto>(
        ["workspaces", "available"],
        (current) => ({
          items: current ? [...current.items, workspace] : [workspace],
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: ["workspaces", "available"],
      });
      router.replace("/dashboard/overview");
    } catch (cause) {
      const errorCode = axios.isAxiosError(cause)
        ? cause.response?.data?.code
        : undefined;
      setError(
        errorCode === ERROR_CODES.PLAN_UPGRADE_REQUIRED
          ? t("errors.planLimit")
          : t("errors.failed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (organizations.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (organizations.isError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{t("errors.load")}</p>
        <Button onClick={() => void organizations.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (availableOrganizations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("errors.noOrganization")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="workspace-organization">
            {t("organization.label")}
          </FieldLabel>
          <Select
            value={selectedOrganizationId}
            onValueChange={(event) => setOrganizationId(event)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("organization.description")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {availableOrganizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="workspace-name">{t("name.label")}</FieldLabel>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("name.placeholder")}
            disabled={isSubmitting}
            autoFocus
          />
          {error ? (
            <FieldDescription className="mt-1 text-destructive">
              {error}
            </FieldDescription>
          ) : null}
        </Field>
        <Field className="mt-5">
          <Button
            type="submit"
            size="lg"
            disabled={!name.trim() || !selectedOrganizationId || isSubmitting}
          >
            {isSubmitting ? <DashRing /> : t("submit")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
