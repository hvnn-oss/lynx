export interface PromptLineChange {
  type: "UNCHANGED" | "ADDED" | "REMOVED";
  line: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

const MAX_DIFF_LINES = 2_000;

/** 두 프롬프트를 줄 단위 LCS로 비교해 안정적인 diff를 만듭니다. */
export function createPromptLineDiff(
  oldContent: string,
  newContent: string,
): PromptLineChange[] {
  const oldLines = splitPromptLines(oldContent);
  const newLines = splitPromptLines(newContent);
  if (oldLines.length > MAX_DIFF_LINES || newLines.length > MAX_DIFF_LINES) {
    throw new Error("PROMPT_DIFF_TOO_LARGE");
  }

  const columns = newLines.length + 1;
  const table = Array.from(
    { length: oldLines.length + 1 },
    () => new Uint32Array(columns),
  );
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      table[oldIndex]![newIndex] =
        oldLines[oldIndex] === newLines[newIndex]
          ? table[oldIndex + 1]![newIndex + 1]! + 1
          : Math.max(
              table[oldIndex + 1]![newIndex]!,
              table[oldIndex]![newIndex + 1]!,
            );
    }
  }

  const changes: PromptLineChange[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      changes.push({
        type: "UNCHANGED",
        line: oldLines[oldIndex]!,
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
      });
      oldIndex += 1;
      newIndex += 1;
    } else if (
      table[oldIndex + 1]![newIndex]! >= table[oldIndex]![newIndex + 1]!
    ) {
      changes.push({
        type: "REMOVED",
        line: oldLines[oldIndex]!,
        oldLineNumber: oldIndex + 1,
        newLineNumber: null,
      });
      oldIndex += 1;
    } else {
      changes.push({
        type: "ADDED",
        line: newLines[newIndex]!,
        oldLineNumber: null,
        newLineNumber: newIndex + 1,
      });
      newIndex += 1;
    }
  }
  while (oldIndex < oldLines.length) {
    changes.push({
      type: "REMOVED",
      line: oldLines[oldIndex]!,
      oldLineNumber: oldIndex + 1,
      newLineNumber: null,
    });
    oldIndex += 1;
  }
  while (newIndex < newLines.length) {
    changes.push({
      type: "ADDED",
      line: newLines[newIndex]!,
      oldLineNumber: null,
      newLineNumber: newIndex + 1,
    });
    newIndex += 1;
  }
  return changes;
}

/** 운영체제별 줄바꿈 차이만으로 전체 본문이 변경 처리되지 않게 정규화합니다. */
function splitPromptLines(content: string): string[] {
  return content.replace(/\r\n?/g, "\n").split("\n");
}
