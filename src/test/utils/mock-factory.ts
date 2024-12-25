/**
 * Mock Factory Utility
 * Version: 1.0.0
 * 
 * Provides enterprise-grade mock data generation with comprehensive validation,
 * monitoring, and quality control for testing knowledge aggregation components.
 */

// External imports with versions
import { faker } from '@faker-js/faker'; // ^8.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import winston from 'winston'; // ^3.8.0

// Internal imports
import { 
  generateMockContent, 
  generateMockContentBatch 
} from '../mocks/data/content.mock';
import { 
  mockNodes, 
  mockRelationships, 
  mockGraph 
} from '../mocks/data/graphs.mock';
import {
  createMockEmbedding,
  createMockEmbeddingBatch
} from '../mocks/data/vectors.mock';

// Constants for mock data generation and validation
export const MOCK_TYPES = ['content', 'graph', 'vector'] as const;
export const DEFAULT_BATCH_SIZE = 10;
export const QUALITY_THRESHOLD = 0.9;
export const MAX_VECTOR_DIMENSION = 1024;
export const MAX_BATCH_SIZE = 100;

// Types for mock factory configuration
export interface MockFactoryConfig {
  seed?: string;
  qualityThreshold?: number;
  validateSchema?: boolean;
  monitorPerformance?: boolean;
  correlationId?: string;
}

export interface MockGenerationOptions {
  batchSize?: number;
  contentType?: string;
  graphDepth?: number;
  vectorDimension?: number;
  customMetadata?: Record<string, any>;
}

// Performance monitoring decorator
function monitorPerformance(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function(...args: any[]) {
    const start = performance.now();
    const correlationId = uuidv4();

    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;

      logger.info('Mock generation completed', {
        correlationId,
        operation: propertyKey,
        duration: `${duration.toFixed(2)}ms`,
        resultSize: Array.isArray(result) ? result.length : 1
      });

      return result;
    } catch (error) {
      logger.error('Mock generation failed', {
        correlationId,
        operation: propertyKey,
        error: error.message,
        duration: `${performance.now() - start}ms`
      });
      throw error;
    }
  };

  return descriptor;
}

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
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
 * Enterprise-grade mock data factory with comprehensive validation and monitoring
 */
export class MockFactory {
  private config: MockFactoryConfig;
  private mockCache: Map<string, any>;

  constructor(config: MockFactoryConfig = {}) {
    this.config = {
      seed: 'mock-factory-seed',
      qualityThreshold: QUALITY_THRESHOLD,
      validateSchema: true,
      monitorPerformance: true,
      ...config
    };
    this.mockCache = new Map();
    faker.seed(this.config.seed);
  }

  /**
   * Creates validated mock data of specified type with quality checks
   */
  @monitorPerformance
  async createMockData(
    type: typeof MOCK_TYPES[number],
    config: Record<string, any> = {},
    options: MockGenerationOptions = {}
  ): Promise<any> {
    const correlationId = uuidv4();

    try {
      // Validate mock type
      if (!MOCK_TYPES.includes(type)) {
        throw new Error(`Invalid mock type: ${type}`);
      }

      // Apply quality threshold
      const qualityThreshold = Math.max(
        config.qualityThreshold || this.config.qualityThreshold,
        QUALITY_THRESHOLD
      );

      switch (type) {
        case 'content':
          return await generateMockContent(
            options.contentType,
            qualityThreshold,
            options.customMetadata
          );

        case 'graph':
          return {
            ...mockGraph,
            nodes: mockNodes.filter(node => node.importance >= qualityThreshold),
            relationships: mockRelationships.filter(rel => rel.weight >= qualityThreshold)
          };

        case 'vector':
          return await createMockEmbedding(
            uuidv4(),
            {
              qualityScore: qualityThreshold,
              dimension: options.vectorDimension || MAX_VECTOR_DIMENSION
            }
          );

        default:
          throw new Error(`Unsupported mock type: ${type}`);
      }
    } catch (error) {
      logger.error('Mock data creation failed', {
        correlationId,
        type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Creates a batch of validated mock data items with memory optimization
   */
  @monitorPerformance
  async createMockBatch(
    type: typeof MOCK_TYPES[number],
    count: number = DEFAULT_BATCH_SIZE,
    config: Record<string, any> = {},
    options: MockGenerationOptions = {}
  ): Promise<any[]> {
    const correlationId = uuidv4();

    try {
      // Validate batch size
      if (count > MAX_BATCH_SIZE) {
        throw new Error(`Batch size exceeds maximum (${MAX_BATCH_SIZE})`);
      }

      const results = [];
      const batchSize = Math.min(count, MAX_BATCH_SIZE);

      switch (type) {
        case 'content':
          return await generateMockContentBatch(
            batchSize,
            options.contentType ? [options.contentType] : undefined
          );

        case 'graph':
          // Generate multiple graph variations
          for (let i = 0; i < batchSize; i++) {
            results.push({
              ...mockGraph,
              id: uuidv4(),
              nodes: mockNodes.map(node => ({
                ...node,
                id: uuidv4(),
                importance: Math.max(node.importance, this.config.qualityThreshold)
              })),
              relationships: mockRelationships.map(rel => ({
                ...rel,
                id: uuidv4(),
                weight: Math.max(rel.weight, this.config.qualityThreshold)
              }))
            });
          }
          return results;

        case 'vector':
          return await createMockEmbeddingBatch(
            batchSize,
            options.vectorDimension || MAX_VECTOR_DIMENSION
          );

        default:
          throw new Error(`Unsupported mock type: ${type}`);
      }
    } catch (error) {
      logger.error('Mock batch creation failed', {
        correlationId,
        type,
        count,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clears all generated mock data and resets factory state
   */
  @monitorPerformance
  async clearMockData(options: Record<string, any> = {}): Promise<void> {
    const correlationId = uuidv4();

    try {
      // Clear cache
      this.mockCache.clear();

      // Reset faker seed
      faker.seed(this.config.seed);

      logger.info('Mock data cleared successfully', {
        correlationId,
        cacheSize: this.mockCache.size
      });
    } catch (error) {
      logger.error('Mock data cleanup failed', {
        correlationId,
        error: error.message
      });
      throw error;
    }
  }
}

// Export factory instance and types
export default MockFactory;