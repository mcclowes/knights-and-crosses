/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.test.ts',
  ],
  // ESM support
  transform: {},
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Allow .js extension in imports
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Coverage is scoped to the server modules that are unit-testable and carry
  // the production-critical logic (matchmaking, storage, validation, config).
  // The legacy canvas/game engine, AI trainer, and client bundle are exercised
  // via integration/manual play, not Jest, and would otherwise mask regressions
  // in the tested surface.
  collectCoverageFrom: [
    'src/server/**/*.js',
    '!src/server/**/*.test.js',
  ],
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 60,
      lines: 65,
      statements: 65,
    },
  },
  verbose: true,
  testTimeout: 10000,
};

export default config;
