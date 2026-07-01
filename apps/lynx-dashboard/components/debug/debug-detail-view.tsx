"use client";

import { useEffect } from "react";
import { DashboardPanel } from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import type { DebugReproduceResponseDto } from "@repo/dto";
import {
  getDemoDebugDetail,
  type DebugDetailKind,
} from "@/services/debug-detail-fixtures";
import { demoDebugReproduce } from "@/services/debug-demo-fixtures";
import { useDebugReproduceMutation } from "@/hooks/queries/debug";
import { runtimeConfig } from "@/config/runtime";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";
import { cn } from "@/lib/utils";

export function DebugDetailView({
  kind,
  id,
}: {
  kind: DebugDetailKind;
  id: string;
}) {
  if (kind === "reproduce") {
    return <ReproduceDetailView sessionId={id} />;
  }

  const detail = getDemoDebugDetail(kind, id);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-normal">{detail.title}</h1>
          {detail.severity ? (
            <SeverityBadge severity={detail.severity} />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{detail.subtitle}</p>
      </div>

      <DashboardPanel>
        <p className="text-sm leading-6 text-muted-foreground">
          {detail.summary}
        </p>
      </DashboardPanel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {detail.metrics.map((metric) => (
          <DashboardPanel key={metric.label}>
            <p className="text-sm font-medium text-muted-foreground">
              {metric.label}
            </p>
            <p
              className={cn(
                "mt-3 text-2xl font-semibold tabular-nums tracking-normal",
                metric.tone === "good"
                  ? "text-emerald-700"
                  : metric.tone === "warning"
                    ? "text-amber-700"
                    : metric.tone === "bad"
                      ? "text-rose-700"
                      : "",
              )}
            >
              {metric.value}
            </p>
          </DashboardPanel>
        ))}
      </div>

      {detail.sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-3 text-lg font-semibold tracking-normal">
            {section.title}
          </h2>
          <DashboardPanel>
            <dl className="divide-y divide-border/40">
              {section.rows.map((row) => (
                <div
                  key={`${row.label}-${row.value}`}
                  className="grid gap-2 py-3 md:grid-cols-[180px_1fr]"
                >
                  <dt className="text-sm font-medium text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 break-words text-sm font-medium">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </DashboardPanel>
        </section>
      ))}
    </div>
  );
}

function ReproduceDetailView({ sessionId }: { sessionId: string }) {
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const reproduceMutation = useDebugReproduceMutation(sessionId);
  const shouldUseDemo = runtimeConfig.demoMode && sessionId.startsWith("demo-");

  useEffect(() => {
    if (shouldUseDemo || !workspaceId) return;
    reproduceMutation.mutate({ workspaceId, mode: "DRY_RUN" });
    // 세션 상세 진입 시 원본 실행을 dry-run 재현 패키지로 분석합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, workspaceId]);

  const data = shouldUseDemo ? demoDebugReproduce : reproduceMutation.data;

  if (!workspaceId && !shouldUseDemo) {
    return (
      <DashboardPanel>
        <p className="py-10 text-center text-sm text-muted-foreground">
          workspace를 선택하면 재현 패키지를 만들 수 있습니다.
        </p>
      </DashboardPanel>
    );
  }

  if (!data) {
    return (
      <DashboardPanel>
        <p className="py-10 text-center text-sm text-muted-foreground">
          {reproduceMutation.isPending
            ? "재현 패키지를 만드는 중입니다."
            : "재현할 세션 데이터를 불러오지 못했습니다."}
        </p>
      </DashboardPanel>
    );
  }

  const matchedSteps = data.steps.filter(
    (step) => step.status === "MATCHED",
  ).length;
  const failedSteps = data.steps.filter(
    (step) => step.status === "FAILED" || step.status === "CHANGED",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-normal">재현 패키지</h1>
          <SeverityBadge
            severity={data.status === "FAILED" ? "CRITICAL" : "INFO"}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {data.sourceSessionId}
        </p>
      </div>

      <DashboardPanel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm leading-6 text-muted-foreground">
            {data.summary ??
              "원본 실행의 입력, 모델 설정, 도구 인자, 컨텍스트 근거를 재현 가능한 형태로 정리했습니다."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={reproduceMutation.isPending}
              size="sm"
              type="button"
              onClick={() =>
                workspaceId &&
                reproduceMutation.mutate({ workspaceId, mode: "DRY_RUN" })
              }
            >
              Dry-run
            </Button>
            <Button
              disabled={reproduceMutation.isPending}
              size="sm"
              type="button"
              variant="outline"
              onClick={() =>
                workspaceId &&
                reproduceMutation.mutate({ workspaceId, mode: "REPLAY" })
              }
            >
              Replay
            </Button>
          </div>
        </div>
      </DashboardPanel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="상태" value={data.status} />
        <MetricCard
          label="결정성"
          value={`${Math.round((data.deterministicScore ?? 0) * 100)}%`}
        />
        <MetricCard label="단계 수" value={`${data.steps.length}`} />
      </div>

      {data.replayPackage ? (
        <ReplayPackageSummary data={data.replayPackage} />
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-normal">
          재현 단계
        </h2>
        <DashboardPanel className="space-y-2">
          {data.steps.map((step) => (
            <div
              key={step.sourceEventId}
              className="flex min-w-0 flex-col gap-2 rounded-md border border-border/40 bg-muted/10 p-3 md:flex-row md:items-start md:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">
                  {step.label}
                </p>
                <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {step.eventType}
                </p>
              </div>
              <div className="min-w-0 text-left md:max-w-[58%] md:text-right">
                <span
                  className={cn(
                    "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
                    step.status === "MATCHED"
                      ? "bg-emerald-50 text-emerald-700"
                      : step.status === "FAILED" || step.status === "CHANGED"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.status}
                </span>
                {step.reason ? (
                  <p className="mt-1 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                    {step.reason}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </DashboardPanel>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetricCard label="매칭 단계" value={`${matchedSteps}`} tone="good" />
        <MetricCard
          label="변경/실패 단계"
          value={`${failedSteps}`}
          tone={failedSteps > 0 ? "warning" : "neutral"}
        />
      </div>
    </div>
  );
}

function ReplayPackageSummary({
  data,
}: {
  data: NonNullable<DebugReproduceResponseDto["replayPackage"]>;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-normal">
        운영·감사 근거
      </h2>
      <DashboardPanel>
        <dl className="divide-y divide-border/40">
          <DetailRow label="원본 입력" value={data.userInput ?? "-"} />
          <DetailRow label="프롬프트 버전" value={data.promptVersion ?? "-"} />
          <DetailRow label="SDK 버전" value={data.sdkVersion ?? "-"} />
          <DetailRow label="환경" value={data.environment ?? "-"} />
          <DetailRow
            label="모델 호출"
            value={`${data.modelSettings.length}개`}
          />
          <DetailRow label="도구 호출" value={`${data.toolCalls.length}개`} />
          <DetailRow
            label="컨텍스트"
            value={`${data.contextSnapshots.length}개`}
          />
        </dl>
      </DashboardPanel>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 py-3 md:grid-cols-[180px_1fr]">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-sm font-medium [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

function MetricCard({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "good" | "warning" | "bad";
  value: string;
}) {
  return (
    <DashboardPanel>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-3 break-words text-2xl font-semibold tabular-nums tracking-normal [overflow-wrap:anywhere]",
          tone === "good"
            ? "text-emerald-700"
            : tone === "warning"
              ? "text-amber-700"
              : tone === "bad"
                ? "text-rose-700"
                : "",
        )}
      >
        {value}
      </p>
    </DashboardPanel>
  );
}

function SeverityBadge({
  severity,
}: {
  severity: "INFO" | "WARNING" | "CRITICAL";
}) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium",
        severity === "CRITICAL"
          ? "bg-rose-50 text-rose-700"
          : severity === "WARNING"
            ? "bg-amber-50 text-amber-700"
            : "bg-emerald-50 text-emerald-700",
      )}
    >
      {severity}
    </span>
  );
}
