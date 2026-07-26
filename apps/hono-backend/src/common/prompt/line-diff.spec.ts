import { createPromptLineDiff } from "./line-diff.js";

describe("createPromptLineDiff", () => {
  it("returns stable line additions and removals", () => {
    expect(createPromptLineDiff("alpha\nbeta", "alpha\ngamma")).toEqual([
      {
        type: "UNCHANGED",
        line: "alpha",
        oldLineNumber: 1,
        newLineNumber: 1,
      },
      {
        type: "REMOVED",
        line: "beta",
        oldLineNumber: 2,
        newLineNumber: null,
      },
      {
        type: "ADDED",
        line: "gamma",
        oldLineNumber: null,
        newLineNumber: 2,
      },
    ]);
  });
});
