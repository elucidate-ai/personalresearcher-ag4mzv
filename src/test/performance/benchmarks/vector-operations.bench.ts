/**
 * Enterprise-grade performance benchmark suite for vector operations.
 * Tests core vector service functionalities with comprehensive resource monitoring.
 * 
 * @version 1.0.0
 * External Dependencies:
 * - @jest/benchmark@29.0.0 - Jest benchmarking utilities
 * - @faker-js/faker@8.0.0 - Test data generation
 */

import { benchmark } from '@jest/benchmark';
import { faker } from '@faker-js/faker';
import { VectorIndexer } from '../../backend/vector-service/app/core/vector_indexer';
import { SimilarityCalculator } from '../../backend/vector-service/app/core/similarity_calculator';
import { EmbeddingGenerator } from '../../backend/vector-service/app/core/embedding_generator';

// Constants for benchmark configuration
const TEST_CONTENT_SIZE = 1000;
const BATCH_SIZES = [32, 64, 128, 256];
const VECTOR_DIMENSION = 768;
const SIMILARITY_METRICS = ["cosine", "euclidean", "dot_product"];
const CONCURRENCY_LEVELS = [1, 4, 8, 16];
const MEMORY_THRESHOLDS = { warning: 85, critical: 95 };
const ACCURACY_THRESHOLD = 0.9;
const PERFORMANCE_SLO = 5000; // 5 seconds in ms

// Resource monitoring utilities
const monitorResources = () => {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed / 1024 / 1024,
    heapTotal: usage.heapTotal / 1024 / 1024,
    external: usage.external / 1024 / 1024,
    timestamp: Date.now()
  };
};

/**
 * Benchmarks embedding generation performance with resource monitoring
 */
@benchmark.suite('Embedding Generation')
@benchmark.warmup(3)
export async function benchmarkEmbeddingGeneration(): Promise<void> {
  // Initialize test data
  const testContent = Array.from({ length: TEST_CONTENT_SIZE }, () => ({
    content: faker.lorem.paragraph(),
    contentId: faker.string.uuid(),
    qualityScore: faker.number.float({ min: 0, max: 1 }),
    metadata: {
      source: faker.internet.url(),
      timestamp: faker.date.recent().toISOString(),
      contentType: faker.helpers.arrayElement(['article', 'video', 'podcast'])
    }
  }));

  // Initialize embedding generator
  const generator = new EmbeddingGenerator({
    modelName: "sentence-transformers/all-mpnet-base-v2",
    batchSize: Math.max(...BATCH_SIZES),
    useGpu: true
  });

  // Single embedding generation benchmark
  await benchmark.measure('Single Embedding Generation', async () => {
    const startResources = monitorResources();
    const { content, contentId, qualityScore, metadata } = testContent[0];
    
    const embedding = await generator.generate_embedding(
      content,
      contentId,
      qualityScore,
      metadata
    );

    const endResources = monitorResources();
    const memoryDelta = endResources.heapUsed - startResources.heapUsed;

    benchmark.assert(embedding.vector.length === VECTOR_DIMENSION);
    benchmark.assert(memoryDelta < MEMORY_THRESHOLDS.warning);
  });

  // Batch embedding generation benchmarks
  for (const batchSize of BATCH_SIZES) {
    await benchmark.measure(`Batch Embedding Generation (size=${batchSize})`, async () => {
      const startResources = monitorResources();
      const batchContent = testContent.slice(0, batchSize);
      
      const embeddings = await generator.generate_batch_embeddings(
        batchContent.map(({ content, contentId, qualityScore, metadata }) => 
          [content, contentId, qualityScore, metadata]
        )
      );

      const endResources = monitorResources();
      const processingTime = endResources.timestamp - startResources.timestamp;
      const avgTimePerItem = processingTime / batchSize;

      benchmark.assert(embeddings.length === batchSize);
      benchmark.assert(avgTimePerItem <= PERFORMANCE_SLO / batchSize);
    });
  }
}

/**
 * Benchmarks vector indexing operations with concurrency testing
 */
@benchmark.suite('Vector Indexing')
@benchmark.concurrent
export async function benchmarkVectorIndexing(): Promise<void> {
  // Initialize test vectors
  const testVectors = Array.from({ length: TEST_CONTENT_SIZE }, () => ({
    vector: new Float32Array(VECTOR_DIMENSION).map(() => faker.number.float({ min: -1, max: 1 })),
    contentId: faker.string.uuid(),
    qualityScore: faker.number.float({ min: 0, max: 1 }),
    metadata: {
      version: '1.0',
      timestamp: Date.now()
    }
  }));

  // Initialize vector indexer
  const indexer = new VectorIndexer();

  // Single vector indexing benchmark
  await benchmark.measure('Single Vector Indexing', async () => {
    const { vector, contentId, qualityScore, metadata } = testVectors[0];
    const startTime = Date.now();
    
    const success = await indexer.index_content(
      vector,
      contentId,
      qualityScore,
      metadata
    );

    const processingTime = Date.now() - startTime;
    benchmark.assert(success);
    benchmark.assert(processingTime <= PERFORMANCE_SLO);
  });

  // Concurrent batch indexing benchmarks
  for (const concurrencyLevel of CONCURRENCY_LEVELS) {
    await benchmark.measure(`Concurrent Batch Indexing (workers=${concurrencyLevel})`, async () => {
      const batchSize = Math.min(TEST_CONTENT_SIZE, 100 * concurrencyLevel);
      const batchVectors = testVectors.slice(0, batchSize);
      
      const results = await Promise.all(
        Array.from({ length: concurrencyLevel }, async (_, i) => {
          const workerVectors = batchVectors.slice(
            (i * batchSize) / concurrencyLevel,
            ((i + 1) * batchSize) / concurrencyLevel
          );
          return indexer.async_batch_index_content(
            workerVectors.map(v => [v.vector, v.contentId, v.qualityScore, v.metadata])
          );
        })
      );

      const successRate = results.flat().filter(Boolean).length / batchSize;
      benchmark.assert(successRate >= ACCURACY_THRESHOLD);
    });
  }
}

/**
 * Benchmarks similarity calculation performance with accuracy validation
 */
@benchmark.suite('Similarity Calculations')
@benchmark.threshold(0.9)
export async function benchmarkSimilarityCalculations(): Promise<void> {
  // Initialize test vectors
  const vectorPairs = Array.from({ length: TEST_CONTENT_SIZE }, () => ({
    vector1: new Float32Array(VECTOR_DIMENSION).map(() => faker.number.float({ min: -1, max: 1 })),
    vector2: new Float32Array(VECTOR_DIMENSION).map(() => faker.number.float({ min: -1, max: 1 }))
  }));

  // Test different similarity metrics
  for (const metric of SIMILARITY_METRICS) {
    const calculator = new SimilarityCalculator({ metric });

    await benchmark.measure(`Single Similarity Calculation (${metric})`, async () => {
      const { vector1, vector2 } = vectorPairs[0];
      const startTime = Date.now();
      
      const similarity = await calculator.calculate_similarity(vector1, vector2);
      const processingTime = Date.now() - startTime;

      benchmark.assert(similarity >= 0 && similarity <= 1);
      benchmark.assert(processingTime <= PERFORMANCE_SLO / 100); // Expect faster for single calc
    });

    // Batch similarity calculations
    for (const batchSize of BATCH_SIZES) {
      await benchmark.measure(`Batch Similarity Calculation (${metric}, size=${batchSize})`, async () => {
        const batchPairs = vectorPairs
          .slice(0, batchSize)
          .map(({ vector1, vector2 }) => [vector1, vector2]);
        
        const startTime = Date.now();
        const similarities = await calculator.batch_similarity(batchPairs);
        const processingTime = Date.now() - startTime;
        const avgTimePerPair = processingTime / batchSize;

        benchmark.assert(similarities.length === batchSize);
        benchmark.assert(avgTimePerPair <= PERFORMANCE_SLO / batchSize);
      });
    }
  }
}