export interface PromptDiffChange {
  type: "UNCHANGED" | "ADDED" | "REMOVED";
  line: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface PromptDiffSide {
  type: PromptDiffChange["type"];
  line: string;
  lineNumber: number;
}

export interface PromptSplitDiffRow {
  before: PromptDiffSide | null;
  after: PromptDiffSide | null;
}

/**
 * 서버의 순차 diff를 좌우가 같은 높이로 정렬된 행으로 변환합니다.
 *
 * 같은 변경 구간에 삭제와 추가가 모두 있으면 한 행에 짝지어 수정처럼
 * 보여주고, 한쪽에만 있는 줄은 반대쪽을 빈 셀로 유지합니다.
 */
export function buildPromptSplitDiffRows(
  changes: readonly PromptDiffChange[],
): PromptSplitDiffRow[] {
  const rows: PromptSplitDiffRow[] = [];
  let index = 0;

  while (index < changes.length) {
    const change = changes[index]!;
    if (change.type === "UNCHANGED") {
      rows.push({
        before: toBeforeSide(change),
        after: toAfterSide(change),
      });
      index += 1;
      continue;
    }

    const removed: PromptDiffSide[] = [];
    const added: PromptDiffSide[] = [];
    while (
      index < changes.length &&
      changes[index]!.type !== "UNCHANGED"
    ) {
      const changedLine = changes[index]!;
      if (changedLine.type === "REMOVED") {
        const before = toBeforeSide(changedLine);
        if (before) removed.push(before);
      } else {
        const after = toAfterSide(changedLine);
        if (after) added.push(after);
      }
      index += 1;
    }

    const changedRowCount = Math.max(removed.length, added.length);
    for (let rowIndex = 0; rowIndex < changedRowCount; rowIndex += 1) {
      rows.push({
        before: removed[rowIndex] ?? null,
        after: added[rowIndex] ?? null,
      });
    }
  }

  return rows;
}

/** diff 결과에서 이전·최신 버전의 실제 줄 수를 계산합니다. */
export function countPromptDiffLines(
  changes: readonly PromptDiffChange[],
): { before: number; after: number } {
  return {
    before: changes.reduce(
      (count, change) => count + (change.oldLineNumber === null ? 0 : 1),
      0,
    ),
    after: changes.reduce(
      (count, change) => count + (change.newLineNumber === null ? 0 : 1),
      0,
    ),
  };
}

function toBeforeSide(change: PromptDiffChange): PromptDiffSide | null {
  if (change.oldLineNumber === null) return null;
  return {
    type: change.type,
    line: change.line,
    lineNumber: change.oldLineNumber,
  };
}

function toAfterSide(change: PromptDiffChange): PromptDiffSide | null {
  if (change.newLineNumber === null) return null;
  return {
    type: change.type,
    line: change.line,
    lineNumber: change.newLineNumber,
  };
}
