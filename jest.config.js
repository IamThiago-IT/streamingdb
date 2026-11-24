const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // SQLite isolado e sequencial: evita locks entre suítes.
  maxWorkers: 1,
  clearMocks: true,
};

module.exports = createJestConfig(config);
