module.exports = {
  transform: {
    // Match .js, .ts AND .mjs/.mts so that ESM-only packages (better-auth,
    // kysely, jose, …) can be transpiled to CJS by SWC when Jest loads them.
    // SWC converts dynamic import() to Promise.resolve().then(() => require()),
    // which works because better-auth is in the transformIgnorePatterns exception
    // list — Jest intercepts the require() and SWC-transpiles the ESM to CJS.
    "^.+\\.[cm]?[jt]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true, decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "tsx", "json"],
  testMatch: ["**/src/**/__tests__/**/*.spec.[jt]s"],
  modulePathIgnorePatterns: ["<rootDir>/.medusa/"],
  transformIgnorePatterns: [
    "/node_modules/\\.pnpm/(?!(better-auth@|@better-auth\\+|@better-fetch\\+|better-call@|nanostores@|jose@|kysely@|@noble\\+|rou3@))",
  ],
}
