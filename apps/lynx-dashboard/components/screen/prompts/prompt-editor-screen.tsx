"use client";

import {
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
  DashboardPanel,
  DashboardSectionHeader,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCompareArrows, Save, Tag, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ActualDataPageLoading,
  ActualDataPageMessage,
} from "@/components/screen/dashboard/actual-data-page";
import { formatDateTime } from "@/components/ui/operations/format";
import { OperationsSplitDiff } from "@/components/ui/operations/split-diff";
import { useCurrentWorkspace } from "@/hooks/use-current-workspace";
import {
  comparePromptVersions,
  createPrompt,
  createPromptVersion,
  deletePrompt,
  getPrompt,
  listPromptVersions,
  updatePrompt,
} from "@/lib/prompts";
import {
  PromptDeploymentPanel,
  PromptExperimentPanel,
  PromptPerformancePanel,
} from "./prompt-operations-panel";

const NO_BASE_VERSION = "__none__";

interface PromptForm {
  name: string;
  description: string;
  draftContent: string;
}

const EMPTY_FORM: PromptForm = {
  name: "",
  description: "",
  draftContent: "",
};

/** 새 프롬프트 생성과 기존 초안·버전 관리를 하나의 작업 화면으로 제공합니다. */
export function PromptEditorScreen({ promptId }: { promptId?: string }) {
  const t = useTranslations("promptManagement");
  const workspace = useCurrentWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isCreating = !promptId;
  const promptQuery = useQuery({
    queryKey: ["prompts", workspace.workspaceId, promptId],
    queryFn: () => getPrompt(workspace.workspaceId, promptId!),
    enabled: workspace.hasWorkspace && Boolean(promptId),
  });
  const versionsQuery = useQuery({
    queryKey: ["prompts", workspace.workspaceId, promptId, "versions"],
    queryFn: () => listPromptVersions(workspace.workspaceId, promptId!),
    enabled: workspace.hasWorkspace && Boolean(promptId),
  });
  const [form, setForm] = useState<PromptForm>(EMPTY_FORM);
  const [loadedPromptId, setLoadedPromptId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isVersionFormOpen, setIsVersionFormOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [baseVersionId, setBaseVersionId] = useState(NO_BASE_VERSION);
  const [selectedFromVersionId, setSelectedFromVersionId] = useState("");
  const [selectedToVersionId, setSelectedToVersionId] = useState("");

  useEffect(() => {
    if (!promptQuery.data || loadedPromptId === promptQuery.data.id) return;
    // 서버 초안을 편집 가능한 로컬 작업본으로 한 번 복사합니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: promptQuery.data.name,
      description: promptQuery.data.description,
      draftContent: promptQuery.data.draftContent,
    });
    setLoadedPromptId(promptQuery.data.id);
  }, [loadedPromptId, promptQuery.data]);

  const versions = useMemo(
    () => versionsQuery.data?.items ?? [],
    [versionsQuery.data?.items],
  );
  const fromVersionId =
    selectedFromVersionId || versions[1]?.id || versions[0]?.id || "";
  const toVersionId =
    selectedToVersionId || versions[0]?.id || versions[1]?.id || "";
  const comparison = useQuery({
    queryKey: [
      "prompts",
      workspace.workspaceId,
      promptId,
      "compare",
      fromVersionId,
      toVersionId,
    ],
    queryFn: () =>
      comparePromptVersions(
        workspace.workspaceId,
        promptId!,
        fromVersionId,
        toVersionId,
      ),
    enabled:
      workspace.hasWorkspace &&
      Boolean(promptId) &&
      Boolean(fromVersionId) &&
      Boolean(toVersionId) &&
      fromVersionId !== toVersionId,
  });

  const original = promptQuery.data;
  const isDirty =
    isCreating ||
    Boolean(
      original &&
      (form.name !== original.name ||
        form.description !== original.description ||
        form.draftContent !== original.draftContent),
    );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workspace.workspaceId) throw new Error("WORKSPACE_REQUIRED");
      if (isCreating) {
        return createPrompt(workspace.workspaceId, form);
      }
      return updatePrompt(workspace.workspaceId, promptId!, {
        ...form,
        expectedDraftRevision: original!.draftRevision,
      });
    },
    onSuccess: async (result) => {
      setNotice(t(isCreating ? "editor.created" : "editor.saved"));
      setForm({
        name: result.prompt.name,
        description: result.prompt.description,
        draftContent: result.prompt.draftContent,
      });
      setLoadedPromptId(result.prompt.id);
      queryClient.setQueryData(
        ["prompts", workspace.workspaceId, result.prompt.id],
        result.prompt,
      );
      await queryClient.invalidateQueries({
        queryKey: ["prompts", workspace.workspaceId],
      });
      if (isCreating) {
        router.replace(`/prompts/${result.prompt.id}`);
      }
    },
    onError: (error) => {
      setNotice(
        isConflictError(error) ? t("editor.conflict") : t("editor.saveFailed"),
      );
    },
  });

  const versionMutation = useMutation({
    mutationFn: () =>
      createPromptVersion(workspace.workspaceId, promptId!, {
        expectedDraftRevision: original!.draftRevision,
        version: versionLabel,
        content: form.draftContent,
        baseVersionId: baseVersionId === NO_BASE_VERSION ? null : baseVersionId,
        changeReason: changeReason.trim() || null,
      }),
    onSuccess: async () => {
      setNotice(t("version.created"));
      setIsVersionFormOpen(false);
      setVersionLabel("");
      setChangeReason("");
      setBaseVersionId(NO_BASE_VERSION);
      await versionsQuery.refetch();
    },
    onError: (error) => {
      setNotice(
        isConflictError(error)
          ? t("version.draftChanged")
          : t("version.createFailed"),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePrompt(workspace.workspaceId, promptId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["prompts", workspace.workspaceId],
      });
      router.replace("/prompts/overview");
    },
    onError: () => setNotice(t("editor.deleteFailed")),
  });

  if (
    workspace.isPending ||
    (!isCreating &&
      workspace.hasWorkspace &&
      (promptQuery.isPending || versionsQuery.isPending))
  ) {
    return <ActualDataPageLoading />;
  }
  if (
    workspace.isError ||
    (!isCreating && (promptQuery.isError || versionsQuery.isError))
  ) {
    return (
      <ActualDataPageMessage
        pageTitle={t(isCreating ? "create.title" : "editor.title")}
        pageDescription={t(isCreating ? "create.subtitle" : "editor.subtitle")}
        title={t("common.loadFailed")}
        description={t("common.retryDescription")}
        action={t("common.retry")}
        onRetry={() => {
          void workspace.refetch();
          if (!isCreating) {
            void promptQuery.refetch();
            void versionsQuery.refetch();
          }
        }}
      />
    );
  }
  if (!isCreating && !original) {
    return (
      <ActualDataPageMessage
        pageTitle={t("editor.title")}
        pageDescription={t("editor.subtitle")}
        title={t("editor.notFound")}
        description={t("common.retryDescription")}
      />
    );
  }

  const isValid = form.name.trim().length > 0;
  const canCreateVersion =
    !isCreating &&
    !isDirty &&
    versionLabel.trim().length > 0 &&
    form.draftContent.length > 0;
  const fromVersion = versions.find((version) => version.id === fromVersionId);
  const toVersion = versions.find((version) => version.id === toVersionId);
  const changedLineCount =
    comparison.data?.changes.filter((change) => change.type !== "UNCHANGED")
      .length ?? 0;

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={
          isCreating ? t("create.title") : original?.name || t("editor.title")
        }
        description={t(isCreating ? "create.subtitle" : "editor.subtitle")}
        badge={
          !isCreating ? (
            <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
              {t("editor.draftRevision", {
                revision: original!.draftRevision,
              })}
            </span>
          ) : undefined
        }
        actions={
          <>
            {!isCreating ? (
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(t("editor.deleteConfirm"))) {
                    deleteMutation.mutate();
                  }
                }}
              >
                <Trash2 />
                {t("editor.delete")}
              </Button>
            ) : null}
            {isCreating ? (
              <Button
                disabled={!isValid || !isDirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                <Save />
                {saveMutation.isPending
                  ? t("editor.saving")
                  : t("create.submit")}
              </Button>
            ) : null}
          </>
        }
      />

      {notice ? (
        <div
          className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm"
          role="status"
        >
          <span>{notice}</span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={t("common.dismiss")}
            onClick={() => setNotice(null)}
          >
            <X />
          </Button>
        </div>
      ) : null}

      {!isCreating ? (
        <DashboardMetricGrid className="xl:grid-cols-3">
          <DashboardMetricCard
            label={t("editor.metrics.draft")}
            value={t("editor.draftRevision", {
              revision: original!.draftRevision,
            })}
            description={
              isDirty ? t("editor.metrics.unsaved") : t("editor.metrics.saved")
            }
            tone={isDirty ? "warning" : "good"}
          />
          <DashboardMetricCard
            label={t("editor.metrics.versions")}
            value={String(versions.length)}
            description={t("editor.metrics.versionsHint")}
          />
          <DashboardMetricCard
            label={t("editor.metrics.updated")}
            value={formatDateTime(original!.updatedAt)}
            description={t("editor.metrics.updatedHint")}
          />
        </DashboardMetricGrid>
      ) : null}

      <Tabs defaultValue="draft" className="w-full">
        {!isCreating ? (
          <TabsList aria-label={t("tabs.label")}>
            <TabsTrigger className="cursor-pointer" value="draft">
              {t("tabs.draft")}
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="versions">
              {t("tabs.versions")}
            </TabsTrigger>
            <TabsTrigger
              className="cursor-pointer"
              value="deployment"
              disabled={versions.length === 0}
            >
              {t("tabs.deployment")}
            </TabsTrigger>
            <TabsTrigger
              className="cursor-pointer"
              value="performance"
              disabled={versions.length === 0}
            >
              {t("tabs.performance")}
            </TabsTrigger>
            <TabsTrigger
              className="cursor-pointer"
              value="experiments"
              disabled={versions.length < 2}
            >
              {t("tabs.experiments")}
            </TabsTrigger>
          </TabsList>
        ) : null}

        <TabsContent value="draft" className="space-y-8">
          <section className="space-y-3">
            <DashboardSectionHeader
              title={t("editor.basicTitle")}
              description={t("editor.basicDescription")}
            />
            <DashboardPanel>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="prompt-name">
                    {t("editor.name")}
                  </FieldLabel>
                  <Input
                    id="prompt-name"
                    maxLength={120}
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                  {!form.name.trim() ? (
                    <FieldError>{t("editor.nameRequired")}</FieldError>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="prompt-description">
                    {t("editor.description")}
                  </FieldLabel>
                  <Textarea
                    id="prompt-description"
                    className="min-h-20"
                    maxLength={2_000}
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </Field>
              </FieldGroup>
            </DashboardPanel>
          </section>

          <section className="space-y-3">
            <DashboardSectionHeader
              title={t("editor.draftTitle")}
              description={t("editor.draftDescription")}
            />
            <DashboardPanel>
              <Field>
                <FieldLabel htmlFor="prompt-content" className="sr-only">
                  {t("editor.draftTitle")}
                </FieldLabel>
                <Textarea
                  id="prompt-content"
                  className="min-h-[28rem] resize-y font-mono text-sm leading-6"
                  maxLength={256_000}
                  value={form.draftContent}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      draftContent: event.target.value,
                    }))
                  }
                  placeholder={t("editor.contentPlaceholder")}
                />
                <FieldDescription>
                  {t("editor.characterCount", {
                    count: form.draftContent.length,
                  })}
                </FieldDescription>
              </Field>
            </DashboardPanel>
          </section>

          {!isCreating ? (
            <div className="flex justify-end border-t pt-6">
              <Button
                disabled={!isValid || !isDirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                <Save />
                {saveMutation.isPending ? t("editor.saving") : t("editor.save")}
              </Button>
            </div>
          ) : null}
        </TabsContent>

        {!isCreating ? (
          <TabsContent value="versions" className="space-y-8">
            {isVersionFormOpen ? (
              <section className="space-y-3">
                <DashboardSectionHeader
                  title={t("version.createTitle")}
                  description={t("version.createDescription")}
                />
                <DashboardPanel>
                  <FieldGroup>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="prompt-version">
                          {t("version.label")}
                        </FieldLabel>
                        <Input
                          id="prompt-version"
                          maxLength={40}
                          value={versionLabel}
                          onChange={(event) =>
                            setVersionLabel(event.target.value)
                          }
                          placeholder={t("version.labelPlaceholder")}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>{t("version.base")}</FieldLabel>
                        <Select
                          value={baseVersionId}
                          onValueChange={setBaseVersionId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_BASE_VERSION}>
                              {t("version.noBase")}
                            </SelectItem>
                            {versions.map((version) => (
                              <SelectItem key={version.id} value={version.id}>
                                {version.version}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="prompt-change-reason">
                        {t("version.changeReason")}
                      </FieldLabel>
                      <Textarea
                        id="prompt-change-reason"
                        className="min-h-20"
                        maxLength={4_000}
                        value={changeReason}
                        onChange={(event) =>
                          setChangeReason(event.target.value)
                        }
                      />
                    </Field>
                    {isDirty ? (
                      <FieldError>{t("version.saveDraftFirst")}</FieldError>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsVersionFormOpen(false)}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        disabled={
                          !canCreateVersion || versionMutation.isPending
                        }
                        onClick={() => versionMutation.mutate()}
                      >
                        <Tag />
                        {versionMutation.isPending
                          ? t("version.creating")
                          : t("version.create")}
                      </Button>
                    </div>
                  </FieldGroup>
                </DashboardPanel>
              </section>
            ) : null}

            <section className="space-y-3">
              <DashboardSectionHeader
                title={t("version.historyTitle")}
                description={t("version.historyDescription")}
                action={
                  <Button
                    variant="outline"
                    disabled={isDirty || isVersionFormOpen}
                    onClick={() => setIsVersionFormOpen(true)}
                  >
                    <Tag />
                    {t("version.openCreate")}
                  </Button>
                }
              />
              <DashboardPanel>
                {versions.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {t("version.empty")}
                  </p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {versions.slice(0, 20).map((version) => (
                      <div
                        className="flex items-center justify-between gap-4 py-3"
                        key={version.id}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {version.version}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {version.changeReason?.trim() ||
                              t("version.noChangeReason")}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(version.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardPanel>
            </section>

            {versions.length >= 2 ? (
              <section className="space-y-3">
                <DashboardSectionHeader
                  title={t("compare.title")}
                  description={t("compare.description")}
                />
                <DashboardPanel>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
                    <Field>
                      <FieldLabel>{t("compare.before")}</FieldLabel>
                      <VersionSelect
                        versions={versions}
                        value={fromVersionId}
                        onValueChange={setSelectedFromVersionId}
                      />
                    </Field>
                    <GitCompareArrows className="mb-2 hidden size-4 text-muted-foreground md:block" />
                    <Field>
                      <FieldLabel>{t("compare.after")}</FieldLabel>
                      <VersionSelect
                        versions={versions}
                        value={toVersionId}
                        onValueChange={setSelectedToVersionId}
                      />
                    </Field>
                  </div>
                  {fromVersionId === toVersionId ? (
                    <FieldError className="mt-3">
                      {t("compare.selectDifferent")}
                    </FieldError>
                  ) : comparison.isPending ? (
                    <p className="mt-6 text-sm text-muted-foreground">
                      {t("compare.loading")}
                    </p>
                  ) : comparison.isError ? (
                    <FieldError className="mt-3">
                      {t("compare.failed")}
                    </FieldError>
                  ) : fromVersion && toVersion && comparison.data ? (
                    <div className="mt-6 space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {t("compare.changedLines", {
                          count: changedLineCount,
                        })}
                      </p>
                      <OperationsSplitDiff
                        before={fromVersion.content}
                        after={toVersion.content}
                        beforeLabel={fromVersion.version}
                        afterLabel={toVersion.version}
                      />
                    </div>
                  ) : null}
                </DashboardPanel>
              </section>
            ) : null}
          </TabsContent>
        ) : null}

        {!isCreating && versions.length > 0 ? (
          <>
            <TabsContent value="deployment">
              <PromptDeploymentPanel
                key={`deployment:${promptId}:${versions
                  .map((version) => version.id)
                  .join(",")}`}
                workspaceId={workspace.workspaceId}
                promptId={promptId!}
                versions={versions}
              />
            </TabsContent>

            <TabsContent value="performance">
              <PromptPerformancePanel
                workspaceId={workspace.workspaceId}
                promptId={promptId!}
              />
            </TabsContent>
          </>
        ) : null}

        {!isCreating && versions.length >= 2 ? (
          <TabsContent value="experiments">
            <PromptExperimentPanel
              key={`experiments:${promptId}:${versions
                .map((version) => version.id)
                .join(",")}`}
              workspaceId={workspace.workspaceId}
              promptId={promptId!}
              versions={versions}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function VersionSelect({
  versions,
  value,
  onValueChange,
}: {
  versions: Awaited<ReturnType<typeof listPromptVersions>>["items"];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {versions.map((version) => (
          <SelectItem key={version.id} value={version.id}>
            {version.version}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function isConflictError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const response = "response" in error ? error.response : undefined;
  if (typeof response !== "object" || response === null) return false;
  const status = "status" in response ? response.status : undefined;
  const data = "data" in response ? response.data : undefined;
  const serializedData =
    typeof data === "string" ? data : JSON.stringify(data ?? {});
  return (
    status === 409 ||
    serializedData.includes("PROMPT_DRAFT_CONFLICT") ||
    serializedData.includes("PROMPT_CONTENT_IS_NOT_CURRENT_DRAFT")
  );
}
