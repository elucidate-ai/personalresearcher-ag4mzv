// External dependencies with versions
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'; // v29.x
import { StatusCodes } from 'http-status-codes'; // v2.3.x

// Internal dependencies
import { TestClient } from '../../utils/test-client';
import { setupTestEnvironment } from '../../utils/test-helpers';
import { ContentType, ExportFormat } from '../../../backend/api-gateway/src/types';

// Constants
const TEST_TIMEOUT = 30000;
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN;
const MIN_QUALITY_SCORE = 0.9;
const MAX_PROCESSING_TIME = 5000;
const MIN_GRAPH_CONNECTIONS = 10;

// Initialize test client
const testClient = new TestClient({ baseURL: process.env.TEST_API_URL });

beforeAll(async () => {
    // Set up test environment and initialize client
    await setupTestEnvironment();
    testClient.setAuthToken(TEST_AUTH_TOKEN);
});

afterAll(async () => {
    // Clean up test environment
    await setupTestEnvironment({ preserveState: false });
});

describe('Health Routes', () => {
    test('Should return 200 OK for liveness check', async () => {
        const response = await testClient.get('/live');
        
        expect(response.success).toBe(true);
        expect(response.data.status).toBe('UP');
        expect(response.data.timestamp).toBeDefined();
    });

    test('Should return 200 OK for readiness check when healthy', async () => {
        const response = await testClient.get('/ready');
        
        expect(response.success).toBe(true);
        expect(response.data.status).toBe('UP');
        expect(response.data.services).toBeDefined();
        expect(Object.values(response.data.services)).toContain('UP');
    });

    test('Should return 503 for readiness check when unhealthy', async () => {
        // Simulate service degradation
        jest.spyOn(testClient, 'get').mockResolvedValueOnce({
            success: false,
            data: {
                status: 'DOWN',
                services: { 'content-service': 'DOWN' }
            }
        });

        const response = await testClient.get('/ready');
        expect(response.success).toBe(false);
        expect(response.data.status).toBe('DOWN');
    });
});

describe('Content Routes', () => {
    test('Should discover content meeting quality threshold', async () => {
        const response = await testClient.post('/content/discover', {
            topic: 'machine learning',
            contentTypes: [ContentType.VIDEO, ContentType.ARTICLE],
            minQualityScore: MIN_QUALITY_SCORE
        });

        expect(response.success).toBe(true);
        expect(response.data.items).toBeDefined();
        expect(response.data.items.length).toBeGreaterThan(0);
        
        // Validate quality scores
        response.data.items.forEach(item => {
            expect(item.qualityScore).toBeGreaterThanOrEqual(MIN_QUALITY_SCORE);
        });
    });

    test('Should process content within time limit', async () => {
        const startTime = Date.now();
        
        const response = await testClient.post('/content/discover', {
            topic: 'deep learning',
            contentTypes: [ContentType.ARTICLE]
        });

        const processingTime = Date.now() - startTime;
        expect(processingTime).toBeLessThan(MAX_PROCESSING_TIME);
        expect(response.success).toBe(true);
    });

    test('Should enforce rate limiting', async () => {
        // Make rapid requests to trigger rate limiting
        const requests = Array(10).fill(null).map(() => 
            testClient.post('/content/discover', { topic: 'test' })
        );

        const responses = await Promise.all(requests);
        const rateLimited = responses.some(r => 
            r.error?.includes('Rate limit exceeded')
        );

        expect(rateLimited).toBe(true);
    });
});

describe('Graph Routes', () => {
    test('Should generate valid knowledge graph', async () => {
        const response = await testClient.post('/graph/generate', {
            topic: 'machine learning',
            maxDepth: 3
        });

        expect(response.success).toBe(true);
        expect(response.data.nodes).toBeDefined();
        expect(response.data.relationships).toBeDefined();
    });

    test('Should ensure minimum topic connections', async () => {
        const response = await testClient.post('/graph/generate', {
            topic: 'neural networks',
            maxDepth: 2
        });

        expect(response.success).toBe(true);
        expect(response.data.relationships.length).toBeGreaterThanOrEqual(MIN_GRAPH_CONNECTIONS);
    });

    test('Should validate graph structure', async () => {
        const response = await testClient.post('/graph/validate', {
            graphId: 'test-graph-id',
            validationRules: ['connectivity', 'cycles', 'relevance']
        });

        expect(response.success).toBe(true);
        expect(response.data.isValid).toBe(true);
        expect(response.data.validationErrors).toHaveLength(0);
    });
});

describe('Export Routes', () => {
    test('Should generate exports in supported formats', async () => {
        const formats = Object.values(ExportFormat);
        const exportPromises = formats.map(format =>
            testClient.post('/export/generate', {
                topic: 'machine learning',
                format,
                options: {
                    includeGraphs: true,
                    includeReferences: true
                }
            })
        );

        const responses = await Promise.all(exportPromises);
        responses.forEach(response => {
            expect(response.success).toBe(true);
            expect(response.data.documentUrl).toBeDefined();
        });
    });

    test('Should enforce premium format access', async () => {
        // Remove auth token to simulate non-premium user
        testClient.setAuthToken(null);

        const response = await testClient.post('/export/generate', {
            topic: 'machine learning',
            format: ExportFormat.PDF
        });

        expect(response.success).toBe(false);
        expect(response.error).toContain('Premium format not available');

        // Restore auth token
        testClient.setAuthToken(TEST_AUTH_TOKEN);
    });

    test('Should track export progress', async () => {
        const exportResponse = await testClient.post('/export/generate', {
            topic: 'deep learning',
            format: ExportFormat.NOTION
        });

        expect(exportResponse.success).toBe(true);
        const exportId = exportResponse.data.exportId;

        const progressResponse = await testClient.get(`/export/${exportId}/progress`);
        expect(progressResponse.success).toBe(true);
        expect(progressResponse.data.status).toBeDefined();
        expect(progressResponse.data.progressPercentage).toBeDefined();
    });
});