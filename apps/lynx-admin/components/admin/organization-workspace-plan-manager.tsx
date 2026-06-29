"use client";

import type {
  AdminOrganizationSearchItem,
  AdminOrganizationSearchResponse,
  AdminPlan,
  AdminWorkspace,
} from "@/lib/admin-types";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateWorkspace } from "@/app/admin/actions";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 10;

interface OrganizationWorkspacePlanManagerProps {
  plans: AdminPlan[];
}

export function OrganizationWorkspacePlanManager({
  plans,
}: OrganizationWorkspacePlanManagerProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [organizations, setOrganizations] = useState<
    AdminOrganizationSearchItem[]
  >([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.isActive),
    [plans],
  );
  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrganizationId,
  );
  const selectedWorkspace = selectedOrganization?.workspaces.find(
    (workspace) => workspace.id === selectedWorkspaceId,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    async function searchOrganizations() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const params = new URLSearchParams({
          query: debouncedQuery,
          limit: String(SEARCH_LIMIT),
        });
        const response = await fetch(
          `/api/admin/organizations/search?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("조직 검색에 실패했습니다.");
        }

        const data =
          (await response.json()) as AdminOrganizationSearchResponse;
        setOrganizations(data.organizations);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setOrganizations([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "조직 검색 중 문제가 발생했습니다.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void searchOrganizations();

    return () => controller.abort();
  }, [debouncedQuery, refreshVersion]);

  useEffect(() => {
    if (organizations.length === 0) {
      setSelectedOrganizationId("");
      setSelectedWorkspaceId("");
      return;
    }

    const nextOrganization =
      organizations.find(
        (organization) => organization.id === selectedOrganizationId,
      ) ?? organizations[0];

    if (!nextOrganization) {
      return;
    }

    setSelectedOrganizationId(nextOrganization.id);
    setSelectedWorkspaceId((currentWorkspaceId) => {
      const hasCurrentWorkspace = nextOrganization.workspaces.some(
        (workspace) => workspace.id === currentWorkspaceId,
      );

      return hasCurrentWorkspace
        ? currentWorkspaceId
        : (nextOrganization.workspaces[0]?.id ?? "");
    });
  }, [organizations, selectedOrganizationId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
      <section className="rounded-lg border p-3">
        <div className="mb-3 space-y-1">
          <Label htmlFor="organization-search" className="text-xs">
            조직 검색
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              id="organization-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="조직 이름 또는 ID"
              className="pl-8"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            검색 결과는 상위 {SEARCH_LIMIT}개까지만 표시됩니다.
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-2">
          {isLoading ? (
            <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              조직을 검색하는 중입니다.
            </div>
          ) : null}

          {!isLoading && organizations.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              검색된 조직이 없습니다.
            </div>
          ) : null}

          {!isLoading
            ? organizations.map((organization) => {
                const isSelected = organization.id === selectedOrganizationId;

                return (
                  <button
                    key={organization.id}
                    type="button"
                    onClick={() => {
                      setSelectedOrganizationId(organization.id);
                      setSelectedWorkspaceId(
                        organization.workspaces[0]?.id ?? "",
                      );
                    }}
                    className={[
                      "w-full rounded-md border px-3 py-2 text-left transition",
                      isSelected
                        ? "border-foreground bg-muted/60"
                        : "bg-background hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {organization.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {organization.workspaceCount}개
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {organization.id}
                    </p>
                  </button>
                );
              })
            : null}
        </div>
      </section>

      <section className="rounded-lg border p-3">
        {!selectedOrganization ? (
          <div className="flex min-h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            조직을 선택하면 워크스페이스와 요금제를 조정할 수 있습니다.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.25fr)]">
            <div>
              <div className="mb-3">
                <h3 className="text-sm font-semibold">
                  {selectedOrganization.name}
                </h3>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {selectedOrganization.id}
                </p>
              </div>
              <div className="space-y-2">
                {selectedOrganization.workspaces.length === 0 ? (
                  <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    이 조직에는 워크스페이스가 없습니다.
                  </div>
                ) : null}

                {selectedOrganization.workspaces.map((workspace) => {
                  const isSelected = workspace.id === selectedWorkspaceId;

                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      onClick={() => setSelectedWorkspaceId(workspace.id)}
                      className={[
                        "w-full rounded-md border px-3 py-2 text-left transition",
                        isSelected
                          ? "border-foreground bg-muted/60"
                          : "bg-background hover:bg-muted/40",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {workspace.name}
                        </span>
                        <PlanPill plan={workspace.plan} />
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {workspace.id}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <WorkspacePlanForm
              activePlans={activePlans}
              plans={plans}
              workspace={selectedWorkspace}
              organizationId={selectedOrganization.id}
              onSaved={() => setRefreshVersion((version) => version + 1)}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function WorkspacePlanForm({
  activePlans,
  plans,
  workspace,
  organizationId,
  onSaved,
}: {
  activePlans: AdminPlan[];
  plans: AdminPlan[];
  workspace?: AdminWorkspace;
  organizationId: string;
  onSaved: () => void;
}) {
  if (!workspace) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        워크스페이스를 선택해 주세요.
      </div>
    );
  }

  const currentPlan = plans.find((plan) => plan.code === workspace.plan);
  const isCurrentPlanActive = currentPlan?.isActive ?? false;

  return (
    <form
      key={workspace.id}
      action={async (formData) => {
        await updateWorkspace(formData);
        onSaved();
      }}
      className="rounded-md border p-3"
    >
      <input type="hidden" name="id" value={workspace.id} />
      <input type="hidden" name="name" value={workspace.name} />
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="mb-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          선택한 워크스페이스
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-normal">
          {workspace.name}
        </h3>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {workspace.id}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor={`workspace-plan-${workspace.id}`} className="text-xs">
            적용 요금제
          </Label>
          <select
            id={`workspace-plan-${workspace.id}`}
            name="plan"
            defaultValue={workspace.plan}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={activePlans.length === 0}
          >
            {!isCurrentPlanActive ? (
              <option value={workspace.plan} disabled>
                {workspace.plan} (비활성)
              </option>
            ) : null}
            {activePlans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.code} · {plan.name}
              </option>
            ))}
          </select>
          {!isCurrentPlanActive ? (
            <p className="text-xs text-destructive">
              현재 플랜은 비활성 상태입니다. 저장하려면 활성 플랜을 선택해
              주세요.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              활성화된 플랜만 새로 적용할 수 있습니다.
            </p>
          )}
        </div>
        <div className="flex items-end">
          <SubmitButton disabled={activePlans.length === 0} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
        <Metric label="현재 플랜" value={workspace.plan} />
        <Metric
          label="포함 로그"
          value={
            currentPlan?.includedLogCount
              ? currentPlan.includedLogCount.toLocaleString()
              : "무제한"
          }
        />
        <Metric
          label="초과 단가"
          value={
            currentPlan?.logOverageUnitPrice === undefined
              ? "미설정"
              : String(currentPlan.logOverageUnitPrice)
          }
        />
      </div>
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" disabled={disabled || pending}>
      {pending ? "저장 중" : "저장"}
    </Button>
  );
}

function PlanPill({ plan }: { plan: string }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-xs font-medium text-muted-foreground">
      {plan}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <p>{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
