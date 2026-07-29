const TOKENS_PER_MILLION = 1_000_000;
const COST_DECIMAL_PLACES = 12;

export const MODEL_PRICING_VERSION = "standard-text-2026-07-28";

export type LlmCostSource =
  | "PROVIDER_REPORTED"
  | "CLIENT_REPORTED"
  | "CLIENT_ESTIMATED"
  | "SERVER_ESTIMATED"
  | "UNPRICED";

interface ModelPrice {
  provider: "openai" | "anthropic" | "google";
  modelPrefix: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * 공식 Provider의 일반 텍스트 Standard 요금만 포함합니다.
 *
 * Batch, Priority, 캐시, 오디오, 도구 호출처럼 별도 요금이 적용되는 사용량은
 * 클라이언트가 실제 비용을 전달하거나 후속 세부 사용량 지원이 필요합니다.
 */
const MODEL_PRICES: ModelPrice[] = [
  {
    provider: "openai",
    modelPrefix: "gpt-4.1-mini",
    inputPerMillionUsd: 0.4,
    outputPerMillionUsd: 1.6,
  },
  {
    provider: "openai",
    modelPrefix: "gpt-4.1-nano",
    inputPerMillionUsd: 0.1,
    outputPerMillionUsd: 0.4,
  },
  {
    provider: "openai",
    modelPrefix: "gpt-4.1",
    inputPerMillionUsd: 2,
    outputPerMillionUsd: 8,
  },
  {
    provider: "anthropic",
    modelPrefix: "claude-sonnet-4",
    inputPerMillionUsd: 3,
    outputPerMillionUsd: 15,
  },
  {
    provider: "google",
    modelPrefix: "gemini-2.5-flash-lite",
    inputPerMillionUsd: 0.1,
    outputPerMillionUsd: 0.4,
  },
  {
    provider: "google",
    modelPrefix: "gemini-2.5-flash",
    inputPerMillionUsd: 0.3,
    outputPerMillionUsd: 2.5,
  },
];

/** LLM 종료 이벤트에 클라이언트 비용 또는 서버 추정 비용 정보를 부여합니다. */
export class LlmCostService {
  enrichPayload(
    eventType: string,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    if (eventType !== "LLM_CALL" || payload.phase !== "end") return payload;

    const reportedCost = this.readNonnegativeNumber(payload.cost);
    if (reportedCost !== null) {
      return {
        ...payload,
        cost: reportedCost,
        costSource: this.readReportedSource(payload.costSource),
      };
    }

    const usage = this.readUsage(payload.usage);
    const model = this.readText(payload.model);
    const reportedProvider = this.readText(payload.provider);
    const provider = this.normalizeProvider(reportedProvider);
    if (!usage || !model || (reportedProvider && !provider)) {
      return { ...payload, costSource: "UNPRICED" satisfies LlmCostSource };
    }

    const price = this.findPrice(model, provider);
    if (!price) {
      return { ...payload, costSource: "UNPRICED" satisfies LlmCostSource };
    }

    const cost =
      (usage.promptTokens * price.inputPerMillionUsd +
        usage.completionTokens * price.outputPerMillionUsd) /
      TOKENS_PER_MILLION;

    return {
      ...payload,
      cost: this.roundCost(cost),
      costSource: "SERVER_ESTIMATED" satisfies LlmCostSource,
      pricingVersion: MODEL_PRICING_VERSION,
    };
  }

  /** 모델 snapshot 접미사를 허용하되 Provider가 충돌하면 가격을 적용하지 않습니다. */
  private findPrice(
    model: string,
    provider: ModelPrice["provider"] | null,
  ): ModelPrice | null {
    const normalizedModel = model.trim().toLowerCase();
    return (
      MODEL_PRICES.find((price) => {
        const isModelMatch =
          normalizedModel === price.modelPrefix ||
          normalizedModel.startsWith(`${price.modelPrefix}-`);
        return isModelMatch && (!provider || provider === price.provider);
      }) ?? null
    );
  }

  /** SDK와 Provider별 사용량 이름 차이는 수집 계약의 공통 필드로 제한합니다. */
  private readUsage(value: unknown): LlmUsage | null {
    if (!value || typeof value !== "object") return null;
    const usage = value as Record<string, unknown>;
    const promptTokens = this.readNonnegativeNumber(usage.promptTokens);
    const completionTokens = this.readNonnegativeNumber(usage.completionTokens);
    if (promptTokens === null || completionTokens === null) return null;
    return { promptTokens, completionTokens };
  }

  /** 명시적으로 전달된 비용의 출처만 신뢰하고 나머지는 클라이언트 보고로 처리합니다. */
  private readReportedSource(value: unknown): LlmCostSource {
    if (
      value === "PROVIDER_REPORTED" ||
      value === "CLIENT_REPORTED" ||
      value === "CLIENT_ESTIMATED"
    ) {
      return value;
    }
    return "CLIENT_REPORTED";
  }

  /** SDK와 샘플 앱에서 사용하는 Provider 별칭을 가격 카탈로그 이름으로 통일합니다. */
  private normalizeProvider(
    value: string | null,
  ): ModelPrice["provider"] | null {
    const provider = value?.toLowerCase();
    if (provider === "openai") return "openai";
    if (provider === "anthropic") return "anthropic";
    if (provider === "google" || provider === "gemini") return "google";
    return null;
  }

  private readText(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private readNonnegativeNumber(value: unknown): number | null {
    if (
      (typeof value !== "number" && typeof value !== "string") ||
      value === ""
    ) {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  private roundCost(value: number): number {
    const multiplier = 10 ** COST_DECIMAL_PLACES;
    return Math.round(value * multiplier) / multiplier;
  }
}

export const llmCostService = new LlmCostService();
