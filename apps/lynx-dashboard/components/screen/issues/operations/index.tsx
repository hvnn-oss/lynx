"use client";

import { useState } from "react";
import {
  DashboardChartPanel,
  DashboardListPanel,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  ArrowUpRight,
  Bot,
  CircleDot,
  MessageSquare,
  ShieldAlert,
  Tag,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  getIssue,
  listBlockedIssues,
  listFingerprintGroups,
  listIssues,
  listIssueTrendBuckets,
  listReviewIssues,
} from "@/lib/operations/service";
import {
  getSeverityClass,
  getStateClass,
  OperationsBadge,
} from "@/components/ui/operations/status-badge";
import type { Issue, IssueCollaborationEvent, IssueLabel } from "@/lib/operations/types";
import { OperationsFilterBar } from "@/components/ui/operations/filter-bar";
import {
  OperationsDetailSection,
  OperationsInfoList,
} from "@/components/ui/operations/detail-section";
import { formatDateTime } from "@/components/ui/operations/format";
import { OperationsKpiCard } from "@/components/ui/operations/kpi-card";

const RELATED_PAGE_SIZE = 5;

export function IssuesOverviewScreen() {
  const t = useTranslations("issues");
  const common = useTranslations("common");
  const severity = useTranslations("severity");
  const status = useTranslations("status");
  const issues = listIssues();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("overview.title")} description={t("overview.subtitle")} />
      <IssueMetrics issues={issues} />
      <PriorityIssuePanel />
      <OperationsFilterBar
        searchPlaceholder={t("filters.search")}
        filters={[
          { label: t("filters.status"), options: [common("all"), status("open"), status("investigating"), status("resolved"), status("ignored")] },
          { label: t("filters.severity"), options: [common("all"), severity("critical"), severity("warning"), severity("info")] },
          { label: t("filters.blocked"), options: [common("all"), common("blocked"), common("notBlocked")] },
        ]}
      />
      <IssueList issues={issues} />
    </div>
  );
}

export function IssuesReviewScreen() {
  const t = useTranslations("issues.review");
  const issues = listReviewIssues();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <IssueMetrics issues={issues} />
      <IssueList issues={issues} />
    </div>
  );
}

export function IssueFingerprintsScreen() {
  const t = useTranslations("issues.fingerprints");
  const severity = useTranslations("severity");
  const groups = listFingerprintGroups();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <DashboardListPanel empty={groups.length === 0} emptyText={t("empty")}>
        {groups.map((group) => (
          <div className="rounded-md px-3 py-3 hover:bg-muted/30" key={group.fingerprint}>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{group.title}</p>
                  <OperationsBadge className={getSeverityClass(group.severity)}>{severity(group.severity)}</OperationsBadge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{group.fingerprint}</p>
                <p className="mt-2 text-xs text-muted-foreground">{group.agents.join(", ")}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-right text-xs text-muted-foreground">
                <Metric label={t("occurrences")} value={String(group.occurrences)} />
                <Metric label={t("issues")} value={String(group.issueCount)} />
                <Metric label={t("lastSeen")} value={formatDateTime(group.lastSeenAt)} />
              </div>
            </div>
          </div>
        ))}
      </DashboardListPanel>
    </div>
  );
}

export function IssueTrendsScreen() {
  const t = useTranslations("issues.trends");
  const buckets = listIssueTrendBuckets();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <DashboardChartPanel>
        <h2 className="text-sm font-bold">{t("chartTitle")}</h2>
        <div className="mt-6 flex h-64 items-end gap-3">
          {buckets.map((bucket) => (
            <div className="flex flex-1 flex-col items-center gap-2" key={bucket.label}>
              <div className="flex w-full items-end gap-1">
                <Bar height={bucket.critical * 20} className="bg-rose-500" />
                <Bar height={bucket.warning * 14} className="bg-amber-500" />
                <Bar height={bucket.info * 18} className="bg-slate-400" />
                <Bar height={bucket.blocked * 18} className="bg-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground">{bucket.label}</span>
            </div>
          ))}
        </div>
      </DashboardChartPanel>
    </div>
  );
}

export function BlockedIssuesScreen() {
  const t = useTranslations("issues.blocked");
  const issues = listBlockedIssues();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <IssueMetrics issues={issues} />
      <IssueList issues={issues} />
    </div>
  );
}

export function IssueDetailOperationsScreen({ issueId }: { issueId: string }) {
  const t = useTranslations("issues.detail");
  const severity = useTranslations("severity");
  const status = useTranslations("status");
  const issue = getIssue(issueId);

  return (
    <div className="space-y-5">
      <DashboardPageHeader
        title={issue.title}
        description={issue.summary}
        badge={<OperationsBadge className={getSeverityClass(issue.severity)}>{severity(issue.severity)}</OperationsBadge>}
        actions={
          <>
            <Button variant="outline">{t("actions.resolve")}</Button>
            <Button variant="outline">{t("actions.ignore")}</Button>
          </>
        }
      />
      <section className="grid gap-3 md:grid-cols-4">
        <OperationsKpiCard label={t("metrics.status")} value={status(issue.status)} description={t("metrics.statusHint")} tone="warning" />
        <OperationsKpiCard label={t("metrics.occurrences")} value={String(issue.occurrences)} description={t("metrics.occurrencesHint")} tone="bad" />
        <OperationsKpiCard label={t("metrics.sessions")} value={String(issue.relatedSessions)} description={t("metrics.sessionsHint")} />
        <OperationsKpiCard label={t("metrics.lastSeen")} value={formatDateTime(issue.lastSeenAt)} description={t("metrics.lastSeenHint")} />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <IssueReport issue={issue} />
        <IssueMetaPanel issue={issue} />
      </section>
      <IssueRelatedSection issue={issue} />
      <OperationsDetailSection title={t("nextAction")}>
        <p className="text-sm leading-6 text-muted-foreground">{t("nextActionText")}</p>
      </OperationsDetailSection>
      <IssueCollaborationTimeline issue={issue} />
      <IssueCommentBox />
    </div>
  );
}

function IssueRelatedSection({ issue }: { issue: Issue }) {
  const t = useTranslations("issues.detail");
  const severity = useTranslations("severity");
  const status = useTranslations("status");
  const issues = listIssues();
  const [issuePage, setIssuePage] = useState(0);
  const [sessionPage, setSessionPage] = useState(0);
  const relatedIssues = getRelatedIssues(issue, issues);
  const relatedSessions = getRelatedSessions(issue);
  const pagedIssues = paginate(relatedIssues, issuePage);
  const pagedSessions = paginate(relatedSessions, sessionPage);
  const relatedAgents = Array.from(
    new Map(
      issues
        .filter(
          (item) =>
            item.agentName === issue.agentName ||
            item.policyName === issue.policyName ||
            item.promptVersion === issue.promptVersion,
        )
        .map((item) => [item.agentName, item]),
    ).values(),
  ).slice(0, 4);

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <DashboardPanel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">{t("relatedIssues")}</h2>
          <OperationsBadge className="border-slate-200 bg-slate-50 text-slate-700">
            {relatedIssues.length}
          </OperationsBadge>
        </div>
        <div className="mt-4 space-y-2">
          {pagedIssues.length > 0 ? (
            pagedIssues.map((item) => (
              <Link
                className="block rounded-md border border-border/70 p-3 hover:bg-muted/30"
                href={`/issues/tracker/${item.id}`}
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold">{item.title}</p>
                  <OperationsBadge className={getSeverityClass(item.severity)}>{severity(item.severity)}</OperationsBadge>
                  <OperationsBadge className={getStateClass(item.status)}>{status(item.status)}</OperationsBadge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.fingerprint} / {item.representativeSessionId}
                </p>
              </Link>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
              {t("noRelatedIssues")}
            </p>
          )}
        </div>
        <PaginationControls
          label={t("relatedIssues")}
          page={issuePage}
          total={relatedIssues.length}
          onChange={setIssuePage}
        />
      </DashboardPanel>
      <DashboardPanel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">{t("relatedSessions")}</h2>
          <OperationsBadge className="border-slate-200 bg-slate-50 text-slate-700">
            {relatedSessions.length}
          </OperationsBadge>
        </div>
        <div className="mt-4 space-y-2">
          {pagedSessions.length > 0 ? (
            pagedSessions.map((session) => (
              <Link
                className="block rounded-md border border-border/70 p-3 hover:bg-muted/30"
                href={`/dashboard/session/detail/${session.id}`}
                key={session.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold">{session.id}</p>
                  <OperationsBadge className={getStateClass(session.status)}>
                    {session.status === "blocked" ? t("blockedYes") : status(session.status)}
                  </OperationsBadge>
                  {session.isRepresentative ? (
                    <OperationsBadge className="border-blue-200 bg-blue-50 text-blue-700">
                      {t("representativeSession")}
                    </OperationsBadge>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {session.agentName} / {session.promptVersion} / {session.lastEventAt}
                </p>
              </Link>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
              {t("noRelatedSessions")}
            </p>
          )}
        </div>
        <PaginationControls
          label={t("relatedSessions")}
          page={sessionPage}
          total={relatedSessions.length}
          onChange={setSessionPage}
        />
      </DashboardPanel>
      <DashboardPanel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">{t("relatedAgents")}</h2>
          <OperationsBadge className="border-slate-200 bg-slate-50 text-slate-700">
            {relatedAgents.length}
          </OperationsBadge>
        </div>
        <div className="mt-4 space-y-2">
          {relatedAgents.map((item) => (
            <div className="rounded-md border border-border/70 p-3" key={item.agentName}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold">{item.agentName}</p>
                <OperationsBadge className={item.isBlocked ? getStateClass("blocked") : getStateClass(item.status)}>
                  {item.isBlocked ? t("blockedYes") : status(item.status)}
                </OperationsBadge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                <Metric label={t("policy")} value={item.policyName} />
                <Metric label={t("promptVersion")} value={item.promptVersion} />
                <Metric label={t("session")} value={item.representativeSessionId} />
              </div>
            </div>
          ))}
        </div>
      </DashboardPanel>
    </section>
  );
}

function getRelatedIssues(issue: Issue, issues: Issue[]) {
  return issues
    .filter((item) => item.id !== issue.id)
    .filter(
      (item) =>
        item.fingerprint === issue.fingerprint ||
        item.agentName === issue.agentName ||
        item.policyName === issue.policyName ||
        item.promptVersion === issue.promptVersion ||
        (item.severity === issue.severity && item.isBlocked === issue.isBlocked),
    );
}

function getRelatedSessions(issue: Issue) {
  const sessions = [
    {
      id: issue.representativeSessionId,
      agentName: issue.agentName,
      promptVersion: issue.promptVersion,
      status: issue.isBlocked ? "blocked" : issue.status,
      lastEventAt: formatDateTime(issue.lastSeenAt),
      isRepresentative: true,
    },
  ];

  for (let index = 1; index < issue.relatedSessions; index += 1) {
    sessions.push({
      id: `${issue.representativeSessionId}-${index + 1}`,
      agentName: issue.agentName,
      promptVersion: issue.promptVersion,
      status: issue.status,
      lastEventAt: formatDateTime(issue.lastSeenAt),
      isRepresentative: false,
    });
  }

  return sessions;
}

function paginate<T>(items: T[], page: number) {
  return items.slice(page * RELATED_PAGE_SIZE, page * RELATED_PAGE_SIZE + RELATED_PAGE_SIZE);
}

function PaginationControls({
  label,
  page,
  total,
  onChange,
}: {
  label: string;
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const t = useTranslations("issues.detail");
  const pageCount = Math.max(1, Math.ceil(total / RELATED_PAGE_SIZE));

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
      <p className="text-xs text-muted-foreground">
        {t("pageSummary", {
          label,
          page: page + 1,
          total: pageCount,
          count: total,
        })}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={page === 0}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onChange(Math.max(0, page - 1))}
        >
          {t("previousPage")}
        </Button>
        <Button
          disabled={page + 1 >= pageCount}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        >
          {t("nextPage")}
        </Button>
      </div>
    </div>
  );
}

function IssueReport({ issue }: { issue: Issue }) {
  const t = useTranslations("issues.detail");

  return (
    <OperationsDetailSection title={t("reportTitle")}>
      <div className="space-y-5">
        <OperationsInfoList
          items={[
            { label: t("agent"), value: issue.agentName },
            { label: t("policy"), value: issue.policyName },
            { label: t("fingerprint"), value: issue.fingerprint },
            { label: t("promptVersion"), value: issue.promptVersion },
            { label: t("session"), value: issue.representativeSessionId },
            { label: t("blocked"), value: issue.isBlocked ? t("blockedYes") : t("blockedNo") },
          ]}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-normal text-muted-foreground">{t("signals")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {issue.riskSignals.map((signal) => (
                <li className="flex gap-2" key={signal}>
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-rose-500" />
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-normal text-muted-foreground">{t("reproduction")}</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
              {issue.reproduction.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
        </div>
      </div>
    </OperationsDetailSection>
  );
}

function IssueMetaPanel({ issue }: { issue: Issue }) {
  const t = useTranslations("issues.detail");

  return (
    <DashboardPanel>
      <div className="space-y-5">
        <MetaGroup title={t("labels")}>
          <div className="flex flex-wrap gap-2">
            {issue.labels.map((label) => (
              <IssueLabelBadge key={label.name} label={label} />
            ))}
          </div>
        </MetaGroup>
        <MetaGroup title={t("tags")}>
          <div className="flex flex-wrap gap-2">
            {issue.tags.map((tag) => (
              <span className="rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-xs font-bold" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        </MetaGroup>
        <MetaGroup title={t("assignees")}>
          <div className="space-y-2">
            {issue.assignees.map((assignee) => (
              <PersonRow key={assignee} name={assignee} />
            ))}
          </div>
        </MetaGroup>
        <MetaGroup title={t("reporter")}>
          <PersonRow name={issue.reporter} />
        </MetaGroup>
        <MetaGroup title={t("createdAt")}>
          <p className="text-sm font-bold">{formatDateTime(issue.firstSeenAt)}</p>
        </MetaGroup>
      </div>
    </DashboardPanel>
  );
}

function IssueCollaborationTimeline({ issue }: { issue: Issue }) {
  const t = useTranslations("issues.detail");

  return (
    <DashboardPanel>
      <h2 className="text-sm font-bold">{t("discussionTimeline")}</h2>
      <div className="mt-5 space-y-0">
        {issue.collaborationTimeline.map((event, index) => (
          <CollaborationTimelineItem
            event={event}
            isLast={index === issue.collaborationTimeline.length - 1}
            key={event.id}
          />
        ))}
      </div>
    </DashboardPanel>
  );
}

function CollaborationTimelineItem({
  event,
  isLast,
}: {
  event: IssueCollaborationEvent;
  isLast: boolean;
}) {
  const isComment = event.type === "comment";

  return (
    <div className="grid grid-cols-[32px_1fr] gap-3">
      <div className="flex flex-col items-center">
        <TimelineMarker event={event} />
        {!isLast ? <span className="h-full min-h-8 w-px bg-border" /> : null}
      </div>
      <div className={isComment ? "mb-4 overflow-hidden rounded-md border border-border/70" : "mb-4 py-1"}>
        {isComment ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/30 px-3 py-2">
              <p className="text-sm font-bold">{event.actor}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</p>
            </div>
            <div className="p-3">
              <p className="text-sm font-bold">{event.title}</p>
              {event.body ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.body}</p> : null}
            </div>
          </>
        ) : (
          <div>
            <p className="text-sm">
              <span className="font-bold">{event.actor}</span>{" "}
              <span className="text-muted-foreground">{event.title}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</p>
            {event.body ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.body}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineMarker({ event }: { event: IssueCollaborationEvent }) {
  if (event.type === "comment") {
    return (
      <Avatar size="sm">
        <AvatarImage
          alt={event.actor}
          className="bg-background"
          src="https://github.com/shadcn.png"
        />
        <AvatarFallback>{getInitials(event.actor)}</AvatarFallback>
      </Avatar>
    );
  }

  return (
    <span className="flex size-8 items-center justify-center rounded-full border border-border bg-background">
      <TimelineIcon type={event.type} />
    </span>
  );
}

function IssueCommentBox() {
  const t = useTranslations("issues.detail");

  return (
    <DashboardPanel>
      <h2 className="text-sm font-bold">{t("addComment")}</h2>
      <div className="mt-4">
        <Textarea className="min-h-28" placeholder={t("commentPlaceholder")} />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline">{t("saveDraft")}</Button>
          <Button>{t("comment")}</Button>
        </div>
      </div>
    </DashboardPanel>
  );
}

function TimelineIcon({ type }: { type: IssueCollaborationEvent["type"] }) {
  if (type === "comment") return <MessageSquare className="size-4 text-blue-600" />;
  if (type === "created") return <Bot className="size-4 text-emerald-600" />;
  if (type === "label_added" || type === "tag_added") return <Tag className="size-4 text-amber-600" />;
  if (type === "assigned") return <UserPlus className="size-4 text-blue-600" />;
  return <CircleDot className="size-4 text-slate-600" />;
}

function MetaGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-normal text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function IssueLabelBadge({ label }: { label: IssueLabel }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-bold ${getIssueLabelClass(label.color)}`}>
      {label.name}
    </span>
  );
}

function PersonRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="text-sm font-bold">{name}</span>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getIssueLabelClass(color: IssueLabel["color"]) {
  if (color === "rose") return "bg-rose-100 text-rose-800";
  if (color === "amber") return "bg-amber-100 text-amber-800";
  if (color === "blue") return "bg-blue-100 text-blue-800";
  if (color === "emerald") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-800";
}

function IssueMetrics({ issues }: { issues: ReturnType<typeof listIssues> }) {
  const t = useTranslations("issues.metrics");

  return (
    <section className="grid gap-3 md:grid-cols-4">
      <OperationsKpiCard label={t("open")} value={String(issues.filter((issue) => issue.status === "open").length)} description={t("openHint")} tone="bad" />
      <OperationsKpiCard label={t("review")} value={String(issues.filter((issue) => issue.status === "investigating").length)} description={t("reviewHint")} tone="warning" />
      <OperationsKpiCard label={t("blocked")} value={String(issues.filter((issue) => issue.isBlocked).length)} description={t("blockedHint")} tone="bad" />
      <OperationsKpiCard label={t("fingerprints")} value={String(new Set(issues.map((issue) => issue.fingerprint)).size)} description={t("fingerprintsHint")} />
    </section>
  );
}

function PriorityIssuePanel() {
  const t = useTranslations("issues.priority");
  const severity = useTranslations("severity");
  const issues = listIssues();
  const issue = issues.find((item) => item.severity === "critical") ?? issues[0];

  return (
    <DashboardPanel>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ShieldAlert className="size-4 text-rose-600" />
            <h2 className="text-sm font-bold">{t("title")}</h2>
            <OperationsBadge className={getSeverityClass(issue.severity)}>{severity(issue.severity)}</OperationsBadge>
          </div>
          <p className="mt-3 text-sm font-bold">{issue.title}</p>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-muted-foreground">{t("cause")}</p>
              <p className="mt-1">{issue.fingerprint}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-muted-foreground">{t("evidence")}</p>
              <p className="mt-1">{issue.riskSignals[0]}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-muted-foreground">{t("nextAction")}</p>
              <p className="mt-1">{t("nextActionText")}</p>
            </div>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/issues/tracker/${issue.id}`}>
            <ArrowUpRight data-icon="inline-start" />
            {issue.representativeSessionId}
          </Link>
        </Button>
      </div>
    </DashboardPanel>
  );
}

function IssueList({ issues }: { issues: ReturnType<typeof listIssues> }) {
  const t = useTranslations("issues");
  const severity = useTranslations("severity");
  const status = useTranslations("status");

  return (
    <DashboardListPanel empty={issues.length === 0} emptyText={t("empty")}>
      {issues.map((issue) => (
        <Link className="block rounded-md px-3 py-3 hover:bg-muted/30" href={`/issues/tracker/${issue.id}`} key={issue.id}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">{issue.title}</p>
                <OperationsBadge className={getSeverityClass(issue.severity)}>{severity(issue.severity)}</OperationsBadge>
                <OperationsBadge className={getStateClass(issue.status)}>{status(issue.status)}</OperationsBadge>
              </div>
              <p className="mt-1 max-w-3xl truncate text-sm text-muted-foreground">{issue.summary}</p>
              <p className="mt-2 text-xs text-muted-foreground">{issue.agentName} / {issue.policyName} / {issue.promptVersion}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-right text-xs text-muted-foreground">
              <Metric label={t("fields.occurrences")} value={String(issue.occurrences)} />
              <Metric label={t("fields.sessions")} value={String(issue.relatedSessions)} />
              <Metric label={t("fields.lastSeen")} value={formatDateTime(issue.lastSeenAt)} />
            </div>
          </div>
        </Link>
      ))}
    </DashboardListPanel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p>{label}</p>
      <p className="mt-1 font-bold text-foreground">{value}</p>
    </div>
  );
}

function Bar({ height, className }: { height: number; className: string }) {
  return <div className={`flex-1 rounded-t-md ${className}`} style={{ height: `${Math.max(height, 6)}px` }} />;
}
