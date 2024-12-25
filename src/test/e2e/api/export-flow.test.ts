// External dependencies with versions
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'; // v29.x
import { StatusCodes } from 'http-status-codes'; // ^2.3.0

// Internal imports
import { TestClient } from '../../utils/test-client';
import { ExportFormat } from '../../../backend/api-gateway/src/types';

// Test configuration constants
const TEST_TIMEOUT = 60000; // 60 seconds
const EXPORT_POLL_INTERVAL = 1000; // 1 second
const MAX_EXPORT_WAIT_TIME = 300000; // 5 minutes

// Initialize test client
const testClient = new TestClient();

describe('Document Export Flow E2E Tests', () => {
    // Test data
    let testTopicId: string;
    let testExportId: string;

    beforeAll(async () => {
        // Create test topic with comprehensive content
        const topicResponse = await testClient.post('/api/v1/topics', {
            name: 'Machine Learning Fundamentals',
            metadata: {
                description: 'Comprehensive overview of machine learning concepts',
                tags: ['machine-learning', 'ai', 'neural-networks']
            }
        });
        expect(topicResponse.success).toBe(true);
        testTopicId = topicResponse.data.id;

        // Add test content to topic
        await testClient.post(`/api/v1/topics/${testTopicId}/content`, {
            type: 'ARTICLE',
            title: 'Introduction to Neural Networks',
            description: 'Comprehensive guide to neural network architectures',
            sourceUrl: 'https://example.com/neural-networks',
            qualityScore: 0.95,
            metadata: {
                author: 'Dr. Jane Smith',
                publishDate: new Date().toISOString(),
                wordCount: 5000
            }
        });
    });

    afterAll(async () => {
        // Clean up test data
        await testClient.post(`/api/v1/topics/${testTopicId}/delete`);
    });

    it('should export document to Notion with knowledge graph', async () => {
        // Request Notion export
        const exportResponse = await testClient.post('/api/v1/export', {
            topicId: testTopicId,
            format: ExportFormat.NOTION,
            options: {
                includeGraphs: true,
                includeReferences: true,
                customStyles: {
                    headingFont: 'Inter',
                    codeTheme: 'github'
                },
                maxDepth: 3
            }
        });

        expect(exportResponse.success).toBe(true);
        expect(exportResponse.data.exportId).toBeDefined();
        testExportId = exportResponse.data.exportId;

        // Poll export progress until completion
        let isComplete = false;
        let attempts = 0;
        const maxAttempts = MAX_EXPORT_WAIT_TIME / EXPORT_POLL_INTERVAL;

        while (!isComplete && attempts < maxAttempts) {
            const progressResponse = await testClient.get(`/api/v1/export/${testExportId}/progress`);
            expect(progressResponse.success).toBe(true);

            if (progressResponse.data.status === 'COMPLETED') {
                isComplete = true;
                expect(progressResponse.data.documentUrl).toBeDefined();
                expect(progressResponse.data.metadata.format).toBe('NOTION');
                expect(progressResponse.data.metadata.includesGraph).toBe(true);
            } else if (progressResponse.data.status === 'FAILED') {
                throw new Error(`Export failed: ${progressResponse.data.error}`);
            }

            if (!isComplete) {
                await new Promise(resolve => setTimeout(resolve, EXPORT_POLL_INTERVAL));
                attempts++;
            }
        }

        expect(isComplete).toBe(true);
    }, TEST_TIMEOUT);

    it('should export document to Markdown with custom formatting', async () => {
        const exportResponse = await testClient.post('/api/v1/export', {
            topicId: testTopicId,
            format: ExportFormat.MARKDOWN,
            options: {
                includeGraphs: true,
                includeReferences: true,
                customStyles: {
                    tableFormat: 'github',
                    codeBlocks: true,
                    imageAlignment: 'center'
                }
            }
        });

        expect(exportResponse.success).toBe(true);
        const exportId = exportResponse.data.exportId;

        // Monitor export progress
        let isComplete = false;
        let attempts = 0;

        while (!isComplete && attempts < maxAttempts) {
            const progressResponse = await testClient.get(`/api/v1/export/${exportId}/progress`);
            expect(progressResponse.success).toBe(true);

            if (progressResponse.data.status === 'COMPLETED') {
                isComplete = true;
                expect(progressResponse.data.documentUrl).toMatch(/\.md$/);
                expect(progressResponse.data.metadata.format).toBe('MARKDOWN');
            } else if (progressResponse.data.status === 'FAILED') {
                throw new Error(`Export failed: ${progressResponse.data.error}`);
            }

            if (!isComplete) {
                await new Promise(resolve => setTimeout(resolve, EXPORT_POLL_INTERVAL));
                attempts++;
            }
        }

        expect(isComplete).toBe(true);
    }, TEST_TIMEOUT);

    it('should export document to PDF with styling', async () => {
        const exportResponse = await testClient.post('/api/v1/export', {
            topicId: testTopicId,
            format: ExportFormat.PDF,
            options: {
                includeGraphs: true,
                includeReferences: true,
                customStyles: {
                    fontSize: '11pt',
                    fontFamily: 'Arial',
                    margins: '1in',
                    headerFooter: true
                }
            }
        });

        expect(exportResponse.success).toBe(true);
        const exportId = exportResponse.data.exportId;

        // Monitor export progress
        let isComplete = false;
        let attempts = 0;

        while (!isComplete && attempts < maxAttempts) {
            const progressResponse = await testClient.get(`/api/v1/export/${exportId}/progress`);
            expect(progressResponse.success).toBe(true);

            if (progressResponse.data.status === 'COMPLETED') {
                isComplete = true;
                expect(progressResponse.data.documentUrl).toMatch(/\.pdf$/);
                expect(progressResponse.data.metadata.format).toBe('PDF');
            } else if (progressResponse.data.status === 'FAILED') {
                throw new Error(`Export failed: ${progressResponse.data.error}`);
            }

            if (!isComplete) {
                await new Promise(resolve => setTimeout(resolve, EXPORT_POLL_INTERVAL));
                attempts++;
            }
        }

        expect(isComplete).toBe(true);
    }, TEST_TIMEOUT);

    it('should handle export errors gracefully', async () => {
        // Test with invalid format
        const invalidFormatResponse = await testClient.post('/api/v1/export', {
            topicId: testTopicId,
            format: 'INVALID_FORMAT',
            options: {}
        });

        expect(invalidFormatResponse.success).toBe(false);
        expect(invalidFormatResponse.error).toContain('Invalid export format');

        // Test with non-existent topic
        const invalidTopicResponse = await testClient.post('/api/v1/export', {
            topicId: 'non-existent-topic',
            format: ExportFormat.PDF,
            options: {}
        });

        expect(invalidTopicResponse.success).toBe(false);
        expect(invalidTopicResponse.error).toContain('Topic not found');

        // Test with invalid options
        const invalidOptionsResponse = await testClient.post('/api/v1/export', {
            topicId: testTopicId,
            format: ExportFormat.PDF,
            options: {
                maxDepth: -1
            }
        });

        expect(invalidOptionsResponse.success).toBe(false);
        expect(invalidOptionsResponse.error).toContain('Invalid maxDepth value');
    });

    it('should track export progress accurately', async () => {
        const exportResponse = await testClient.post('/api/v1/export', {
            topicId: testTopicId,
            format: ExportFormat.PDF,
            options: { includeGraphs: true }
        });

        expect(exportResponse.success).toBe(true);
        const exportId = exportResponse.data.exportId;

        // Track progress stages
        const progressStages = new Set<string>();
        let lastProgress = 0;

        while (progressStages.size < 5) {
            const progressResponse = await testClient.get(`/api/v1/export/${exportId}/progress`);
            expect(progressResponse.success).toBe(true);

            const currentProgress = progressResponse.data.progressPercentage;
            expect(currentProgress).toBeGreaterThanOrEqual(lastProgress);
            lastProgress = currentProgress;

            if (progressResponse.data.currentStage) {
                progressStages.add(progressResponse.data.currentStage);
            }

            await new Promise(resolve => setTimeout(resolve, EXPORT_POLL_INTERVAL));
        }

        // Verify all major stages were tracked
        expect(progressStages.has('INITIALIZING')).toBe(true);
        expect(progressStages.has('CONTENT_PROCESSING')).toBe(true);
        expect(progressStages.has('GRAPH_GENERATION')).toBe(true);
        expect(progressStages.has('DOCUMENT_FORMATTING')).toBe(true);
        expect(progressStages.has('FINALIZING')).toBe(true);
    }, TEST_TIMEOUT);
});