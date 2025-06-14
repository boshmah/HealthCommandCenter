/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/packages'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }],
  },
  moduleNameMapper: {
    '^@health-command-center/types$': '<rootDir>/packages/types/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    'packages/**/lib/**/*.ts',
    '!packages/**/lib/layers/**',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/cdk.out/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/cdk.out/'],
  clearMocks: true,
  restoreMocks: true,
  // Force CommonJS for tests to avoid ESM issues
  testEnvironmentOptions: {
    customExportConditions: ['node', 'require']
  }
};
