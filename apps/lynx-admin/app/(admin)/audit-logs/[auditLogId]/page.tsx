"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JsonViewer } from "@/components/json-viewer";
import { Tabs } from "@/components/tabs";
import {
  Badge,
  Definition,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/ui";
import { getAuditLog } from "@/lib/admin-api";
import type { AuditLogDetail } from "@/lib/admin-types";
import { formatAction, formatDate } from "@/lib/format";

export default function AuditLogDetailPage() {
  const { auditLogId } = useParams<{ auditLogId: string }>();
  const [data, setData] = useState<AuditLogDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  const load = () => {
    setError("");
    getAuditLog(auditLogId)
      .then(setData)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "조회에 실패했습니다.",
        );
      });
  };

  useEffect(() => {
    let isCurrent = true;
    getAuditLog(auditLogId)
      .then((result) => {
        if (isCurrent) setData(result);
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
  }, [auditLogId]);

  if (!data && !error) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title={formatAction(data.action)}
        description={`${formatDate(data.createdAt)}에 기록된 관리 작업입니다.`}
        action={
          <Link className="button button-secondary" href="/audit-logs">
            목록으로
          </Link>
        }
      />
      <div className="detail-summary">
        <div>
          <span>담당자</span>
          <strong>{data.actor.name ?? "알 수 없는 사용자"}</strong>
          <small>{data.actor.email ?? data.actor.id}</small>
        </div>
        <div>
          <span>작업 코드</span>
          <strong>{data.action}</strong>
          <small>{data.targetType}</small>
        </div>
        <div>
          <span>요청 결과</span>
          <strong>
            {data.method ?? "내부 작업"}{" "}
            {data.statusCode && (
              <Badge tone={data.statusCode < 400 ? "success" : "danger"}>
                {data.statusCode}
              </Badge>
            )}
          </strong>
          <small>{data.path ?? "경로 정보 없음"}</small>
        </div>
      </div>
      <Panel>
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "overview", label: "개요" },
            { value: "data", label: "요청·응답" },
            { value: "changes", label: "변경 전·후" },
            { value: "metadata", label: "전체 메타데이터" },
          ]}
        >
          {tab === "overview" && (
            <dl className="definition-grid">
              <Definition label="기록 ID">
                <code>{data.id}</code>
              </Definition>
              <Definition label="대상 종류">{data.targetType}</Definition>
              <Definition label="대상 ID">
                <code>{data.targetId}</code>
              </Definition>
              <Definition label="요청 ID">
                <code>{data.requestId ?? "없음"}</code>
              </Definition>
              <Definition label="조직 ID">
                <code>{data.organizationId ?? "없음"}</code>
              </Definition>
              <Definition label="워크스페이스 ID">
                <code>{data.workspaceId ?? "없음"}</code>
              </Definition>
            </dl>
          )}
          {tab === "data" && (
            <div className="payload-grid">
              <section>
                <h3>서버로 들어온 요청</h3>
                <p>민감한 인증정보는 자동으로 마스킹됩니다.</p>
                <JsonViewer value={data.requestData} />
              </section>
              <section>
                <h3>서버가 반환한 응답</h3>
                <p>성공한 관리 요청의 응답 데이터입니다.</p>
                <JsonViewer value={data.responseData} />
              </section>
            </div>
          )}
          {tab === "changes" && (
            <div className="payload-grid">
              <section>
                <h3>변경 전</h3>
                <p>작업 수행 직전에 확인된 상태입니다.</p>
                <JsonViewer value={data.before} />
              </section>
              <section>
                <h3>변경 후</h3>
                <p>작업 완료 후 저장된 상태입니다.</p>
                <JsonViewer value={data.after} />
              </section>
            </div>
          )}
          {tab === "metadata" && <JsonViewer value={data.metadata} />}
        </Tabs>
      </Panel>
    </>
  );
}
