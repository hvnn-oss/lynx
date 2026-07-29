"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuditTable } from "@/components/audit-table";
import { Tabs } from "@/components/tabs";
import {
  Badge,
  Definition,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageHeader,
  Panel,
} from "@/components/ui";
import {
  getOrganization,
  listPlans,
  updateOrganizationPlan,
} from "@/lib/admin-api";
import type { AdminPlan, OrganizationDetail } from "@/lib/admin-types";
import {
  formatCurrency,
  formatDate,
  formatLimit,
  formatNumber,
} from "@/lib/format";

export default function OrganizationDetailPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const [data, setData] = useState<OrganizationDetail | null>(null);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = () => {
    setError("");
    Promise.all([getOrganization(organizationId), listPlans()])
      .then(([organization, planItems]) => {
        setData(organization);
        setSelectedPlanId(organization.plan.id);
        setPlans(planItems);
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "조회에 실패했습니다.",
        );
      });
  };

  useEffect(() => {
    let isCurrent = true;
    Promise.all([getOrganization(organizationId), listPlans()])
      .then(([organization, planItems]) => {
        if (!isCurrent) return;
        setData(organization);
        setSelectedPlanId(organization.plan.id);
        setPlans(planItems);
      })
      .catch((cause: unknown) => {
        if (isCurrent) {
          setError(
            cause instanceof Error ? cause.message : "조회에 실패했습니다.",
          );
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [organizationId]);

  if (!data && !error) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title={data.name}
        description={`소유자 ${data.owner.name} · ${data.owner.email}`}
        action={
          <Link className="button button-secondary" href="/organizations">
            목록으로
          </Link>
        }
      />
      <section className="metrics-grid">
        <Metric
          label="워크스페이스"
          value={formatNumber(data.workspaceCount)}
          hint={`한도 ${formatLimit(data.plan.maxWorkspaces)}`}
        />
        <Metric
          label="조직 멤버"
          value={formatNumber(data.memberCount)}
          hint={`한도 ${formatLimit(data.plan.maxMembers)}`}
        />
        <Metric
          label="저장된 이벤트"
          value={formatNumber(data.storedData.eventCount)}
          hint={
            data.storedData.latestEventAt
              ? `최근 ${formatDate(data.storedData.latestEventAt)}`
              : "아직 수집된 이벤트 없음"
          }
        />
        <Metric
          label="이번 달 비용"
          value={formatCurrency(data.currentMonthUsage.totalCost)}
          hint={`${formatNumber(data.currentMonthUsage.sessionCount)}개 세션`}
        />
      </section>
      <Panel>
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "overview", label: "요약" },
            { value: "data", label: "데이터 현황" },
            {
              value: "workspaces",
              label: "워크스페이스",
              count: data.workspaces.length,
            },
            { value: "members", label: "멤버", count: data.members.length },
            {
              value: "audit",
              label: "감사 기록",
              count: data.recentAuditLogs.length,
            },
          ]}
        >
          {tab === "overview" && (
            <div className="organization-overview">
              <section>
                <h3>현재 요금제</h3>
                <div className="plan-current">
                  <div>
                    <Badge tone={data.plan.isActive ? "success" : "warning"}>
                      {data.plan.code}
                    </Badge>
                    <strong>{data.plan.name}</strong>
                  </div>
                  <dl className="definition-grid compact">
                    <Definition label="데이터 보존">
                      {data.plan.retentionDays}일
                    </Definition>
                    <Definition label="월간 이벤트">
                      {formatLimit(data.plan.monthlyEventLimit)}
                    </Definition>
                    <Definition label="포함 로그">
                      {formatLimit(data.plan.includedLogCount)}
                    </Definition>
                    <Definition label="초과 단가">
                      {data.plan.logOverageUnitPrice === null
                        ? "설정 안 됨"
                        : formatCurrency(data.plan.logOverageUnitPrice)}
                    </Definition>
                  </dl>
                </div>
              </section>
              <section className="plan-change">
                <h3>요금제 변경</h3>
                <p>
                  변경 즉시 조직의 모든 워크스페이스에 새 한도와 보존 기간이
                  적용됩니다.
                </p>
                <label className="field">
                  <span>할당할 요금제</span>
                  <select
                    value={selectedPlanId}
                    onChange={(event) => setSelectedPlanId(event.target.value)}
                  >
                    {plans.map((plan) => (
                      <option
                        key={plan.id}
                        value={plan.id}
                        disabled={!plan.isActive}
                      >
                        {plan.name} ({plan.code})
                        {!plan.isActive ? " · 비활성" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {message && <p className="form-success">{message}</p>}
                <button
                  className="button button-primary"
                  disabled={
                    isSaving ||
                    !selectedPlanId ||
                    selectedPlanId === data.plan.id
                  }
                  onClick={async () => {
                    setIsSaving(true);
                    setMessage("");
                    try {
                      const updated = await updateOrganizationPlan(
                        organizationId,
                        selectedPlanId,
                      );
                      setData(updated);
                      setMessage("요금제가 변경되고 감사 기록에 남았습니다.");
                    } catch (cause) {
                      setMessage(
                        cause instanceof Error
                          ? cause.message
                          : "변경에 실패했습니다.",
                      );
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  {isSaving ? "변경 중…" : "요금제 변경"}
                </button>
              </section>
            </div>
          )}
          {tab === "workspaces" && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>워크스페이스</th>
                    <th>멤버</th>
                    <th>Agent</th>
                    <th>세션</th>
                    <th>Run</th>
                    <th>이벤트</th>
                    <th>비용</th>
                    <th>최근 이벤트</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workspaces.map((workspace) => (
                    <tr key={workspace.id}>
                      <td>
                        <div className="cell-primary">{workspace.name}</div>
                        <code className="cell-code">{workspace.id}</code>
                      </td>
                      <td>{formatNumber(workspace.memberCount)}</td>
                      <td>{formatNumber(workspace.agentCount)}</td>
                      <td>{formatNumber(workspace.sessionCount)}</td>
                      <td>{formatNumber(workspace.runCount)}</td>
                      <td>{formatNumber(workspace.eventCount)}</td>
                      <td>{formatCurrency(workspace.totalCost)}</td>
                      <td className="nowrap">
                        {workspace.latestEventAt
                          ? formatDate(workspace.latestEventAt)
                          : "없음"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "data" && <OrganizationDataStatus data={data} />}
          {tab === "members" && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>사용자</th>
                    <th>역할</th>
                    <th>가입일</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="cell-primary">{member.name}</div>
                        <div className="cell-secondary">{member.email}</div>
                      </td>
                      <td>
                        <Badge>{member.role}</Badge>
                      </td>
                      <td>{formatDate(member.joinedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "audit" && <AuditTable items={data.recentAuditLogs} />}
        </Tabs>
      </Panel>
    </>
  );
}

function OrganizationDataStatus({ data }: { data: OrganizationDetail }) {
  const maxDailyEvents = Math.max(
    ...data.dailyEventTrend.map((item) => item.eventCount),
    1,
  );

  return (
    <div className="organization-data">
      <section className="data-section">
        <header className="section-heading">
          <div>
            <span className="section-kicker">STORED DATA</span>
            <h3>현재 저장 데이터</h3>
            <p>보존 정책 적용 후 지금 DB에 남아 있는 데이터의 총량입니다.</p>
          </div>
          <span>
            {data.storedData.firstEventAt
              ? `${formatDate(data.storedData.firstEventAt)}부터 수집`
              : "수집 이력 없음"}
          </span>
        </header>
        <div className="data-stat-grid">
          <DataStat label="이벤트" value={data.storedData.eventCount} />
          <DataStat label="세션" value={data.storedData.sessionCount} />
          <DataStat label="Run" value={data.storedData.runCount} />
          <DataStat label="Agent" value={data.storedData.agentCount} />
          <DataStat
            label="이슈"
            value={data.storedData.issueCount}
            hint={`열림·조사 중 ${formatNumber(data.storedData.openIssueCount)}`}
          />
          <DataStat
            label="방화벽 탐지"
            value={data.storedData.firewallViolationCount}
          />
          <DataStat label="프롬프트" value={data.storedData.promptCount} />
        </div>
      </section>

      <section className="data-section">
        <header className="section-heading">
          <div>
            <span className="section-kicker">RECENT USAGE</span>
            <h3>최근 사용량</h3>
            <p>수집 상태와 비용 변화를 기간별로 빠르게 비교합니다.</p>
          </div>
        </header>
        <div className="data-stat-grid">
          <DataStat
            label="24시간 이벤트"
            value={data.recentUsage.eventCount24h}
          />
          <DataStat label="7일 이벤트" value={data.recentUsage.eventCount7d} />
          <DataStat
            label="30일 이벤트"
            value={data.recentUsage.eventCount30d}
          />
          <DataStat label="7일 세션" value={data.recentUsage.sessionCount7d} />
          <DataStat label="7일 Run" value={data.recentUsage.runCount7d} />
          <DataStat
            label="7일 비용"
            value={formatCurrency(data.recentUsage.totalCost7d)}
          />
          <DataStat
            label="30일 비용"
            value={formatCurrency(data.recentUsage.totalCost30d)}
          />
          <DataStat
            label="30일 토큰"
            value={formatNumber(
              data.recentUsage.promptTokens30d +
                data.recentUsage.completionTokens30d,
            )}
            hint={`입력 ${formatNumber(data.recentUsage.promptTokens30d)} · 출력 ${formatNumber(data.recentUsage.completionTokens30d)}`}
          />
        </div>
      </section>

      <section className="data-section">
        <header className="section-heading">
          <div>
            <span className="section-kicker">14 DAY TREND</span>
            <h3>최근 14일 이벤트</h3>
            <p>이벤트가 저장된 날짜만 표시합니다.</p>
          </div>
        </header>
        {data.dailyEventTrend.length === 0 ? (
          <EmptyState
            title="최근 이벤트가 없습니다."
            description="SDK에서 이벤트가 들어오면 일별 수집량과 비용이 표시됩니다."
          />
        ) : (
          <div className="event-trend-list">
            {data.dailyEventTrend.map((item) => (
              <div className="event-trend-row" key={item.date}>
                <span>{item.date}</span>
                <div className="event-trend-track">
                  <i
                    style={{
                      width: `${Math.max((item.eventCount / maxDailyEvents) * 100, 2)}%`,
                    }}
                  />
                </div>
                <strong>{formatNumber(item.eventCount)}</strong>
                <small>{formatCurrency(item.totalCost)}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="data-tables">
        <section>
          <header className="section-heading">
            <div>
              <h3>이벤트 유형</h3>
              <p>저장량이 많은 상위 10개 유형입니다.</p>
            </div>
          </header>
          {data.eventTypeDistribution.length === 0 ? (
            <EmptyState
              title="이벤트 유형이 없습니다."
              description="수집된 이벤트가 아직 없습니다."
            />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>저장 건수</th>
                  </tr>
                </thead>
                <tbody>
                  {data.eventTypeDistribution.map((item) => (
                    <tr key={item.eventType}>
                      <td>
                        <Badge>{item.eventType}</Badge>
                      </td>
                      <td>{formatNumber(item.eventCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section>
          <header className="section-heading">
            <div>
              <h3>Agent별 수집량</h3>
              <p>이벤트 수 기준 상위 10개 Agent입니다.</p>
            </div>
          </header>
          {data.agentUsage.length === 0 ? (
            <EmptyState
              title="Agent 사용량이 없습니다."
              description="Agent 실행이 수집되면 이곳에 표시됩니다."
            />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>세션</th>
                    <th>이벤트</th>
                    <th>비용</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agentUsage.map((item) => (
                    <tr key={item.agentId}>
                      <td>
                        <div className="cell-primary">{item.agentName}</div>
                        <code className="cell-code">{item.agentId}</code>
                      </td>
                      <td>{formatNumber(item.sessionCount)}</td>
                      <td>{formatNumber(item.eventCount)}</td>
                      <td>{formatCurrency(item.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DataStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="data-stat">
      <span>{label}</span>
      <strong>{typeof value === "number" ? formatNumber(value) : value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
