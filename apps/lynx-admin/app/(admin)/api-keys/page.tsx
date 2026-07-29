"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs } from "@/components/tabs";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageHeader,
  Panel,
} from "@/components/ui";
import {
  getOpenApiUsage,
  listAdminApiKeys,
  revokeAdminApiKey,
} from "@/lib/admin-api";
import type {
  AdminApiKeyKind,
  AdminApiKeyList,
  AdminApiKeyStatus,
  OpenApiUsage,
  OpenApiUsagePeriod,
} from "@/lib/admin-types";
import { formatDate, formatNumber } from "@/lib/format";

const PAGE_SIZE = "25";

export default function ApiKeysPage() {
  const [tab, setTab] = useState("keys");
  const [keys, setKeys] = useState<AdminApiKeyList | null>(null);
  const [usage, setUsage] = useState<OpenApiUsage | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<
    Array<string | undefined>
  >([]);
  const [period, setPeriod] = useState<OpenApiUsagePeriod>("7d");
  const [keyError, setKeyError] = useState("");
  const [usageError, setUsageError] = useState("");
  const [revokingId, setRevokingId] = useState("");

  const loadKeys = useCallback(async () => {
    setKeyError("");
    try {
      setKeys(
        await listAdminApiKeys({
          search: appliedSearch || undefined,
          status: status || undefined,
          kind: kind || undefined,
          cursor,
          limit: PAGE_SIZE,
        }),
      );
    } catch (cause) {
      setKeyError(
        cause instanceof Error
          ? cause.message
          : "API Key 목록을 불러오지 못했습니다.",
      );
    }
  }, [appliedSearch, cursor, kind, status]);

  const loadUsage = useCallback(async () => {
    setUsageError("");
    try {
      setUsage(await getOpenApiUsage({ period }));
    } catch (cause) {
      setUsageError(
        cause instanceof Error
          ? cause.message
          : "OpenAPI 사용량을 불러오지 못했습니다.",
      );
    }
  }, [period]);

  useEffect(() => {
    let isCurrent = true;
    listAdminApiKeys({
      search: appliedSearch || undefined,
      status: status || undefined,
      kind: kind || undefined,
      cursor,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (!isCurrent) return;
        setKeyError("");
        setKeys(result);
      })
      .catch((cause: unknown) => {
        if (!isCurrent) return;
        setKeyError(
          cause instanceof Error
            ? cause.message
            : "API Key 목록을 불러오지 못했습니다.",
        );
      });
    return () => {
      isCurrent = false;
    };
  }, [appliedSearch, cursor, kind, status]);

  useEffect(() => {
    let isCurrent = true;
    getOpenApiUsage({ period })
      .then((result) => {
        if (!isCurrent) return;
        setUsageError("");
        setUsage(result);
      })
      .catch((cause: unknown) => {
        if (!isCurrent) return;
        setUsageError(
          cause instanceof Error
            ? cause.message
            : "OpenAPI 사용량을 불러오지 못했습니다.",
        );
      });
    return () => {
      isCurrent = false;
    };
  }, [period]);

  return (
    <>
      <PageHeader
        title="API Key 및 OpenAPI 사용량"
        description="발급된 키의 상태와 최근 사용 기록을 확인하고, SDK 요청량과 오류를 운영 관점에서 점검합니다."
      />
      <Panel>
        <Tabs
          items={[
            { value: "keys", label: "API Key", count: keys?.items.length },
            { value: "usage", label: "OpenAPI 사용량" },
          ]}
          value={tab}
          onValueChange={setTab}
        >
          {tab === "keys" && (
            <ApiKeyTab
              data={keys}
              error={keyError}
              search={search}
              status={status}
              kind={kind}
              cursor={cursor}
              cursorHistory={cursorHistory}
              revokingId={revokingId}
              onSearchChange={setSearch}
              onStatusChange={(value) => {
                setStatus(value);
                resetCursor(setCursor, setCursorHistory);
              }}
              onKindChange={(value) => {
                setKind(value);
                resetCursor(setCursor, setCursorHistory);
              }}
              onSearch={() => {
                setAppliedSearch(search.trim());
                resetCursor(setCursor, setCursorHistory);
              }}
              onRetry={loadKeys}
              onCursorChange={setCursor}
              onCursorHistoryChange={setCursorHistory}
              onRevoke={async (apiKeyId, name) => {
                if (
                  !window.confirm(
                    `${name} 키를 폐기할까요? 이 키를 사용하는 SDK 요청은 즉시 거절됩니다.`,
                  )
                ) {
                  return;
                }
                setRevokingId(apiKeyId);
                setKeyError("");
                try {
                  await revokeAdminApiKey(apiKeyId);
                  await Promise.all([loadKeys(), loadUsage()]);
                } catch (cause) {
                  setKeyError(
                    cause instanceof Error
                      ? cause.message
                      : "API Key 폐기에 실패했습니다.",
                  );
                } finally {
                  setRevokingId("");
                }
              }}
            />
          )}
          {tab === "usage" && (
            <OpenApiUsageTab
              data={usage}
              error={usageError}
              period={period}
              onPeriodChange={setPeriod}
              onRetry={loadUsage}
            />
          )}
        </Tabs>
      </Panel>
    </>
  );
}

function ApiKeyTab({
  data,
  error,
  search,
  status,
  kind,
  cursor,
  cursorHistory,
  revokingId,
  onSearchChange,
  onStatusChange,
  onKindChange,
  onSearch,
  onRetry,
  onCursorChange,
  onCursorHistoryChange,
  onRevoke,
}: {
  data: AdminApiKeyList | null;
  error: string;
  search: string;
  status: string;
  kind: string;
  cursor: string | undefined;
  cursorHistory: Array<string | undefined>;
  revokingId: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onKindChange: (value: string) => void;
  onSearch: () => void;
  onRetry: () => void;
  onCursorChange: (cursor: string | undefined) => void;
  onCursorHistoryChange: (history: Array<string | undefined>) => void;
  onRevoke: (apiKeyId: string, name: string) => Promise<void>;
}) {
  return (
    <>
      <form
        className="compact-filter"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <label className="field field-grow">
          <span>키 검색</span>
          <input
            value={search}
            placeholder="이름, prefix, 조직 또는 워크스페이스"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <label className="field">
          <span>상태</span>
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option value="">전체 상태</option>
            <option value="ACTIVE">사용 중</option>
            <option value="EXPIRED">만료됨</option>
            <option value="REVOKED">폐기됨</option>
          </select>
        </label>
        <label className="field">
          <span>종류</span>
          <select
            value={kind}
            onChange={(event) => onKindChange(event.target.value)}
          >
            <option value="">전체 종류</option>
            <option value="SDK">SDK</option>
            <option value="INGEST">수집</option>
            <option value="AUTOMATION">자동화</option>
          </select>
        </label>
        <button className="button button-primary">검색</button>
      </form>
      {!data && !error && <LoadingState label="API Key를 불러오는 중입니다." />}
      {!data && error && <ErrorState message={error} onRetry={onRetry} />}
      {data && error && <p className="form-error">{error}</p>}
      {data?.items.length === 0 && (
        <EmptyState
          title="조건에 맞는 API Key가 없습니다."
          description="검색어나 상태 필터를 바꿔 다시 확인해 보세요."
        />
      )}
      {data && data.items.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>API Key</th>
                <th>상태</th>
                <th>조직 / 워크스페이스</th>
                <th>권한</th>
                <th>최근 사용</th>
                <th>생성 정보</th>
                <th aria-label="작업" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((apiKey) => (
                <tr key={apiKey.id}>
                  <td>
                    <div className="cell-primary">{apiKey.name}</div>
                    <code className="cell-code">{apiKey.prefix}••••••••</code>
                    <div className="cell-secondary">
                      {getKindLabel(apiKey.kind)}
                    </div>
                  </td>
                  <td>
                    <Badge tone={getStatusTone(apiKey.status)}>
                      {getStatusLabel(apiKey.status)}
                    </Badge>
                  </td>
                  <td>
                    <div className="cell-primary">
                      {apiKey.organization.name}
                    </div>
                    <div className="cell-secondary">
                      {apiKey.workspace.name}
                    </div>
                  </td>
                  <td>
                    <div className="inline-badges">
                      {apiKey.scopes.map((scope) => (
                        <Badge key={scope}>{scope}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="nowrap">
                    {apiKey.lastUsedAt
                      ? formatDate(apiKey.lastUsedAt)
                      : "사용 기록 없음"}
                  </td>
                  <td>
                    <div className="cell-primary">
                      {apiKey.createdBy.name ?? "시스템"}
                    </div>
                    <div className="cell-secondary">
                      {formatDate(apiKey.createdAt)}
                    </div>
                  </td>
                  <td>
                    {apiKey.status !== "REVOKED" && (
                      <button
                        className="text-link danger-link"
                        disabled={revokingId === apiKey.id}
                        onClick={() => void onRevoke(apiKey.id, apiKey.name)}
                      >
                        {revokingId === apiKey.id ? "폐기 중" : "폐기"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <div className="pagination">
          <button
            className="button button-secondary"
            disabled={cursorHistory.length === 0}
            onClick={() => {
              const history = [...cursorHistory];
              const previous = history.pop();
              onCursorHistoryChange(history);
              onCursorChange(previous);
            }}
          >
            이전
          </button>
          <span>페이지 {cursorHistory.length + 1}</span>
          <button
            className="button button-secondary"
            disabled={!data.nextCursor}
            onClick={() => {
              onCursorHistoryChange([...cursorHistory, cursor]);
              onCursorChange(data.nextCursor ?? undefined);
            }}
          >
            다음
          </button>
        </div>
      )}
    </>
  );
}

function OpenApiUsageTab({
  data,
  error,
  period,
  onPeriodChange,
  onRetry,
}: {
  data: OpenApiUsage | null;
  error: string;
  period: OpenApiUsagePeriod;
  onPeriodChange: (period: OpenApiUsagePeriod) => void;
  onRetry: () => void;
}) {
  const maximumDailyRequests = useMemo(
    () => Math.max(1, ...(data?.dailyTrend.map((item) => item.requestCount) ?? [])),
    [data],
  );

  return (
    <>
      <div className="usage-toolbar">
        <div>
          <strong>요청 집계</strong>
          <span>요청 본문과 응답 본문은 저장하지 않습니다.</span>
        </div>
        <label className="field">
          <span>조회 기간</span>
          <select
            value={period}
            onChange={(event) =>
              onPeriodChange(event.target.value as OpenApiUsagePeriod)
            }
          >
            <option value="24h">최근 24시간</option>
            <option value="7d">최근 7일</option>
            <option value="30d">최근 30일</option>
          </select>
        </label>
      </div>
      {!data && !error && (
        <LoadingState label="OpenAPI 사용량을 집계하는 중입니다." />
      )}
      {!data && error && <ErrorState message={error} onRetry={onRetry} />}
      {data && error && <p className="form-error">{error}</p>}
      {data && (
        <>
          <div className="metrics-grid usage-metrics">
            <Metric
              label="전체 요청"
              value={formatNumber(data.summary.requestCount)}
              hint={`성공률 ${data.summary.successRate.toFixed(1)}%`}
            />
            <Metric
              label="수집된 이벤트"
              value={formatNumber(data.summary.acceptedEventCount)}
              hint={`거절 ${formatNumber(data.summary.rejectedEventCount)}건`}
            />
            <Metric
              label="평균 응답 시간"
              value={`${formatNumber(data.summary.averageLatencyMs)}ms`}
              hint={`서버 오류 ${formatNumber(data.summary.serverErrorCount)}건`}
            />
            <Metric
              label="활성 API Key"
              value={formatNumber(data.keyStatus.active)}
              hint={`만료 ${formatNumber(data.keyStatus.expired)} · 폐기 ${formatNumber(data.keyStatus.revoked)}`}
            />
          </div>
          <div className="usage-grid">
            <section className="usage-section">
              <header>
                <div>
                  <h2>일별 요청 추이</h2>
                  <p>요청량과 오류·속도 제한 발생을 함께 확인합니다.</p>
                </div>
                <small>
                  송수신 {formatBytes(
                    data.summary.requestBytes + data.summary.responseBytes,
                  )}
                </small>
              </header>
              {data.dailyTrend.length === 0 ? (
                <EmptyState
                  title="아직 집계된 요청이 없습니다."
                  description="새 OpenAPI 요청부터 시간 단위로 집계됩니다."
                />
              ) : (
                <div className="usage-trend">
                  {data.dailyTrend.map((item) => (
                    <div className="usage-trend-row" key={item.date}>
                      <span>{item.date.slice(5)}</span>
                      <div className="usage-trend-track">
                        <i
                          style={{
                            width: `${Math.max(
                              2,
                              (item.requestCount / maximumDailyRequests) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                      <strong>{formatNumber(item.requestCount)}</strong>
                      <small>
                        오류 {formatNumber(item.errorCount)} · 제한{" "}
                        {formatNumber(item.rateLimitedCount)}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="usage-section">
              <header>
                <div>
                  <h2>엔드포인트별 사용량</h2>
                  <p>요청이 집중되거나 오류가 많은 경로입니다.</p>
                </div>
              </header>
              {data.endpoints.length === 0 ? (
                <EmptyState
                  title="엔드포인트 사용량이 없습니다."
                  description="선택한 기간에 처리된 요청이 없습니다."
                />
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>엔드포인트</th>
                        <th>요청</th>
                        <th>오류</th>
                        <th>속도 제한</th>
                        <th>평균 지연</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.endpoints.map((endpoint) => (
                        <tr key={endpoint.endpoint}>
                          <td>
                            <code className="cell-code">
                              {endpoint.endpoint}
                            </code>
                          </td>
                          <td>{formatNumber(endpoint.requestCount)}</td>
                          <td>{formatNumber(endpoint.errorCount)}</td>
                          <td>{formatNumber(endpoint.rateLimitedCount)}</td>
                          <td>{formatNumber(endpoint.averageLatencyMs)}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
          <section className="usage-section usage-key-section">
            <header>
              <div>
                <h2>사용량이 많은 API Key</h2>
                <p>키별 요청, 오류와 실제 이벤트 수집량을 비교합니다.</p>
              </div>
            </header>
            {data.keys.length === 0 ? (
              <EmptyState
                title="사용된 API Key가 없습니다."
                description="선택한 기간에 인증된 OpenAPI 요청이 없습니다."
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>API Key</th>
                      <th>조직 / 워크스페이스</th>
                      <th>요청</th>
                      <th>수집 이벤트</th>
                      <th>오류</th>
                      <th>속도 제한</th>
                      <th>최근 사용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keys.map((apiKey) => (
                      <tr key={apiKey.apiKeyId}>
                        <td>
                          <div className="cell-primary">{apiKey.name}</div>
                          <code className="cell-code">
                            {apiKey.prefix}••••••••
                          </code>
                        </td>
                        <td>
                          <div className="cell-primary">
                            {apiKey.organization.name}
                          </div>
                          <div className="cell-secondary">
                            {apiKey.workspace.name}
                          </div>
                        </td>
                        <td>{formatNumber(apiKey.requestCount)}</td>
                        <td>{formatNumber(apiKey.acceptedEventCount)}</td>
                        <td>{formatNumber(apiKey.errorCount)}</td>
                        <td>{formatNumber(apiKey.rateLimitedCount)}</td>
                        <td className="nowrap">
                          {apiKey.lastUsedAt
                            ? formatDate(apiKey.lastUsedAt)
                            : "사용 기록 없음"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function resetCursor(
  setCursor: (cursor: string | undefined) => void,
  setHistory: (history: Array<string | undefined>) => void,
): void {
  setCursor(undefined);
  setHistory([]);
}

function getStatusLabel(status: AdminApiKeyStatus): string {
  return {
    ACTIVE: "사용 중",
    EXPIRED: "만료됨",
    REVOKED: "폐기됨",
  }[status];
}

function getStatusTone(
  status: AdminApiKeyStatus,
): "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "EXPIRED") return "warning";
  return "danger";
}

function getKindLabel(kind: AdminApiKeyKind): string {
  return {
    SDK: "SDK",
    INGEST: "수집",
    AUTOMATION: "자동화",
  }[kind];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
