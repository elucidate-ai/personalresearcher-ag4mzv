/**
 * Content Service Test Suite
 * @version 1.0.0
 * @description Comprehensive test suite for ContentService functionality including
 * content discovery, caching, filtering, quality assessment, and analysis.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ContentService } from '../../services/content.service';
import { mockContent, generateMockContentList } from '../../../test/mocks/data/content.mock';
import { Content, ContentType } from '../../types/content.types';

// Constants for testing
const MOCK_CONTENT_ID = 'test-content-123';
const MOCK_TOPIC_ID = 'test-topic-456';
const CACHE_KEY_PREFIX = 'content-test-';
const PERFORMANCE_THRESHOLD_MS = 5000; // 5 seconds performance requirement
const QUALITY_SCORE_THRESHOLD = 0.9; // 90% quality threshold

describe('ContentService', () => {
  let contentService: ContentService;
  let mockStorageService: any;
  let mockContentApi: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock storage service
    mockStorageService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      keys: jest.fn().mockResolvedValue([])
    };

    // Mock content API
    mockContentApi = {
      getContentById: jest.fn(),
      getContentByTopic: jest.fn(),
      getContentAnalysis: jest.fn()
    };

    // Initialize service with mocks
    contentService = new ContentService();
    (contentService as any).storageService = mockStorageService;
    (contentService as any).contentApi = mockContentApi;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchContentWithCache', () => {
    test('should return cached content when available', async () => {
      // Setup mock cached data
      const mockCachedContent = generateMockContentList(5);
      const cacheKey = `${CACHE_KEY_PREFIX}${MOCK_TOPIC_ID}`;
      mockStorageService.get.mockResolvedValue(JSON.stringify({
        data: mockCachedContent,
        timestamp: Date.now()
      }));

      // Execute search
      const startTime = Date.now();
      const result = await contentService.searchContentWithCache(MOCK_TOPIC_ID, {
        types: [ContentType.ARTICLE],
        minQualityScore: QUALITY_SCORE_THRESHOLD,
        dateRange: { start: undefined, end: undefined },
        keywords: [],
        languages: ['en']
      });

      // Verify cache hit and performance
      expect(result).toEqual(mockCachedContent);
      expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(mockStorageService.get).toHaveBeenCalledWith(expect.stringContaining(MOCK_TOPIC_ID));
    });

    test('should fetch and cache new content when cache is empty', async () => {
      // Setup mock API response
      const mockApiContent = generateMockContentList(5);
      mockContentApi.getContentByTopic.mockResolvedValue(mockApiContent);
      mockStorageService.get.mockResolvedValue(null);

      // Execute search
      const result = await contentService.searchContentWithCache(MOCK_TOPIC_ID, {
        types: [ContentType.ARTICLE],
        minQualityScore: QUALITY_SCORE_THRESHOLD,
        dateRange: { start: undefined, end: undefined },
        keywords: [],
        languages: ['en']
      });

      // Verify API call and caching
      expect(result).toEqual(mockApiContent);
      expect(mockContentApi.getContentByTopic).toHaveBeenCalled();
      expect(mockStorageService.set).toHaveBeenCalled();
    });

    test('should filter content below quality threshold', async () => {
      // Generate mixed quality content
      const mixedContent = [
        { ...mockContent, qualityScore: 0.95 },
        { ...mockContent, qualityScore: 0.85 }, // Below threshold
        { ...mockContent, qualityScore: 0.92 }
      ];
      mockContentApi.getContentByTopic.mockResolvedValue(mixedContent);
      mockStorageService.get.mockResolvedValue(null);

      // Execute search
      const result = await contentService.searchContentWithCache(MOCK_TOPIC_ID, {
        types: [ContentType.ARTICLE],
        minQualityScore: QUALITY_SCORE_THRESHOLD,
        dateRange: { start: undefined, end: undefined },
        keywords: [],
        languages: ['en']
      });

      // Verify filtering
      expect(result.length).toBe(2);
      expect(result.every(content => content.qualityScore >= QUALITY_SCORE_THRESHOLD)).toBe(true);
    });
  });

  describe('getContentDetails', () => {
    test('should return cached content details when available', async () => {
      // Setup mock cached content
      mockStorageService.get.mockResolvedValue(JSON.stringify({
        data: mockContent,
        timestamp: Date.now()
      }));

      // Execute request
      const result = await contentService.getContentDetails(MOCK_CONTENT_ID);

      // Verify cache hit
      expect(result).toEqual(mockContent);
      expect(mockStorageService.get).toHaveBeenCalledWith(expect.stringContaining(MOCK_CONTENT_ID));
      expect(mockContentApi.getContentById).not.toHaveBeenCalled();
    });

    test('should fetch and cache new content details when cache is empty', async () => {
      // Setup mock API response
      mockContentApi.getContentById.mockResolvedValue(mockContent);
      mockStorageService.get.mockResolvedValue(null);

      // Execute request
      const result = await contentService.getContentDetails(MOCK_CONTENT_ID);

      // Verify API call and caching
      expect(result).toEqual(mockContent);
      expect(mockContentApi.getContentById).toHaveBeenCalledWith(MOCK_CONTENT_ID);
      expect(mockStorageService.set).toHaveBeenCalled();
    });

    test('should throw error for content below quality threshold', async () => {
      // Setup mock low quality content
      const lowQualityContent = { ...mockContent, qualityScore: 0.85 };
      mockContentApi.getContentById.mockResolvedValue(lowQualityContent);
      mockStorageService.get.mockResolvedValue(null);

      // Verify error handling
      await expect(contentService.getContentDetails(MOCK_CONTENT_ID))
        .rejects.toThrow('Content does not meet quality threshold');
    });
  });

  describe('getContentAnalysis', () => {
    test('should return cached analysis when available', async () => {
      // Setup mock cached analysis
      const mockAnalysis = mockContent.analysisResults;
      mockStorageService.get.mockResolvedValue(JSON.stringify({
        data: mockAnalysis,
        timestamp: Date.now()
      }));

      // Execute request
      const result = await contentService.getContentAnalysis(MOCK_CONTENT_ID);

      // Verify cache hit
      expect(result).toEqual(mockAnalysis);
      expect(mockStorageService.get).toHaveBeenCalledWith(expect.stringContaining(MOCK_CONTENT_ID));
      expect(mockContentApi.getContentAnalysis).not.toHaveBeenCalled();
    });

    test('should fetch and cache new analysis when cache is empty', async () => {
      // Setup mock API response
      const mockAnalysis = mockContent.analysisResults;
      mockContentApi.getContentAnalysis.mockResolvedValue(mockAnalysis);
      mockStorageService.get.mockResolvedValue(null);

      // Execute request
      const result = await contentService.getContentAnalysis(MOCK_CONTENT_ID);

      // Verify API call and caching
      expect(result).toEqual(mockAnalysis);
      expect(mockContentApi.getContentAnalysis).toHaveBeenCalledWith(MOCK_CONTENT_ID);
      expect(mockStorageService.set).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    test('should handle cache cleanup correctly', async () => {
      // Setup expired cache entries
      const expiredTimestamp = Date.now() - (3600000 * 2); // 2 hours old
      mockStorageService.keys.mockResolvedValue(['key1', 'key2']);
      mockStorageService.get.mockImplementation((key) => JSON.stringify({
        data: mockContent,
        timestamp: expiredTimestamp
      }));

      // Trigger cache cleanup
      await (contentService as any).cleanupCache();

      // Verify cleanup
      expect(mockStorageService.delete).toHaveBeenCalledTimes(2);
    });

    test('should handle cache errors gracefully', async () => {
      // Setup storage error
      mockStorageService.get.mockRejectedValue(new Error('Storage error'));

      // Execute request
      const result = await contentService.searchContentWithCache(MOCK_TOPIC_ID, {
        types: [ContentType.ARTICLE],
        minQualityScore: QUALITY_SCORE_THRESHOLD,
        dateRange: { start: undefined, end: undefined },
        keywords: [],
        languages: ['en']
      });

      // Verify error handling
      expect(mockContentApi.getContentByTopic).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});