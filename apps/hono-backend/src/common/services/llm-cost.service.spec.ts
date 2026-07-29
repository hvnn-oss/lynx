import { LlmCostService, MODEL_PRICING_VERSION } from "./llm-cost.service.js";

describe("LlmCostService", () => {
  const service = new LlmCostService();

  it.each([
    ["openai", "gpt-4.1-mini", 1_000_000, 1_000_000, 2],
    ["anthropic", "claude-sonnet-4-20250514", 1_000_000, 1_000_000, 18],
    ["gemini", "gemini-2.5-flash", 1_000_000, 1_000_000, 2.8],
  ])(
    "%s %s의 공식 Standard 비용을 계산한다",
    (provider, model, promptTokens, completionTokens, expectedCost) => {
      expect(
        service.enrichPayload("LLM_CALL", {
          phase: "end",
          provider,
          model,
          usage: { promptTokens, completionTokens },
        }),
      ).toEqual(
        expect.objectContaining({
          cost: expectedCost,
          costSource: "SERVER_ESTIMATED",
          pricingVersion: MODEL_PRICING_VERSION,
        }),
      );
    },
  );

  it("클라이언트가 전달한 비용을 서버 추정보다 우선한다", () => {
    expect(
      service.enrichPayload("LLM_CALL", {
        phase: "end",
        provider: "openai",
        model: "gpt-4.1-mini",
        usage: { promptTokens: 100, completionTokens: 100 },
        cost: 0.25,
        costSource: "PROVIDER_REPORTED",
      }),
    ).toEqual(
      expect.objectContaining({
        cost: 0.25,
        costSource: "PROVIDER_REPORTED",
      }),
    );
  });

  it("가격을 모르는 모델은 0이 아니라 미산정으로 표시한다", () => {
    const result = service.enrichPayload("LLM_CALL", {
      phase: "end",
      provider: "custom",
      model: "private-model",
      usage: { promptTokens: 100, completionTokens: 100 },
    });

    expect(result.cost).toBeUndefined();
    expect(result.costSource).toBe("UNPRICED");
  });

  it("LLM 시작 이벤트에는 비용을 중복 계산하지 않는다", () => {
    const payload = {
      phase: "start",
      provider: "openai",
      model: "gpt-4.1-mini",
      usage: { promptTokens: 100, completionTokens: 100 },
    };

    expect(service.enrichPayload("LLM_CALL", payload)).toBe(payload);
  });
});
