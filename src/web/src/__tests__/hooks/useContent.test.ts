import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { useContent } from '../../hooks/useContent';
import { Content, ContentType, DEFAULT_CONTENT_FILTER, MIN_QUALITY_THRESHOLD } from '../../types/content.types';

// Test constants
const TEST_TIMEOUT = 5000;
const MOCK_DELAY = 300;

// Mock content data
const mockContent: Content[] = [
  {
    id: '1',
    topicId: 'topic1',
    type: ContentType.ARTICLE,
    title: 'Test Article',
    description: 'Test Description',
    sourceUrl: 'https://test.com/article1',
    qualityScore: 0.95,
    metadata: {
      author: 'Test Author',
      publisher: 'Test Publisher',
      publishDate: '2023-01-01T00:00:00Z',
      language: 'en',
      keywords: ['test', 'article'],
      contentSpecific: {}
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    analysisResults: {
      contentId: '1',
      qualityMetrics: {
        relevance: 0.95,
        authority: 0.9,
        freshness: 0.85,
        completeness: 0.92,
        readability: 0.88
      },
      analysisDate: '2023-01-01T00:00:00Z',
      version: '1.0.0'
    }
  }
];

// Mock Redux store
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: jest.fn((selector) => selector({ content: { items: [] } }))
}));

// Test wrapper setup
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="test-wrapper">{children}</div>
);

describe('useContent Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockDispatch.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Content Search Functionality', () => {
    it('should initialize with default filters', () => {
      const { result } = renderHook(() => useContent(), { wrapper });
      
      expect(result.current.filters).toEqual(DEFAULT_CONTENT_FILTER);
      expect(result.current.loading).toBeFalsy();
      expect(result.current.error).toBeNull();
      expect(result.current.content).toEqual([]);
    });

    it('should search content with specified filters', async () => {
      mockDispatch.mockResolvedValueOnce(mockContent);
      
      const { result } = renderHook(() => useContent(), { wrapper });
      
      await act(async () => {
        await result.current.searchContent(DEFAULT_CONTENT_FILTER);
      });

      expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'content/search',
        payload: expect.objectContaining({
          filters: DEFAULT_CONTENT_FILTER
        })
      }));
      expect(result.current.content).toEqual(mockContent);
    });

    it('should handle search errors gracefully', async () => {
      const errorMessage = 'Search failed';
      mockDispatch.mockRejectedValueOnce(new Error(errorMessage));
      
      const { result } = renderHook(() => useContent(), { wrapper });
      
      await act(async () => {
        await result.current.searchContent(DEFAULT_CONTENT_FILTER);
      });

      expect(result.current.error).toEqual(expect.objectContaining({
        code: 'SEARCH_ERROR',
        message: errorMessage
      }));
    });
  });

  describe('Content Quality Filtering', () => {
    it('should filter content based on quality threshold', async () => {
      const lowQualityContent = {
        ...mockContent[0],
        id: '2',
        qualityScore: 0.85
      };
      
      mockDispatch.mockResolvedValueOnce([...mockContent, lowQualityContent]);
      
      const { result } = renderHook(() => useContent({
        ...DEFAULT_CONTENT_FILTER,
        minQualityScore: MIN_QUALITY_THRESHOLD
      }), { wrapper });

      await act(async () => {
        await result.current.searchContent(result.current.filters);
      });

      expect(result.current.content.every(c => c.qualityScore >= MIN_QUALITY_THRESHOLD)).toBeTruthy();
    });
  });

  describe('Performance and Caching', () => {
    it('should cache search results when enabled', async () => {
      mockDispatch.mockResolvedValueOnce(mockContent);
      
      const { result } = renderHook(() => useContent(DEFAULT_CONTENT_FILTER, {
        cacheEnabled: true
      }), { wrapper });

      // First search
      await act(async () => {
        await result.current.searchContent(DEFAULT_CONTENT_FILTER);
      });

      const initialCacheHits = result.current.metrics.cacheHits;

      // Second search with same filters
      await act(async () => {
        await result.current.searchContent(DEFAULT_CONTENT_FILTER);
      });

      expect(result.current.metrics.cacheHits).toBe(initialCacheHits + 1);
      expect(mockDispatch).toHaveBeenCalledTimes(1);
    });

    it('should respect search debounce delay', async () => {
      const { result } = renderHook(() => useContent(), { wrapper });
      
      act(() => {
        result.current.searchContent(DEFAULT_CONTENT_FILTER);
        result.current.searchContent(DEFAULT_CONTENT_FILTER);
        result.current.searchContent(DEFAULT_CONTENT_FILTER);
      });

      jest.advanceTimersByTime(MOCK_DELAY);
      
      expect(mockDispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pagination Handling', () => {
    it('should handle pagination state correctly', async () => {
      const { result } = renderHook(() => useContent(DEFAULT_CONTENT_FILTER, {
        pageSize: 10
      }), { wrapper });

      expect(result.current.pagination).toEqual(expect.objectContaining({
        page: 1,
        pageSize: 10,
        hasNext: false,
        hasPrevious: false
      }));
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed requests when enabled', async () => {
      mockDispatch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockContent);

      const { result } = renderHook(() => useContent(DEFAULT_CONTENT_FILTER, {
        retryOnError: true
      }), { wrapper });

      await act(async () => {
        await result.current.searchContent(DEFAULT_CONTENT_FILTER);
      });

      jest.advanceTimersByTime(2000); // Wait for retry

      expect(mockDispatch).toHaveBeenCalledTimes(2);
      expect(result.current.content).toEqual(mockContent);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', async () => {
      const { result } = renderHook(() => useContent(DEFAULT_CONTENT_FILTER, {
        cacheEnabled: true
      }), { wrapper });

      await act(async () => {
        await result.current.searchContent(DEFAULT_CONTENT_FILTER);
        result.current.clearCache();
      });

      expect(result.current.metrics.cacheHits).toBe(0);
      expect(result.current.metrics.cacheMisses).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics when enabled', async () => {
      const { result } = renderHook(() => useContent(DEFAULT_CONTENT_FILTER, {
        performanceMetrics: true
      }), { wrapper });

      await act(async () => {
        await result.current.searchContent(DEFAULT_CONTENT_FILTER);
      });

      expect(result.current.metrics).toEqual(expect.objectContaining({
        searchTime: expect.any(Number),
        cacheHits: expect.any(Number),
        cacheMisses: expect.any(Number),
        errorCount: expect.any(Number),
        lastUpdated: expect.any(String)
      }));
    });
  });
});