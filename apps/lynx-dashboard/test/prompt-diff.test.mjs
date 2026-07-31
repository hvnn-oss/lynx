import assert from "node:assert/strict";
import test from "node:test";

import { importTypeScriptModule } from "./import-typescript.mjs";

test("split diff pairs replaced lines and keeps unchanged lines neutral", async () => {
  const diff = await importTypeScriptModule("../lib/prompt-diff.ts");
  const rows = diff.buildPromptSplitDiffRows([
    line("UNCHANGED", "system", 1, 1),
    line("REMOVED", "answer briefly", 2, null),
    line("ADDED", "answer with evidence", null, 2),
    line("UNCHANGED", "return json", 3, 3),
  ]);

  assert.deepEqual(rows, [
    {
      before: side("UNCHANGED", "system", 1),
      after: side("UNCHANGED", "system", 1),
    },
    {
      before: side("REMOVED", "answer briefly", 2),
      after: side("ADDED", "answer with evidence", 2),
    },
    {
      before: side("UNCHANGED", "return json", 3),
      after: side("UNCHANGED", "return json", 3),
    },
  ]);
});

test("split diff leaves an empty cell for a one-sided insertion", async () => {
  const diff = await importTypeScriptModule("../lib/prompt-diff.ts");
  const changes = [
    line("UNCHANGED", "system", 1, 1),
    line("ADDED", "cite evidence", null, 2),
    line("UNCHANGED", "answer", 2, 3),
  ];

  assert.deepEqual(diff.buildPromptSplitDiffRows(changes)[1], {
    before: null,
    after: side("ADDED", "cite evidence", 2),
  });
  assert.deepEqual(diff.countPromptDiffLines(changes), {
    before: 2,
    after: 3,
  });
});

function line(type, content, oldLineNumber, newLineNumber) {
  return {
    type,
    line: content,
    oldLineNumber,
    newLineNumber,
  };
}

function side(type, content, lineNumber) {
  return {
    type,
    line: content,
    lineNumber,
  };
}
