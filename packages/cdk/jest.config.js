export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  preset: 'ts-jest/presets/default-esm',
  moduleNameMapper: {
    '^@health-command-center/types$': '<rootDir>/../packages/types/src'
  }
};
