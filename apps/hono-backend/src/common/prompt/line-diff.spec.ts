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

  it("keeps surrounding lines aligned around inserted content", () => {
    expect(
      createPromptLineDiff(
        "system\nanswer briefly\nreturn json",
        "system\ncite evidence\nanswer briefly\nreturn json",
      ),
    ).toEqual([
      {
        type: "UNCHANGED",
        line: "system",
        oldLineNumber: 1,
        newLineNumber: 1,
      },
      {
        type: "ADDED",
        line: "cite evidence",
        oldLineNumber: null,
        newLineNumber: 2,
      },
      {
        type: "UNCHANGED",
        line: "answer briefly",
        oldLineNumber: 2,
        newLineNumber: 3,
      },
      {
        type: "UNCHANGED",
        line: "return json",
        oldLineNumber: 3,
        newLineNumber: 4,
      },
    ]);
  });

  it("does not treat CRLF and LF as content changes", () => {
    expect(createPromptLineDiff("system\r\nanswer", "system\nanswer")).toEqual([
      {
        type: "UNCHANGED",
        line: "system",
        oldLineNumber: 1,
        newLineNumber: 1,
      },
      {
        type: "UNCHANGED",
        line: "answer",
        oldLineNumber: 2,
        newLineNumber: 2,
      },
    ]);
  });
});
