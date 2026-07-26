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
});
