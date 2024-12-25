// External dependencies with versions
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'; // v29.x
import Redis from 'ioredis'; // ^5.0.0

// Internal imports
import { TestClient } from '../../utils/test-client';
import { setupTestEnvironment } from '../../utils/test-helpers';

// Constants for rate limiting configuration
const TEST_ENDPOINT = '/api/v1/topics';
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds
const MAX_REQUESTS = 1000; // Maximum requests per window
const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: parseInt(process.env.REDIS_TEST_DB || '1')
};

// Test client and Redis instances
let testClient: TestClient;
let redisClient: Redis;

/**
 * Helper function to make multiple requests in parallel
 */
async function makeRequests(count: number, endpoint: string = TEST_ENDPOINT): Promise<any[]> {
    const requests = Array(count).fill(null).map(() => 
        testClient.get(endpoint, {
            headers: {
                'X-Test-IP': '127.0.0.1'
            }
        })
    );
    return Promise.all(requests);
}

describe('API Gateway Rate Limiting Integration Tests', () => {
    beforeAll(async () => {
        // Setup test environment and connections
        await setupTestEnvironment();
        
        // Initialize Redis client
        redisClient = new Redis(REDIS_CONFIG);
        
        // Initialize test client
        testClient = new TestClient({
            baseURL: process.env.TEST_API_URL || 'http://localhost:3000',
            timeout: 5000
        });

        // Clear any existing rate limit data
        await redisClient.flushdb();
    });

    afterAll(async () => {
        // Cleanup connections and data
        await redisClient.flushdb();
        await redisClient.quit();
    });

    beforeEach(async () => {
        // Reset rate limit counters before each test
        await redisClient.flushdb();
    });

    test('should allow requests within rate limit', async () => {
        // Make requests up to 75% of limit to test normal operation
        const requestCount = Math.floor(MAX_REQUESTS * 0.75);
        const responses = await makeRequests(requestCount);

        // Verify all requests succeeded
        responses.forEach(response => {
            expect(response.success).toBe(true);
            expect(response.data).toBeDefined();
            
            // Verify rate limit headers
            const remainingRequests = parseInt(response.headers['x-ratelimit-remaining']);
            expect(remainingRequests).toBeGreaterThan(0);
            expect(response.headers['x-ratelimit-limit']).toBe(String(MAX_REQUESTS));
            expect(response.headers['x-ratelimit-window']).toBe(String(RATE_LIMIT_WINDOW));
        });
    });

    test('should block requests exceeding rate limit', async () => {
        // Make requests exceeding the limit
        const excessRequests = MAX_REQUESTS + 10;
        const responses = await makeRequests(excessRequests);

        // Count successful and blocked requests
        const successfulRequests = responses.filter(r => r.success).length;
        const blockedRequests = responses.filter(r => !r.success).length;

        // Verify rate limiting worked
        expect(successfulRequests).toBe(MAX_REQUESTS);
        expect(blockedRequests).toBe(10);

        // Verify error response for blocked requests
        responses.slice(MAX_REQUESTS).forEach(response => {
            expect(response.success).toBe(false);
            expect(response.error).toBe('Rate limit exceeded');
            expect(response.status).toBe(429);
            expect(response.headers['retry-after']).toBeDefined();
        });
    });

    test('should reset rate limit after window expires', async () => {
        // Fill up the rate limit
        await makeRequests(MAX_REQUESTS);

        // Mock time passing - move Redis TTL forward
        const key = `ratelimit:127.0.0.1:${TEST_ENDPOINT}`;
        await redisClient.del(key);

        // Verify new requests succeed
        const newResponses = await makeRequests(5);
        newResponses.forEach(response => {
            expect(response.success).toBe(true);
            expect(response.headers['x-ratelimit-remaining']).toBe(String(MAX_REQUESTS - 1));
        });
    });

    test('should skip rate limit for whitelisted routes', async () => {
        // Test health check endpoint (typically whitelisted)
        const responses = await makeRequests(MAX_REQUESTS + 10, '/health');

        // Verify all requests succeeded without rate limiting
        responses.forEach(response => {
            expect(response.success).toBe(true);
            expect(response.headers['x-ratelimit-remaining']).toBeUndefined();
        });
    });

    test('should skip rate limit for whitelisted IPs', async () => {
        // Test with whitelisted IP
        const responses = await Promise.all(
            Array(MAX_REQUESTS + 10).fill(null).map(() =>
                testClient.get(TEST_ENDPOINT, {
                    headers: {
                        'X-Test-IP': '192.168.1.1' // Whitelisted IP
                    }
                })
            )
        );

        // Verify all requests succeeded without rate limiting
        responses.forEach(response => {
            expect(response.success).toBe(true);
            expect(response.headers['x-ratelimit-remaining']).toBeUndefined();
        });
    });

    test('should handle concurrent requests accurately', async () => {
        // Make many concurrent requests
        const concurrentRequests = 50;
        const responses = await Promise.all([
            makeRequests(concurrentRequests),
            makeRequests(concurrentRequests),
            makeRequests(concurrentRequests)
        ]);

        // Flatten responses
        const allResponses = responses.flat();

        // Verify rate limit counting was accurate
        const successfulRequests = allResponses.filter(r => r.success).length;
        expect(successfulRequests).toBe(concurrentRequests * 3);

        // Verify remaining counts decreased sequentially
        const remainingCounts = allResponses
            .map(r => parseInt(r.headers['x-ratelimit-remaining']))
            .sort((a, b) => b - a);
        
        expect(remainingCounts[0]).toBe(MAX_REQUESTS - 1);
        expect(remainingCounts[remainingCounts.length - 1]).toBe(MAX_REQUESTS - (concurrentRequests * 3));
    });
});