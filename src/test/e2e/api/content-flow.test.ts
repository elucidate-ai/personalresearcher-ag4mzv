// External dependencies with versions
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'; // v29.x
import supertest from 'supertest'; // v6.x

// Internal imports
import { TestClient } from '../../utils/test-client';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';
import { mockContentItems } from '../../fixtures/content.json';
import { ContentType } from '../../../backend/api-gateway/src/types';

// Constants for test configuration
const TEST_TIMEOUT = 60000; // 60 seconds
const QUALITY_THRESHOLD = 0.9;
const PROCESSING_TIME_LIMIT = 5000; // 5 seconds
const CONCURRENT_REQUESTS = 5;

// Initialize test client
let testClient: TestClient;

beforeAll(async () => {
  // Setup test environment with monitoring enabled
  await setupTestEnvironment({
    mockData: true,
    timeoutMs: TEST_TIMEOUT
  }, true);

  // Initialize test client with retry configuration
  testClient = new TestClient({
    retryConfig: {
      maxRetries: 3,
      delay: 1000
    }
  });
});

afterAll(async () => {
  // Cleanup test environment and resources
  await teardownTestEnvironment(true);
  await testClient.cleanup();
});

describe('Content Discovery Flow', () => {
  test('should discover content from multiple sources within time limit', async () => {
    // Prepare test data
    const topicId = 'a67e8400-e29b-41d4-a716-446655441111';
    const contentTypes = [ContentType.VIDEO, ContentType.ARTICLE, ContentType.PODCAST];

    // Start performance timer
    const startTime = Date.now();

    // Submit content discovery request
    const response = await testClient.post('/api/v1/content/discover', {
      topic_id: topicId,
      content_types: contentTypes,
      min_quality_score: QUALITY_THRESHOLD,
      max_results: 10
    });

    // End performance timer
    const processingTime = Date.now() - startTime;

    // Verify response structure
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data.items)).toBe(true);

    // Validate content items
    for (const item of response.data.items) {
      // Verify content type
      expect(contentTypes).toContain(item.type);

      // Verify quality score meets threshold
      expect(item.quality_score).toBeGreaterThanOrEqual(QUALITY_THRESHOLD);

      // Verify required fields
      expect(item.id).toBeDefined();
      expect(item.title).toBeDefined();
      expect(item.description).toBeDefined();
      expect(item.source_url).toBeDefined();
      expect(item.metadata).toBeDefined();

      // Verify type-specific metadata
      switch (item.type) {
        case ContentType.VIDEO:
          expect(item.metadata.duration).toBeDefined();
          expect(item.metadata.platform).toBeDefined();
          break;
        case ContentType.ARTICLE:
          expect(item.metadata.author).toBeDefined();
          expect(item.metadata.word_count).toBeDefined();
          break;
        case ContentType.PODCAST:
          expect(item.metadata.duration).toBeDefined();
          expect(item.metadata.episode_number).toBeDefined();
          break;
      }
    }

    // Verify processing time is within limit
    expect(processingTime).toBeLessThanOrEqual(PROCESSING_TIME_LIMIT);
  }, TEST_TIMEOUT);

  test('should handle concurrent content discovery requests', async () => {
    // Prepare multiple test requests
    const requests = Array(CONCURRENT_REQUESTS).fill(null).map((_, index) => ({
      topic_id: `test-topic-${index}`,
      content_types: [ContentType.VIDEO, ContentType.ARTICLE],
      min_quality_score: QUALITY_THRESHOLD,
      max_results: 5
    }));

    // Track start time for performance monitoring
    const startTime = Date.now();

    // Submit requests concurrently
    const responses = await Promise.all(
      requests.map(request => 
        testClient.post('/api/v1/content/discover', request)
      )
    );

    // Calculate total processing time
    const totalProcessingTime = Date.now() - startTime;

    // Verify all responses
    responses.forEach((response, index) => {
      expect(response.success).toBe(true);
      expect(response.data.items.length).toBeGreaterThan(0);
      
      // Verify data consistency
      response.data.items.forEach(item => {
        expect(item.quality_score).toBeGreaterThanOrEqual(QUALITY_THRESHOLD);
        expect([ContentType.VIDEO, ContentType.ARTICLE]).toContain(item.type);
      });
    });

    // Verify average processing time per request
    const avgProcessingTime = totalProcessingTime / CONCURRENT_REQUESTS;
    expect(avgProcessingTime).toBeLessThanOrEqual(PROCESSING_TIME_LIMIT);
  }, TEST_TIMEOUT);
});

describe('Content Quality Validation', () => {
  test('should filter and rank content by quality score', async () => {
    const response = await testClient.post('/api/v1/content/discover', {
      topic_id: 'test-topic-quality',
      content_types: [ContentType.ARTICLE],
      min_quality_score: QUALITY_THRESHOLD,
      max_results: 10,
      sort_by: 'quality_score',
      sort_order: 'desc'
    });

    expect(response.success).toBe(true);
    expect(response.data.items.length).toBeGreaterThan(0);

    // Verify quality scores are properly ranked
    let previousScore = 1.0;
    response.data.items.forEach(item => {
      expect(item.quality_score).toBeGreaterThanOrEqual(QUALITY_THRESHOLD);
      expect(item.quality_score).toBeLessThanOrEqual(previousScore);
      previousScore = item.quality_score;
    });
  });

  test('should handle error cases and edge conditions', async () => {
    // Test invalid quality threshold
    const invalidQualityResponse = await testClient.post('/api/v1/content/discover', {
      topic_id: 'test-topic-invalid',
      content_types: [ContentType.VIDEO],
      min_quality_score: 1.5, // Invalid score > 1.0
      max_results: 10
    });

    expect(invalidQualityResponse.success).toBe(false);
    expect(invalidQualityResponse.error).toBeDefined();

    // Test invalid content type
    const invalidTypeResponse = await testClient.post('/api/v1/content/discover', {
      topic_id: 'test-topic-invalid',
      content_types: ['INVALID_TYPE'],
      min_quality_score: QUALITY_THRESHOLD,
      max_results: 10
    });

    expect(invalidTypeResponse.success).toBe(false);
    expect(invalidTypeResponse.error).toBeDefined();

    // Test missing required fields
    const missingFieldsResponse = await testClient.post('/api/v1/content/discover', {
      content_types: [ContentType.ARTICLE]
      // Missing topic_id
    });

    expect(missingFieldsResponse.success).toBe(false);
    expect(missingFieldsResponse.error).toBeDefined();
  });
});