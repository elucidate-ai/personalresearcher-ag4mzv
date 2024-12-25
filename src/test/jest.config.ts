import type { Config } from '@jest/types';

/**
 * Jest configuration for the knowledge curation system test environment.
 * Provides comprehensive test setup including unit, integration, and e2e testing
 * with proper coverage requirements and CI/CD integration.
 * 
 * @version Jest 29.7.0
 * @returns {Config.InitialOptions} Complete Jest configuration
 */
export default async (): Promise<Config.InitialOptions> => {
  const config: Config.InitialOptions = {
    // Specify Node.js test environment for server-side testing
    testEnvironment: 'node',

    // Use ts-jest preset for TypeScript support
    preset: 'ts-jest',

    // Define root directory for tests
    roots: ['<rootDir>/src'],

    // Configure module name mapping for path aliases
    moduleNameMapper: {
      '@test/(.*)': '<rootDir>/utils/$1',
      '@utils/(.*)': '<rootDir>/utils/$1',
      '@mocks/(.*)': '<rootDir>/mocks/$1',
      '@fixtures/(.*)': '<rootDir>/fixtures/$1',
    },

    // Setup files to run after environment is setup
    setupFilesAfterEnv: [
      '@testing-library/jest-dom'
    ],

    // Configure coverage collection
    collectCoverageFrom: [
      '**/*.{ts,tsx}',
      // Exclude unnecessary directories
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/coverage/**',
      '!**/*.d.ts',
      '!**/index.ts',
      '!**/*.stories.{ts,tsx}',
      '!**/*.mock.{ts,tsx}',
    ],

    // Set coverage thresholds to ensure comprehensive test coverage
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },

    // Configure test matching patterns
    testMatch: [
      // Unit tests
      '**/__tests__/**/*.test.ts?(x)',
      // Integration tests
      '**/integration/**/*.test.ts?(x)',
      // End-to-end tests
      '**/e2e/**/*.test.ts?(x)',
    ],

    // Set test timeout for CI/CD compatibility
    testTimeout: 10000,

    // Enable verbose output for detailed test results
    verbose: true,

    // Clear mocks between tests
    clearMocks: true,

    // Additional settings for robust testing
    errorOnDeprecated: true,
    maxWorkers: '50%',
    testPathIgnorePatterns: [
      '/node_modules/',
      '/dist/',
    ],
    
    // Transform settings for TypeScript
    transform: {
      '^.+\\.tsx?$': [
        'ts-jest',
        {
          tsconfig: '<rootDir>/tsconfig.json',
        },
      ],
    },

    // Coverage reporting configuration
    coverageReporters: [
      'text',
      'lcov',
      'json-summary',
    ],

    // Global settings for tests
    globals: {
      'ts-jest': {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: true,
      },
    },

    // Automatically restore mocks between tests
    restoreMocks: true,

    // Detect open handles for proper test cleanup
    detectOpenHandles: true,

    // Force exit after test completion in CI environments
    forceExit: process.env.CI === 'true',
  };

  return config;
};