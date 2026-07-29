"use client";

import { useState } from "react";
import type { AdminPlan, PlanInput } from "@/lib/admin-types";

const defaultInput: PlanInput = {
  code: "",
  name: "",
  maxWorkspaces: 1,
  maxMembers: 5,
  retentionDays: 30,
  monthlyEventLimit: 100_000,
  includedLogCount: 100_000,
  logOverageUnitPrice: 0,
  features: {},
  isActive: true,
};

export function PlanForm({
  plan,
  submitLabel,
  onSubmit,
}: {
  plan?: AdminPlan;
  submitLabel: string;
  onSubmit: (input: PlanInput) => Promise<void>;
}) {
  const [input, setInput] = useState<PlanInput>(
    plan ? toInput(plan) : defaultInput,
  );
  const [featuresText, setFeaturesText] = useState(
    JSON.stringify(plan?.features ?? {}, null, 2),
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updateNullableNumber = (
    field:
      | "maxWorkspaces"
      | "maxMembers"
      | "monthlyEventLimit"
      | "includedLogCount"
      | "logOverageUnitPrice",
    value: string,
  ) => {
    setInput({
      ...input,
      [field]: value === "" ? null : Number(value),
    });
  };

  return (
    <form
      className="plan-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        let features: Record<string, unknown>;
        try {
          const parsed = JSON.parse(featuresText) as unknown;
          if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
            throw new Error();
          }
          features = parsed as Record<string, unknown>;
        } catch {
          setError("기능 플래그는 올바른 JSON 객체여야 합니다.");
          return;
        }

        setIsSaving(true);
        try {
          await onSubmit({
            ...input,
            code: input.code.trim().toUpperCase(),
            name: input.name.trim(),
            features,
          });
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "저장에 실패했습니다.",
          );
        } finally {
          setIsSaving(false);
        }
      }}
    >
      <section className="form-section">
        <h3>기본 정보</h3>
        <div className="form-grid">
          <label className="field">
            <span>요금제 코드</span>
            <input
              value={input.code}
              disabled={Boolean(plan)}
              placeholder="PILOT_2026"
              pattern="[A-Za-z][A-Za-z0-9_]{1,39}"
              maxLength={40}
              onChange={(event) =>
                setInput({ ...input, code: event.target.value })
              }
              required
            />
            <small>
              {plan
                ? "조직 할당 기준으로 사용되므로 생성 후에는 변경할 수 없습니다."
                : "영문 대문자, 숫자, 밑줄만 사용할 수 있습니다."}
            </small>
          </label>
          <label className="field">
            <span>표시 이름</span>
            <input
              value={input.name}
              placeholder="Pilot 2026"
              maxLength={120}
              onChange={(event) =>
                setInput({ ...input, name: event.target.value })
              }
              required
            />
          </label>
        </div>
      </section>
      <section className="form-section">
        <h3>규모와 보존 한도</h3>
        <p>빈 값은 무제한을 의미합니다. 보존 기간은 반드시 입력해야 합니다.</p>
        <div className="form-grid form-grid-three">
          <NumberField
            label="최대 워크스페이스"
            value={input.maxWorkspaces}
            onChange={(value) => updateNullableNumber("maxWorkspaces", value)}
          />
          <NumberField
            label="최대 멤버"
            value={input.maxMembers}
            onChange={(value) => updateNullableNumber("maxMembers", value)}
          />
          <NumberField
            label="보존 기간(일)"
            value={input.retentionDays}
            required
            onChange={(value) =>
              setInput({ ...input, retentionDays: Number(value) })
            }
          />
          <NumberField
            label="월간 이벤트 한도"
            value={input.monthlyEventLimit}
            onChange={(value) =>
              updateNullableNumber("monthlyEventLimit", value)
            }
          />
          <NumberField
            label="기본 포함 로그"
            value={input.includedLogCount}
            allowZero
            onChange={(value) =>
              updateNullableNumber("includedLogCount", value)
            }
          />
          <NumberField
            label="로그 초과 단가(USD)"
            value={input.logOverageUnitPrice}
            allowZero
            step="0.000001"
            onChange={(value) =>
              updateNullableNumber("logOverageUnitPrice", value)
            }
          />
        </div>
      </section>
      <section className="form-section">
        <h3>기능 플래그</h3>
        <p>
          특정 고객만 사용할 기능을 JSON으로 지정합니다. 예: advancedDebug, sso,
          customRetention
        </p>
        <textarea
          className="code-input"
          rows={8}
          spellCheck={false}
          value={featuresText}
          onChange={(event) => setFeaturesText(event.target.value)}
        />
      </section>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={input.isActive}
          onChange={(event) =>
            setInput({ ...input, isActive: event.target.checked })
          }
        />
        <span>
          <strong>신규 조직에 할당 가능</strong>
          <small>
            비활성화해도 이미 이 요금제를 쓰는 조직에는 계속 적용됩니다.
          </small>
        </span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-footer">
        <button className="button button-primary" disabled={isSaving}>
          {isSaving ? "저장 중…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  value,
  required = false,
  allowZero = false,
  step = "1",
  onChange,
}: {
  label: string;
  value: number | null;
  required?: boolean;
  allowZero?: boolean;
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={allowZero ? 0 : 1}
        step={step}
        value={value ?? ""}
        required={required}
        placeholder={required ? undefined : "무제한"}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function toInput(plan: AdminPlan): PlanInput {
  return {
    code: plan.code,
    name: plan.name,
    maxWorkspaces: plan.maxWorkspaces,
    maxMembers: plan.maxMembers,
    retentionDays: plan.retentionDays,
    monthlyEventLimit: plan.monthlyEventLimit,
    includedLogCount: plan.includedLogCount,
    logOverageUnitPrice: plan.logOverageUnitPrice,
    features: plan.features,
    isActive: plan.isActive,
  };
}
