/**
 * Content Processing Performance Benchmark Suite
 * Version: 1.0.0
 * 
 * Enterprise-grade performance benchmarks for content processing operations,
 * measuring processing speed, quality assessment, and content enrichment performance.
 */

// External imports with versions
import { benchmark } from '@jest/benchmark'; // v29.x
import { v4 as uuidv4 } from 'uuid'; // v9.x

// Internal imports
import { ContentProcessor } from '../../../backend/content-discovery/app/core/content_processor';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';
import { MockFactory } from '../../utils/mock-factory';

// Constants for benchmark configuration
const BATCH_SIZES = [1, 10, 50, 100];
const CONTENT_TYPES = ['article', 'video', 'podcast', 'book'];
const BENCHMARK_ITERATIONS = 100;
const WARMUP_ITERATIONS = 10;
const QUALITY_THRESHOLD = 0.90;
const PERFORMANCE_THRESHOLD_MS = 5000;

// Metrics collectors
const metrics = {
  processingTimes: new Map<string, number[]>(),
  qualityScores: new Map<string, number[]>(),
  batchMetrics: new Map<string, any[]>()
};

/**
 * Setup benchmark environment with comprehensive initialization
 */
beforeAll(async () => {
  try {
    // Initialize test environment
    await setupTestEnvironment({
      preserveState: false,
      mockData: true,
      timeoutMs: 30000
    });

    // Initialize content processor with quality threshold
    const processor = new ContentProcessor({
      qualityThreshold: QUALITY_THRESHOLD,
      maxParallelTasks: 10,
      retryAttempts: 3
    });

    // Perform warmup iterations
    const mockFactory = new MockFactory();
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      const mockBatch = await mockFactory.createMockBatch('content', 1);
      await processor.process_topic(uuidv4(), 'warmup query');
    }

    console.log('Benchmark environment initialized successfully');
  } catch (error) {
    console.error('Failed to initialize benchmark environment:', error);
    throw error;
  }
});

/**
 * Cleanup benchmark environment and resources
 */
afterAll(async () => {
  try {
    // Export benchmark results
    const results = {
      processingTimes: Object.fromEntries(metrics.processingTimes),
      qualityScores: Object.fromEntries(metrics.qualityScores),
      batchMetrics: Object.fromEntries(metrics.batchMetrics)
    };

    // Cleanup test environment
    await teardownTestEnvironment(true, {
      preserveResults: true,
      resultsData: results
    });

    console.log('Benchmark environment cleaned up successfully');
  } catch (error) {
    console.error('Failed to cleanup benchmark environment:', error);
    throw error;
  }
});

/**
 * Execute content processing benchmark with detailed monitoring
 */
async function benchmarkContentProcessing(
  batchSize: number,
  contentType: string,
  options = {}
): Promise<any> {
  const mockFactory = new MockFactory();
  const processor = new ContentProcessor({
    qualityThreshold: QUALITY_THRESHOLD
  });

  const startTime = Date.now();
  const batchKey = `${contentType}_${batchSize}`;

  try {
    // Generate test data batch
    const mockBatch = await mockFactory.createMockBatch('content', batchSize, {
      contentType,
      qualityThreshold: QUALITY_THRESHOLD
    });

    // Process content batch
    const results = await processor.process_topic(
      uuidv4(),
      'test query',
      { contentType }
    );

    // Collect metrics
    const processingTime = Date.now() - startTime;
    metrics.processingTimes.set(
      batchKey,
      (metrics.processingTimes.get(batchKey) || []).concat(processingTime)
    );

    const qualityScores = results.map(item => item.quality_score);
    metrics.qualityScores.set(
      batchKey,
      (metrics.qualityScores.get(batchKey) || []).concat(qualityScores)
    );

    // Validate performance
    if (processingTime > PERFORMANCE_THRESHOLD_MS) {
      console.warn(
        `Performance threshold exceeded for ${batchKey}: ${processingTime}ms`
      );
    }

    return {
      processingTime,
      itemsProcessed: results.length,
      averageQualityScore: qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
    };

  } catch (error) {
    console.error(`Benchmark failed for ${batchKey}:`, error);
    throw error;
  }
}

/**
 * Generate comprehensive performance analysis report
 */
function generateBenchmarkReport(benchmarkResults: any): any {
  const report = {
    summary: {
      totalExecutions: BENCHMARK_ITERATIONS,
      batchSizes: BATCH_SIZES,
      contentTypes: CONTENT_TYPES,
      qualityThreshold: QUALITY_THRESHOLD,
      performanceThreshold: PERFORMANCE_THRESHOLD_MS
    },
    results: {},
    recommendations: []
  };

  // Process metrics for each batch size and content type
  for (const batchSize of BATCH_SIZES) {
    for (const contentType of CONTENT_TYPES) {
      const key = `${contentType}_${batchSize}`;
      const processingTimes = metrics.processingTimes.get(key) || [];
      const qualityScores = metrics.qualityScores.get(key) || [];

      report.results[key] = {
        averageProcessingTime: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length,
        maxProcessingTime: Math.max(...processingTimes),
        minProcessingTime: Math.min(...processingTimes),
        averageQualityScore: qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length,
        itemsExceedingThreshold: processingTimes.filter(t => t > PERFORMANCE_THRESHOLD_MS).length,
        totalItems: processingTimes.length
      };

      // Generate recommendations
      if (report.results[key].averageProcessingTime > PERFORMANCE_THRESHOLD_MS * 0.8) {
        report.recommendations.push({
          type: 'performance',
          context: `${contentType} with batch size ${batchSize}`,
          suggestion: 'Consider reducing batch size or increasing processing resources'
        });
      }
    }
  }

  return report;
}

// Execute benchmarks for each combination
CONTENT_TYPES.forEach(contentType => {
  BATCH_SIZES.forEach(batchSize => {
    benchmark(`Process ${contentType} batch of ${batchSize}`, async () => {
      await benchmarkContentProcessing(batchSize, contentType);
    }, {
      iterations: BENCHMARK_ITERATIONS,
      maxTime: PERFORMANCE_THRESHOLD_MS * 2
    });
  });
});

// Export benchmark utilities
export const contentProcessingBenchmarks = {
  benchmarkResults: metrics,
  generateReport: generateBenchmarkReport,
  performanceMetrics: {
    PERFORMANCE_THRESHOLD_MS,
    QUALITY_THRESHOLD
  },
  qualityMetrics: {
    processingTimes: metrics.processingTimes,
    qualityScores: metrics.qualityScores
  }
};