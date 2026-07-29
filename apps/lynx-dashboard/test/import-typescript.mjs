import { readFile } from "node:fs/promises";
import ts from "typescript";

let moduleSequence = 0;

/**
 * Transpiles an import-free TypeScript frontend utility and loads it as ESM.
 * This keeps dashboard unit tests dependency-free and compatible with Node 18.
 */
export async function importTypeScriptModule(relativePath) {
  const sourceUrl = new URL(relativePath, import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourceUrl.pathname,
  }).outputText;
  const encoded = Buffer.from(output).toString("base64");
  moduleSequence += 1;
  return import(`data:text/javascript;base64,${encoded}#${moduleSequence}`);
}
