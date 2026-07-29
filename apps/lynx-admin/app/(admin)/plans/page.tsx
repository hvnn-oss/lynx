"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PlanForm } from "@/components/plan-form";
import { Tabs } from "@/components/tabs";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/ui";
import { createPlan, listPlans, updatePlan } from "@/lib/admin-api";
import type { AdminPlan } from "@/lib/admin-types";
import {
  formatCurrency,
  formatDate,
  formatLimit,
  formatNumber,
} from "@/lib/format";

export default function PlansPage() {
  return (
    <Suspense fallback={<LoadingState label="요금제를 준비하고 있습니다." />}>
      <PlansContent />
    </Suspense>
  );
}

function PlansContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState(requestedTab === "create" ? "create" : "list");
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = () => {
    setIsLoading(true);
    setError("");
    listPlans()
      .then((items) => {
        setPlans(items);
        setSelectedPlanId((current) => current || items[0]?.id || "");
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "조회에 실패했습니다.",
        );
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let isCurrent = true;
    listPlans()
      .then((items) => {
        if (!isCurrent) return;
        setPlans(items);
        setSelectedPlanId(items[0]?.id ?? "");
      })
      .catch((cause: unknown) => {
        if (isCurrent) {
          setError(
            cause instanceof Error ? cause.message : "조회에 실패했습니다.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

  return (
    <>
      <PageHeader
        title="요금제 관리"
        description="기본 요금제부터 파일럿·엔터프라이즈 전용 계약까지 한도와 기능을 구성합니다."
      />
      <Panel>
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setMessage("");
            setTab(value);
          }}
          items={[
            { value: "list", label: "요금제 목록", count: plans.length },
            { value: "create", label: "새 요금제" },
            { value: "edit", label: "요금제 편집" },
          ]}
        >
          {isLoading && <LoadingState />}
          {!isLoading && error && <ErrorState message={error} onRetry={load} />}
          {!isLoading && !error && tab === "list" && (
            <>
              {plans.length === 0 ? (
                <EmptyState
                  title="등록된 요금제가 없습니다."
                  description="새 요금제 탭에서 첫 요금제를 만들어 주세요."
                />
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>요금제</th>
                        <th>상태</th>
                        <th>사용 조직</th>
                        <th>주요 한도</th>
                        <th>마지막 변경</th>
                        <th aria-label="편집" />
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan) => (
                        <tr key={plan.id}>
                          <td>
                            <div className="cell-primary">{plan.name}</div>
                            <code className="cell-code">{plan.code}</code>
                          </td>
                          <td>
                            <Badge tone={plan.isActive ? "success" : "warning"}>
                              {plan.isActive ? "활성" : "비활성"}
                            </Badge>
                          </td>
                          <td>{formatNumber(plan.organizationCount)}개</td>
                          <td>
                            <div className="cell-primary">
                              워크스페이스 {formatLimit(plan.maxWorkspaces)}
                            </div>
                            <div className="cell-secondary">
                              이벤트 {formatLimit(plan.monthlyEventLimit)} ·{" "}
                              {plan.retentionDays}일 보존
                            </div>
                          </td>
                          <td className="nowrap">
                            {formatDate(plan.updatedAt)}
                          </td>
                          <td>
                            <button
                              className="table-link"
                              onClick={() => {
                                setSelectedPlanId(plan.id);
                                setTab("edit");
                              }}
                            >
                              편집
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {!isLoading && !error && tab === "create" && (
            <PlanForm
              submitLabel="요금제 만들기"
              onSubmit={async (input) => {
                const created = await createPlan(input);
                setPlans([...plans, created]);
                setSelectedPlanId(created.id);
                setMessage(`${created.name} 요금제를 만들었습니다.`);
                setTab("edit");
              }}
            />
          )}
          {!isLoading && !error && tab === "edit" && (
            <>
              <div className="edit-selector">
                <label className="field">
                  <span>편집할 요금제</span>
                  <select
                    value={selectedPlanId}
                    onChange={(event) => {
                      setSelectedPlanId(event.target.value);
                      setMessage("");
                    }}
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({plan.code})
                      </option>
                    ))}
                  </select>
                </label>
                {selectedPlan && (
                  <div className="plan-inline-summary">
                    <span>
                      사용 조직{" "}
                      <strong>
                        {formatNumber(selectedPlan.organizationCount)}
                      </strong>
                    </span>
                    <span>
                      초과 단가{" "}
                      <strong>
                        {selectedPlan.logOverageUnitPrice === null
                          ? "없음"
                          : formatCurrency(selectedPlan.logOverageUnitPrice)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
              {message && <p className="form-success">{message}</p>}
              {selectedPlan ? (
                <PlanForm
                  key={selectedPlan.id}
                  plan={selectedPlan}
                  submitLabel="변경 내용 저장"
                  onSubmit={async (input) => {
                    const changes: Partial<typeof input> = { ...input };
                    delete changes.code;
                    const updated = await updatePlan(selectedPlan.id, changes);
                    setPlans(
                      plans.map((plan) =>
                        plan.id === updated.id ? updated : plan,
                      ),
                    );
                    setMessage(
                      `${updated.name} 요금제를 저장하고 감사 기록에 남겼습니다.`,
                    );
                  }}
                />
              ) : (
                <EmptyState
                  title="편집할 요금제가 없습니다."
                  description="새 요금제를 먼저 만들어 주세요."
                />
              )}
            </>
          )}
        </Tabs>
      </Panel>
    </>
  );
}
