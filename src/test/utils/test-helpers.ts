/**
 * Test Utility Functions and Setup Helpers
 * Version: 1.0.0
 * 
 * Provides comprehensive test environment setup, monitoring, and validation utilities
 * for the knowledge aggregation system test suites.
 */

// External imports with versions
import { jest } from '@jest/globals'; // v29.x
import dotenv from 'dotenv'; // v16.x
import { DockerComposeEnvironment } from 'docker-compose'; // v0.24.x
import winston from 'winston'; // v3.x
import { Registry, Counter, Histogram } from 'prom-client'; // v14.x

// Internal imports
import { MockFactory, createContent, createGraph, validateQuality } from './mock-factory';

// Constants for test configuration
const TEST_ENV = 'test';
const DEFAULT_TIMEOUT = 30000;
const DOCKER_COMPOSE_FILE = 'src/test/docker-compose.test.yml';
const MIN_QUALITY_THRESHOLD = 0.9;
const MAX_PROCESSING_TIME = 5000;
const MIN_GRAPH_CONNECTIONS = 10;

// Metrics registry for test monitoring
const metricsRegistry = new Registry();
const testDuration = new Histogram({
    name: 'test_execution_duration_seconds',
    help: 'Test execution duration in seconds',
    labelNames: ['test_suite', 'test_case']
});
const testErrors = new Counter({
    name: 'test_errors_total',
    help: 'Total number of test errors',
    labelNames: ['test_suite', 'error_type']
});

metricsRegistry.registerMetric(testDuration);
metricsRegistry.registerMetric(testErrors);

// Configure test logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'test-helpers' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * Performance monitoring decorator for test functions
 */
function performanceMonitor(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
        const start = Date.now();
        const testSuite = this.constructor.name;

        try {
            const result = await originalMethod.apply(this, args);
            const duration = (Date.now() - start) / 1000;

            testDuration.labels(testSuite, propertyKey).observe(duration);

            if (duration > MAX_PROCESSING_TIME / 1000) {
                logger.warn(`Test execution exceeded time threshold`, {
                    test_suite: testSuite,
                    test_case: propertyKey,
                    duration
                });
            }

            return result;
        } catch (error) {
            testErrors.labels(testSuite, error.name).inc();
            throw error;
        }
    };

    return descriptor;
}

/**
 * Security validation decorator for test environment setup
 */
function securityValidation(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
        // Validate security configuration
        const securityConfig = args.find(arg => arg?.securityConfig);
        if (securityConfig) {
            validateSecurityConfig(securityConfig);
        }

        return await originalMethod.apply(this, args);
    };

    return descriptor;
}

/**
 * Sets up the test environment with comprehensive validation and monitoring
 */
export async function setupTestEnvironment(
    options: {
        preserveState?: boolean;
        mockData?: boolean;
        timeoutMs?: number;
    } = {},
    enableMetrics: boolean = true,
    securityConfig?: any
): Promise<void> {
    const startTime = Date.now();

    try {
        // Load test environment variables
        dotenv.config({ path: '.env.test' });

        // Initialize metrics if enabled
        if (enableMetrics) {
            metricsRegistry.clear();
            metricsRegistry.registerMetric(testDuration);
            metricsRegistry.registerMetric(testErrors);
        }

        // Start test containers
        const dockerEnv = new DockerComposeEnvironment(
            '.',
            DOCKER_COMPOSE_FILE
        );
        await dockerEnv.up();

        // Initialize mock factory with quality validation
        const mockFactory = new MockFactory({
            qualityThreshold: MIN_QUALITY_THRESHOLD,
            validateSchema: true,
            monitorPerformance: true
        });

        // Setup initial test data if needed
        if (options.mockData) {
            await mockFactory.createMockData('content', { count: 10 });
            await mockFactory.createMockData('graph', { count: 5 });
            await mockFactory.createMockData('vector', { count: 20 });
        }

        logger.info('Test environment setup completed', {
            duration: Date.now() - startTime,
            options
        });

    } catch (error) {
        logger.error('Test environment setup failed', {
            error: error.message,
            duration: Date.now() - startTime
        });
        throw error;
    }
}

/**
 * Comprehensive cleanup of test environment and resources
 */
export async function teardownTestEnvironment(
    preserveLogs: boolean = false,
    cleanupConfig: any = {}
): Promise<void> {
    try {
        // Export test metrics if enabled
        const metrics = await metricsRegistry.getMetricsAsJSON();
        if (preserveLogs) {
            logger.info('Test metrics', { metrics });
        }

        // Stop and remove test containers
        const dockerEnv = new DockerComposeEnvironment(
            '.',
            DOCKER_COMPOSE_FILE
        );
        await dockerEnv.down();

        // Clear mock data
        const mockFactory = new MockFactory();
        await mockFactory.clearMockData();

        // Archive logs if requested
        if (preserveLogs) {
            // Archive implementation
        }

        logger.info('Test environment cleanup completed');

    } catch (error) {
        logger.error('Test environment cleanup failed', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Validates security configuration for test environment
 */
function validateSecurityConfig(config: any): void {
    const requiredFields = ['authToken', 'apiKey', 'encryptionKey'];
    const missingFields = requiredFields.filter(field => !config[field]);

    if (missingFields.length > 0) {
        throw new Error(`Missing required security fields: ${missingFields.join(', ')}`);
    }

    // Validate token format
    if (!/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(config.authToken)) {
        throw new Error('Invalid JWT token format');
    }

    // Validate API key format
    if (!/^[A-Za-z0-9]{32,}$/.test(config.apiKey)) {
        throw new Error('Invalid API key format');
    }

    // Validate encryption key length
    if (config.encryptionKey.length < 32) {
        throw new Error('Encryption key must be at least 32 characters');
    }
}

// Export utility functions and types
export {
    performanceMonitor,
    securityValidation,
    logger,
    metricsRegistry,
    TEST_ENV,
    DEFAULT_TIMEOUT,
    MIN_QUALITY_THRESHOLD,
    MAX_PROCESSING_TIME,
    MIN_GRAPH_CONNECTIONS
};