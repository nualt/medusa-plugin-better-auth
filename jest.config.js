module.exports = {
  transform: {
    "^.+\\.[jt]sx?$": [
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
    "/node_modules/\\.pnpm/(?!(better-auth@|@better-auth\\+|@better-fetch\\+|better-call@|nanostores@|jose@|kysely@|@noble\\+))",
  ],
}
