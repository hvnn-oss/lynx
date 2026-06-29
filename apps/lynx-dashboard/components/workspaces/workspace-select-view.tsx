"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationSummaryDto, WorkspaceSummaryDto } from "@repo/dto";
import { Button } from "@repo/ui/components/ui/button";
import { DashRing } from "@repo/ui/components/ui/dash-ring";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Separator } from "@repo/ui/components/ui/separator";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { LynxLogo } from "@repo/ui/components/brands/lynx-logo";
import {
  ArrowRight,
  Building2,
  Check,
  Layers3,
  Plus,
  RefreshCw,
} from "lucide-react";
import AuthGuard from "@/components/util/auth-guard";
import {
  useCreateOrganizationMutation,
  useCreateWorkspaceMutation,
  useOrganizationsQuery,
  useWorkspacesQuery,
} from "@/hooks/queries/workspace";
import { cn } from "@/lib/utils";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";

export function WorkspaceSelectView() {
  const router = useRouter();
  const selectedWorkspaceId = useDashboardUiStore(
    (state) => state.selectedWorkspaceId,
  );
  const setSelectedWorkspaceId = useDashboardUiStore(
    (state) => state.setSelectedWorkspaceId,
  );
  const organizationsQuery = useOrganizationsQuery();
  const workspacesQuery = useWorkspacesQuery();
  const createOrganizationMutation = useCreateOrganizationMutation();
  const createWorkspaceMutation = useCreateWorkspaceMutation();
  const [workspaceName, setWorkspaceName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | undefined
  >(undefined);
  const [error, setError] = useState("");

  const organizations = useMemo(
    () => organizationsQuery.data ?? [],
    [organizationsQuery.data],
  );
  const workspaces = useMemo(
    () => workspacesQuery.data ?? [],
    [workspacesQuery.data],
  );
  const defaultOrganizationId = selectedOrganizationId ?? organizations[0]?.id;
  const isLoading = organizationsQuery.isLoading || workspacesQuery.isLoading;
  const isCreating =
    createOrganizationMutation.isPending || createWorkspaceMutation.isPending;

  const groupedWorkspaces = useMemo(
    () => groupWorkspacesByOrganization(workspaces),
    [workspaces],
  );

  const handleSelectWorkspace = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    router.replace("/dashboard");
  };

  const handleCreateWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedWorkspaceName = workspaceName.trim();
    const trimmedOrganizationName = organizationName.trim();

    if (!trimmedWorkspaceName || isCreating) return;
    setError("");

    try {
      let organizationId = defaultOrganizationId;

      if (!organizationId) {
        if (!trimmedOrganizationName) {
          setError("워크스페이스를 만들 조직 이름을 입력해 주세요.");
          return;
        }

        const organization = await createOrganizationMutation.mutateAsync({
          name: trimmedOrganizationName,
        });
        organizationId = organization.id;
      }

      const workspace = await createWorkspaceMutation.mutateAsync({
        organizationId,
        name: trimmedWorkspaceName,
      });

      setSelectedWorkspaceId(workspace.id);
      router.replace("/dashboard");
    } catch {
      setError("워크스페이스를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <AuthGuard>
      <main className="min-h-screen w-full px-6 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
          <div className="grid w-full grid-cols-1 overflow-hidden rounded-lg border bg-background lg:grid-cols-[1.1fr_0.9fr]">
            <section className="flex min-h-[620px] flex-col p-8">
              <div className="mb-8 flex items-center gap-3 text-foreground/70">
                <LynxLogo className="size-8 text-primary" />
                <span className="text-xl font-semibold">Lynx</span>
              </div>

              <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                  워크스페이스를 선택하세요
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  대시보드와 디버깅 데이터는 선택한 워크스페이스 기준으로
                  표시됩니다.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {workspaces.length > 0
                    ? `${workspaces.length}개의 워크스페이스`
                    : "아직 선택할 워크스페이스가 없습니다."}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void organizationsQuery.refetch();
                    void workspacesQuery.refetch();
                  }}
                  disabled={
                    organizationsQuery.isFetching || workspacesQuery.isFetching
                  }
                >
                  {organizationsQuery.isFetching ||
                  workspacesQuery.isFetching ? (
                    <DashRing className="size-4" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  새로고침
                </Button>
              </div>

              <Separator className="my-5" />

              <div className="flex flex-1 flex-col gap-3">
                {isLoading ? (
                  <WorkspaceListSkeleton />
                ) : workspaces.length > 0 ? (
                  groupedWorkspaces.map(([organizationName, items]) => (
                    <div key={organizationName} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Building2 className="size-3.5" />
                        {organizationName}
                      </div>
                      <div className="grid gap-2">
                        {items.map((workspace) => (
                          <WorkspaceItem
                            key={workspace.id}
                            workspace={workspace}
                            selected={workspace.id === selectedWorkspaceId}
                            onSelect={handleSelectWorkspace}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyWorkspaceState />
                )}
              </div>
            </section>

            <section className="border-t bg-muted/20 p-8 lg:border-l lg:border-t-0">
              <div className="mb-8 flex items-start gap-3">
                <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    새 워크스페이스 만들기
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    기존 워크스페이스가 있어도 언제든 추가로 만들 수 있습니다.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateWorkspace}>
                <FieldGroup>
                  {organizations.length === 0 ? (
                    <Field>
                      <FieldLabel htmlFor="organization-name">
                        조직 이름
                      </FieldLabel>
                      <Input
                        id="organization-name"
                        value={organizationName}
                        onChange={(event) =>
                          setOrganizationName(event.target.value)
                        }
                        placeholder="예: Acme AI"
                      />
                      <FieldDescription>
                        워크스페이스를 담을 조직을 먼저 만듭니다.
                      </FieldDescription>
                    </Field>
                  ) : (
                    <Field>
                      <FieldLabel>조직</FieldLabel>
                      <OrganizationPicker
                        organizations={organizations}
                        selectedOrganizationId={defaultOrganizationId}
                        onSelect={setSelectedOrganizationId}
                      />
                    </Field>
                  )}

                  <Field>
                    <FieldLabel htmlFor="workspace-name">
                      워크스페이스 이름
                    </FieldLabel>
                    <Input
                      id="workspace-name"
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      placeholder="예: Production Agents"
                    />
                    <FieldDescription>
                      나중에 설정에서 이름을 바꿀 수 있습니다.
                    </FieldDescription>
                  </Field>

                  {error ? (
                    <FieldDescription className="text-destructive">
                      {error}
                    </FieldDescription>
                  ) : null}

                  <Field className="pt-2">
                    <Button
                      type="submit"
                      size="lg"
                      disabled={
                        isCreating ||
                        !workspaceName.trim() ||
                        (!defaultOrganizationId && !organizationName.trim())
                      }
                    >
                      {isCreating ? <DashRing /> : <Plus className="size-4" />}
                      만들고 이동
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </section>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}

function WorkspaceItem({
  workspace,
  selected,
  onSelect,
}: {
  workspace: WorkspaceSummaryDto;
  selected: boolean;
  onSelect: (workspaceId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(workspace.id)}
      className={cn(
        "flex min-h-20 w-full items-center justify-between rounded-md border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-muted/30",
        selected && "border-primary/60 bg-primary/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Layers3 className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{workspace.name}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{workspace.plan}</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            <span className="truncate">{workspace.id}</span>
          </div>
        </div>
      </div>
      {selected ? (
        <Check className="size-4 shrink-0 text-primary" />
      ) : (
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

function OrganizationPicker({
  organizations,
  selectedOrganizationId,
  onSelect,
}: {
  organizations: OrganizationSummaryDto[];
  selectedOrganizationId: string | undefined;
  onSelect: (organizationId: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {organizations.map((organization) => {
        const selected = organization.id === selectedOrganizationId;
        return (
          <button
            key={organization.id}
            type="button"
            onClick={() => onSelect(organization.id)}
            className={cn(
              "flex h-14 items-center justify-between rounded-md border bg-background px-3 text-left transition hover:border-primary/40",
              selected && "border-primary/60 bg-primary/5",
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {organization.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {organization.role} · {organization.workspaceCount} workspace
              </div>
            </div>
            {selected ? <Check className="size-4 text-primary" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function WorkspaceListSkeleton() {
  return (
    <div className="grid gap-2">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function EmptyWorkspaceState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        <Layers3 className="size-6" />
      </div>
      <h2 className="text-base font-semibold">워크스페이스가 없습니다</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        오른쪽에서 첫 워크스페이스를 만들면 바로 대시보드로 이동합니다.
      </p>
    </div>
  );
}

function groupWorkspacesByOrganization(workspaces: WorkspaceSummaryDto[]) {
  const groups = new Map<string, WorkspaceSummaryDto[]>();

  for (const workspace of workspaces) {
    const organizationName = workspace.organization.name;
    const items = groups.get(organizationName) ?? [];
    items.push(workspace);
    groups.set(organizationName, items);
  }

  return Array.from(groups.entries());
}
