import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const CAMEL_CASE_PARTIAL_QUOTING =
  /\b[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*\."([A-Za-z_][A-Za-z0-9_]*)"/g;
const RESERVED_ALIAS_PARTIAL_QUOTING =
  /\b(user|grant|order|group|limit|offset|select|where|from|table|authorization)\."([A-Za-z_][A-Za-z0-9_]*)"/g;

describe("TypeORM SQL 별칭 안전성", () => {
  it('camelCase 또는 SQL 예약어 별칭에 alias."column" 부분 인용을 사용하지 않는다', () => {
    const sourceRoot = resolveSourceRoot();
    const findings = listTypeScriptSources(sourceRoot).flatMap((filePath) => {
      if (filePath.endsWith(".spec.ts")) return [];
      const source = readFileSync(filePath, "utf8");
      return [
        ...findUnsafeMatches(
          sourceRoot,
          filePath,
          source,
          CAMEL_CASE_PARTIAL_QUOTING,
        ),
        ...findUnsafeMatches(
          sourceRoot,
          filePath,
          source,
          RESERVED_ALIAS_PARTIAL_QUOTING,
        ),
      ];
    });

    expect(findings).toEqual([]);
  });
});

/** Jest 실행 위치와 관계없이 Hono Backend의 src 디렉터리를 찾습니다. */
function resolveSourceRoot(): string {
  const packageSourceRoot = join(process.cwd(), "src");
  if (existsSync(packageSourceRoot)) return packageSourceRoot;
  return join(process.cwd(), "apps", "hono-backend", "src");
}

/** 하위 디렉터리를 순회하며 TypeScript 소스 파일을 반환합니다. */
function listTypeScriptSources(directoryPath: string): string[] {
  return readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) return listTypeScriptSources(entryPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
  });
}

/** 위험한 SQL 부분 인용을 파일과 줄 번호가 포함된 메시지로 변환합니다. */
function findUnsafeMatches(
  sourceRoot: string,
  filePath: string,
  source: string,
  pattern: RegExp,
): string[] {
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].map((match) => {
    const lineNumber = source.slice(0, match.index).split("\n").length;
    return `${relative(sourceRoot, filePath)}:${lineNumber}: ${match[0]}`;
  });
}
