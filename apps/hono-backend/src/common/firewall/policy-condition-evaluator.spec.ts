import { PolicyConditionEvaluator } from "./policy-condition-evaluator.js";

describe("PolicyConditionEvaluator", () => {
  const evaluator = new PolicyConditionEvaluator();

  it("NOT, AND, OR와 괄호 우선순위를 평가한다", () => {
    const matched = evaluator.matches(
      "NOT tool.name == 'read' AND (tool.riskLevel == 'HIGH' OR input.force == true)",
      {
        tool: { name: "delete", riskLevel: "LOW" },
        input: { force: true },
      },
    );

    expect(matched).toBe(true);
  });

  it("Run 상태 기반 횟수·비용·시간·루프 조건을 평가한다", () => {
    const matched = evaluator.matches(
      "state.callCount >= 3 AND state.totalCost > 1 AND state.elapsedMs >= 1000 AND state.loopCount >= 5",
      {
        tool: { name: "expensive-tool" },
        state: {
          callCount: 3,
          totalCost: 1.5,
          elapsedMs: 2_000,
          loopCount: 5,
        },
      },
    );

    expect(matched).toBe(true);
  });

  it("균형이 맞지 않는 조건 그룹은 거절한다", () => {
    expect(() =>
      evaluator.matches("(tool.name == 'delete'", {
        tool: { name: "delete" },
      }),
    ).toThrow(/grouping|parentheses/);
  });
  it("조건별 일치 결과를 시뮬레이션 추적으로 반환한다", () => {
    const result = evaluator.evaluate(
      "tool.riskLevel == 'CRITICAL' AND input.amount > 1000",
      {
        tool: { name: "transfer", riskLevel: "CRITICAL" },
        input: { amount: 500 },
      },
    );

    expect(result.matched).toBe(false);
    expect(result.conditions).toEqual([
      expect.objectContaining({
        field: "tool.riskLevel",
        matched: true,
      }),
      expect.objectContaining({
        field: "input.amount",
        actual: 500,
        matched: false,
      }),
    ]);
  });

  it("문자열 입력을 input.value 별칭으로 평가한다", () => {
    expect(
      evaluator.matches("input.value contains '안녕'", {
        tool: { name: "llm.input" },
        input: "안녕하세요",
      }),
    ).toBe(true);
  });

  it("모델 응답의 output.value 포함 조건을 평가한다", () => {
    const result = evaluator.evaluate("output.value contains '차단'", {
      tool: { name: "llm.output" },
      output: "이 답변은 차단 대상입니다.",
    });

    expect(result.matched).toBe(true);
    expect(result.conditions[0]).toEqual(
      expect.objectContaining({
        field: "output.value",
        actual: "이 답변은 차단 대상입니다.",
        matched: true,
      }),
    );
  });
});
