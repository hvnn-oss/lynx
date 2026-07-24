/** @type {import("jest").Config} */
module.exports = {
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.spec.ts",
    "!src/index.ts",
  ],
  coverageDirectory: "coverage",
  moduleNameMapper: {
    "^@repo/(constants|contract|database|dto)$":
      "<rootDir>/../../packages/$1/src/index.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  rootDir: ".",
  setupFiles: ["<rootDir>/test/jest.setup.cjs"],
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        diagnostics: true,
        tsconfig: {
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          experimentalDecorators: true,
          isolatedModules: true,
          module: "CommonJS",
          moduleResolution: "Node",
          target: "ESNext",
          types: ["node", "jest"],
          verbatimModuleSyntax: false,
        },
        useESM: false,
      },
    ],
  },
};
