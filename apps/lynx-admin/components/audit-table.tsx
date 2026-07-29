import Link from "next/link";
import type { AuditLogSummary } from "@/lib/admin-types";
import { formatAction, formatDate } from "@/lib/format";
import { Badge, EmptyState } from "./ui";

export function AuditTable({ items }: { items: AuditLogSummary[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="감사 기록이 없습니다."
        description="관리 작업이 수행되면 여기에 기록됩니다."
      />
    );
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>작업</th>
            <th>담당자</th>
            <th>대상</th>
            <th>요청</th>
            <th>시각</th>
            <th aria-label="상세" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="cell-primary">{formatAction(item.action)}</div>
                <div className="cell-secondary">{item.action}</div>
              </td>
              <td>
                <div className="cell-primary">
                  {item.actor.name ?? "알 수 없는 사용자"}
                </div>
                <div className="cell-secondary">
                  {item.actor.email ?? item.actor.id}
                </div>
              </td>
              <td>
                <div className="cell-primary">{item.targetType}</div>
                <code className="cell-code">{item.targetId}</code>
              </td>
              <td>
                <div className="inline-badges">
                  {item.method && <Badge tone="info">{item.method}</Badge>}
                  {item.statusCode && (
                    <Badge tone={item.statusCode < 400 ? "success" : "danger"}>
                      {item.statusCode}
                    </Badge>
                  )}
                  {item.hasPayload && <Badge>데이터</Badge>}
                </div>
              </td>
              <td className="nowrap">{formatDate(item.createdAt)}</td>
              <td>
                <Link className="table-link" href={`/audit-logs/${item.id}`}>
                  보기
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
