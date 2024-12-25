/**
 * Integration tests for document generation service
 * Tests end-to-end document generation with performance validation
 * @version 1.0.0
 */

import { jest } from '@jest/globals'; // v29.x
import memwatch from '@airbnb/node-memwatch'; // v2.x
import now from 'performance-now'; // v2.x

import { DocumentGenerator } from '../../../backend/output-generation/src/core/document.generator';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';
import { generateMockContent } from '../../mocks/data/content.mock';
import { ExportFormat } from '../../../backend/output-generation/src/models/document.model';

// Constants for test configuration
const TEST_TIMEOUT = 30000; // 30 seconds
const PERFORMANCE_THRESHOLD_MS = 5000; // 5 seconds per content item
const MAX_MEMORY_INCREASE_MB = 100; // Maximum allowed memory increase

describe('Document Generation Integration Tests', () => {
  let documentGenerator: DocumentGenerator;
  let heapDiff: any;
  let startTime: number;

  beforeAll(async () => {
    // Setup test environment and initialize document generator
    await setupTestEnvironment();
    
    // Start memory monitoring
    heapDiff = new memwatch.HeapDiff();
  });

  afterAll(async () => {
    // Generate memory report
    const memoryReport = heapDiff.end();
    console.log('Memory change:', memoryReport.change);

    // Cleanup test environment
    await teardownTestEnvironment();
  });

  beforeEach(() => {
    // Reset performance monitoring
    startTime = now();
  });

  it('should generate markdown document within performance threshold', async () => {
    // Create mock content with text and graphs
    const mockContent = await generateMockContent({
      includeGraphs: true,
      contentType: 'article',
      qualityScore: 0.95
    });

    // Configure generator with markdown options
    documentGenerator = new DocumentGenerator(mockContent, {
      format: ExportFormat.MARKDOWN,
      includeGraphs: true,
      templateOptions: {
        customStyles: {},
        locale: 'en-US'
      },
      formatOptions: {
        compression: {
          enabled: true,
          level: 6,
          method: 'balanced'
        },
        accessibility: {
          enabled: true,
          wcagLevel: 'AA',
          language: 'en'
        }
      },
      memoryOptimization: {
        chunkSize: 1024 * 1024,
        gcThreshold: 100 * 1024 * 1024,
        maxBufferSize: 500 * 1024 * 1024
      },
      progressTracking: {
        enabled: true,
        granularity: 5,
        includeMetrics: true
      }
    });

    // Generate document and validate
    const result = await documentGenerator.generate();

    // Verify performance
    const duration = now() - startTime;
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);

    // Verify output format and structure
    expect(result.content).toBeDefined();
    expect(result.format).toBe(ExportFormat.MARKDOWN);
    expect(result.metadata.contentSize).toBeGreaterThan(0);
    expect(result.metadata.graphCount).toBeGreaterThan(0);

    // Verify metrics
    expect(result.metrics.totalDuration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    expect(result.metrics.memoryUsage.peak - result.metrics.memoryUsage.initial)
      .toBeLessThan(MAX_MEMORY_INCREASE_MB * 1024 * 1024);
  }, TEST_TIMEOUT);

  it('should generate PDF document with proper accessibility tags', async () => {
    const mockContent = await generateMockContent({
      includeGraphs: true,
      contentType: 'article'
    });

    documentGenerator = new DocumentGenerator(mockContent, {
      format: ExportFormat.PDF,
      includeGraphs: true,
      templateOptions: {
        customStyles: {},
        locale: 'en-US'
      },
      formatOptions: {
        accessibility: {
          enabled: true,
          wcagLevel: 'AA',
          language: 'en'
        }
      }
    });

    const result = await documentGenerator.generate();

    // Verify PDF output
    expect(result.content).toBeInstanceOf(Buffer);
    expect(result.format).toBe(ExportFormat.PDF);
    
    // Verify accessibility metadata
    expect(result.metadata).toHaveProperty('accessibility');
    expect(result.metadata.accessibility.wcagLevel).toBe('AA');
    
    // Verify performance
    expect(now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
  }, TEST_TIMEOUT);

  it('should support concurrent document generation', async () => {
    const mockContents = await Promise.all([
      generateMockContent({ contentType: 'article' }),
      generateMockContent({ contentType: 'book' }),
      generateMockContent({ contentType: 'video' })
    ]);

    const generators = mockContents.map(content => 
      new DocumentGenerator(content, {
        format: ExportFormat.MARKDOWN,
        includeGraphs: true
      })
    );

    // Generate documents concurrently
    const results = await Promise.all(
      generators.map(generator => generator.generate())
    );

    // Verify all generations succeeded
    results.forEach(result => {
      expect(result.content).toBeDefined();
      expect(result.metrics.totalDuration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    // Verify total time for concurrent generation
    expect(now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
  }, TEST_TIMEOUT);

  it('should handle internationalization correctly', async () => {
    const locales = ['en-US', 'es-ES', 'ar-SA'];
    const mockContent = await generateMockContent({
      contentType: 'article'
    });

    const results = await Promise.all(
      locales.map(locale => {
        const generator = new DocumentGenerator(mockContent, {
          format: ExportFormat.MARKDOWN,
          templateOptions: { locale },
          formatOptions: {
            accessibility: {
              language: locale.split('-')[0]
            }
          }
        });
        return generator.generate();
      })
    );

    // Verify locale-specific output
    results.forEach((result, index) => {
      expect(result.metadata).toHaveProperty('locale', locales[index]);
      expect(result.metrics.totalDuration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    // Verify RTL support for Arabic
    const arContent = results[2].content as string;
    expect(arContent).toMatch(/dir="rtl"/);
  }, TEST_TIMEOUT);

  it('should handle large documents efficiently', async () => {
    const mockContent = await generateMockContent({
      contentType: 'book',
      size: 'large',
      includeGraphs: true
    });

    documentGenerator = new DocumentGenerator(mockContent, {
      format: ExportFormat.PDF,
      memoryOptimization: {
        chunkSize: 1024 * 1024,
        gcThreshold: 50 * 1024 * 1024,
        maxBufferSize: 200 * 1024 * 1024
      }
    });

    const startMemory = process.memoryUsage().heapUsed;
    const result = await documentGenerator.generate();
    const endMemory = process.memoryUsage().heapUsed;

    // Verify memory usage
    const memoryIncrease = (endMemory - startMemory) / (1024 * 1024);
    expect(memoryIncrease).toBeLessThan(MAX_MEMORY_INCREASE_MB);

    // Verify chunked processing worked
    expect(result.metrics.totalDuration).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
    expect(result.content).toBeDefined();
  }, TEST_TIMEOUT);
});