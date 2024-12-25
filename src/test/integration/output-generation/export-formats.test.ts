/**
 * Integration tests for output generation service export formats
 * Tests multiple export formats, performance requirements, and error handling
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { ExportManager, ExportResult } from '../../../backend/output-generation/src/core/export.manager';
import { Document, DocumentContent, ExportFormat } from '../../../backend/output-generation/src/models/document.model';
import { setupTestEnvironment, teardownTestEnvironment, monitorPerformance } from '../../utils/test-helpers';
import { exportFixtures } from '../../fixtures/exports.json';

// Constants for test configuration
const TEST_TIMEOUT = 30000;
const PERFORMANCE_THRESHOLD = 5000; // 5 seconds max processing time
const QUALITY_THRESHOLD = 0.9;

describe('Export Formats Integration Tests', () => {
    let exportManager: ExportManager;
    let testDocument: DocumentContent;

    beforeAll(async () => {
        // Setup test environment with performance monitoring
        await setupTestEnvironment({
            mockData: true,
            timeoutMs: TEST_TIMEOUT
        });

        exportManager = new ExportManager();
        testDocument = exportFixtures.sampleExports[0];
    });

    afterAll(async () => {
        await teardownTestEnvironment();
    });

    /**
     * Tests Markdown export functionality with performance validation
     */
    test('should generate valid Markdown content within performance threshold', async () => {
        const startTime = Date.now();

        const result = await exportManager.exportDocument(testDocument, {
            format: ExportFormat.MARKDOWN,
            includeGraphs: true,
            timeout: TEST_TIMEOUT,
            validationRules: {
                maxContentSize: 10 * 1024 * 1024, // 10MB
                allowedFormats: [ExportFormat.MARKDOWN],
                securityChecks: true
            }
        });

        // Verify performance requirements
        const processingTime = Date.now() - startTime;
        expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);

        // Verify export result structure
        expect(result).toBeDefined();
        expect(result.correlationId).toBeDefined();
        expect(result.format).toBe(ExportFormat.MARKDOWN);
        expect(result.content).toBeDefined();

        // Verify Markdown content structure
        const content = result.content as string;
        expect(content).toContain('# ' + testDocument.metadata.title);
        expect(content).toContain('## Introduction');
        expect(content).toMatch(/\[.*\]\(.*\)/); // Contains links
        expect(content).toMatch(/```.*```/); // Contains code blocks

        // Verify metadata
        expect(result.metadata).toEqual(expect.objectContaining({
            generatedAt: expect.any(Date),
            contentSize: expect.any(Number)
        }));
    });

    /**
     * Tests PDF export functionality with accessibility and performance validation
     */
    test('should generate accessible PDF document within performance threshold', async () => {
        const startTime = Date.now();

        const result = await exportManager.exportDocument(testDocument, {
            format: ExportFormat.PDF,
            includeGraphs: true,
            timeout: TEST_TIMEOUT,
            validationRules: {
                maxContentSize: 10 * 1024 * 1024,
                allowedFormats: [ExportFormat.PDF],
                securityChecks: true
            }
        });

        // Verify performance requirements
        const processingTime = Date.now() - startTime;
        expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);

        // Verify export result structure
        expect(result).toBeDefined();
        expect(result.correlationId).toBeDefined();
        expect(result.format).toBe(ExportFormat.PDF);
        expect(Buffer.isBuffer(result.content)).toBeTruthy();

        // Verify PDF metadata
        expect(result.metadata).toEqual(expect.objectContaining({
            generatedAt: expect.any(Date),
            contentSize: expect.any(Number),
            pageCount: expect.any(Number)
        }));
    });

    /**
     * Tests Notion export functionality with performance validation
     */
    test('should generate Notion pages within performance threshold', async () => {
        const startTime = Date.now();

        const result = await exportManager.exportDocument(testDocument, {
            format: ExportFormat.NOTION,
            includeGraphs: true,
            timeout: TEST_TIMEOUT,
            validationRules: {
                maxContentSize: 10 * 1024 * 1024,
                allowedFormats: [ExportFormat.NOTION],
                securityChecks: true
            }
        });

        // Verify performance requirements
        const processingTime = Date.now() - startTime;
        expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);

        // Verify export result structure
        expect(result).toBeDefined();
        expect(result.correlationId).toBeDefined();
        expect(result.format).toBe(ExportFormat.NOTION);

        // Verify Notion blocks structure
        const notionBlocks = JSON.parse(result.content as string);
        expect(Array.isArray(notionBlocks)).toBeTruthy();
        expect(notionBlocks.length).toBeGreaterThan(0);
        expect(notionBlocks[0]).toHaveProperty('type');
    });

    /**
     * Tests export status tracking functionality
     */
    test('should track export status correctly', async () => {
        const result = await exportManager.exportDocument(testDocument, {
            format: ExportFormat.MARKDOWN
        });

        const status = await exportManager.getExportStatus(result.correlationId);

        expect(status).toBeDefined();
        expect(status.status).toBe('completed');
        expect(status.progress).toBe(100);
        expect(status.format).toBe(ExportFormat.MARKDOWN);
        expect(status.startTime).toBeDefined();
        expect(status.endTime).toBeDefined();
        expect(status.metrics).toEqual(expect.objectContaining({
            duration: expect.any(Number),
            memoryUsage: expect.any(Number),
            retryCount: expect.any(Number)
        }));
    });

    /**
     * Tests error handling for failed exports
     */
    test('should handle export errors appropriately', async () => {
        const invalidDocument = { ...testDocument, metadata: undefined };

        await expect(async () => {
            await exportManager.exportDocument(invalidDocument, {
                format: ExportFormat.MARKDOWN
            });
        }).rejects.toThrow();

        // Verify error status is tracked
        const status = await exportManager.getExportStatus(invalidDocument.id);
        expect(status.status).toBe('failed');
        expect(status.error).toBeDefined();
    });

    /**
     * Tests concurrent export handling
     */
    test('should handle concurrent exports correctly', async () => {
        const exportPromises = Array(3).fill(null).map(() => 
            exportManager.exportDocument(testDocument, {
                format: ExportFormat.MARKDOWN
            })
        );

        const results = await Promise.all(exportPromises);

        results.forEach(result => {
            expect(result).toBeDefined();
            expect(result.correlationId).toBeDefined();
            expect(result.content).toBeDefined();
        });
    });
});