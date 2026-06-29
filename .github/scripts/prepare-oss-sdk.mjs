import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, join, sep } from "node:path";

const sdkRepoPath = process.env.SDK_REPO_PATH ?? "sdk-repo";
const sdkTypesPath =
  process.env.SDK_TYPES_PATH ?? "packages/sdk-types/src/index.ts";
const previousVersion = process.env.PREVIOUS_VERSION;
const versionBump = process.env.VERSION_BUMP ?? "patch";

const publicPackageName = "@lynxops/sdk";
const packageJsonPath = join(sdkRepoPath, "package.json");
const tsconfigPath = join(sdkRepoPath, "tsconfig.json");
const rootTypesPath = join(sdkRepoPath, "src", "types.ts");
const coreTypesPath = join(sdkRepoPath, "src", "core", "types.ts");
const indexPath = join(sdkRepoPath, "src", "index.ts");

const packageJson = readJson(packageJsonPath);
const nextVersion =
  versionBump === "none"
    ? packageJson.version
    : bumpVersion(previousVersion ?? packageJson.version, versionBump);

packageJson.name = publicPackageName;
packageJson.version = nextVersion;
packageJson.description =
  "TypeScript SDK for tracing, debugging, and governing AI agent runs with Lynx.";
packageJson.license = packageJson.license || "ISC";
packageJson.author = packageJson.author || "Lynx";
packageJson.keywords = [
  "ai",
  "agent",
  "observability",
  "tracing",
  "debugging",
  "guardrails",
  "lynx",
];
packageJson.repository = {
  type: "git",
  url: "git+https://github.com/hvnn-oss/lynx-sdk.git",
};
packageJson.bugs = {
  url: "https://github.com/hvnn-oss/lynx-sdk/issues",
};
packageJson.homepage = "https://github.com/hvnn-oss/lynx-sdk#readme";

packageJson.dependencies = removeInternalPackages(packageJson.dependencies);
packageJson.devDependencies = {
  ...removeInternalPackages(packageJson.devDependencies),
  "@types/node": packageJson.devDependencies?.["@types/node"] ?? "^25.9.1",
  "javascript-obfuscator":
    packageJson.devDependencies?.["javascript-obfuscator"] ?? "^4.1.1",
  tsup: packageJson.devDependencies?.tsup ?? "^8.3.5",
  typescript: packageJson.devDependencies?.typescript ?? "^5.9.2",
};

writeJson(packageJsonPath, packageJson);
writeJson(tsconfigPath, {
  compilerOptions: {
    module: "NodeNext",
    moduleResolution: "NodeNext",
    target: "ES2022",
    outDir: "./dist",
    rootDir: "./src",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    types: ["node"],
  },
  include: ["src/**/*"],
  exclude: ["node_modules", "dist"],
});

const sdkTypesSource = readFileSync(sdkTypesPath, "utf8");
writeFileSync(
  rootTypesPath,
  `// Generated from packages/sdk-types during OSS sync.\n${sdkTypesSource}`,
);
writeFileSync(coreTypesPath, `export * from "../types.js";\n`);

replaceSdkTypeImportsRecursively(join(sdkRepoPath, "src"));
replaceInFile(indexPath, [[/@repo\/sdk/g, publicPackageName]]);
replaceTextRecursively(join(sdkRepoPath, "src"), [[/@repo\/sdk/g, publicPackageName]]);
replaceTextRecursively(sdkRepoPath, [[/@repo\/sdk/g, publicPackageName]], [
  ".git",
  "node_modules",
  "dist",
  ".turbo",
]);

rmSync(join(sdkRepoPath, "packages"), { recursive: true, force: true });

writeFileSync(
  join(sdkRepoPath, ".gitignore"),
  ["node_modules", "dist", ".turbo", "*.log", ".env", ".env.*", ""].join("\n"),
);
writeFileSync(join(sdkRepoPath, "pnpm-workspace.yaml"), "packages:\n  - .\n");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(`${path}`, `${JSON.stringify(value, null, 2)}\n`);
}

function removeInternalPackages(dependencies) {
  const nextDependencies = { ...(dependencies ?? {}) };

  for (const name of Object.keys(nextDependencies)) {
    if (name.startsWith("@repo/")) {
      delete nextDependencies[name];
    }
  }

  return nextDependencies;
}

function bumpVersion(version, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(version);

  if (!match) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (bump === "major") {
    return `${major + 1}.0.0`;
  }

  if (bump === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  if (bump === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }

  throw new Error(`Unsupported version bump: ${bump}`);
}

function replaceInFile(path, replacements) {
  if (!existsSync(path)) {
    return;
  }

  let content = readFileSync(path, "utf8");
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  writeFileSync(path, content);
}

function replaceTextRecursively(path, replacements, ignoredNames = []) {
  if (!existsSync(path)) {
    return;
  }

  for (const entry of readdirSync(path)) {
    if (ignoredNames.includes(entry)) {
      continue;
    }

    const entryPath = join(path, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      replaceTextRecursively(entryPath, replacements, ignoredNames);
      continue;
    }

    if (!/\.(ts|tsx|js|mjs|json|md)$/.test(entry)) {
      continue;
    }

    replaceInFile(entryPath, replacements);
  }
}

function replaceSdkTypeImportsRecursively(path) {
  if (!existsSync(path)) {
    return;
  }

  for (const entry of readdirSync(path)) {
    const entryPath = join(path, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      replaceSdkTypeImportsRecursively(entryPath);
      continue;
    }

    if (!/\.(ts|tsx|js|mjs)$/.test(entry)) {
      continue;
    }

    const importPath = toRelativeImportPath(dirname(entryPath), rootTypesPath);
    replaceInFile(entryPath, [[/@repo\/sdk-types/g, importPath]]);
  }
}

function toRelativeImportPath(fromDirectory, toFile) {
  const relativePath = relative(fromDirectory, toFile)
    .split(sep)
    .join("/")
    .replace(/\.ts$/, ".js");

  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}
