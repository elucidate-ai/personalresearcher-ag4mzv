/**
 * useContent Custom Hook
 * Version: 1.0.0
 * 
 * Enhanced React hook for managing content operations with performance optimization,
 * caching, and error handling. Provides abstraction layer between UI components
 * and content management functionality.
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDebounce } from 'use-debounce';
import { 
  Content, 
  ContentFilter, 
  ContentType,
  MIN_QUALITY_THRESHOLD,
  DEFAULT_CONTENT_FILTER,
  isContent 
} from '../types/content.types';

// Constants for performance optimization
const DEBOUNCE_DELAY = 300; // ms
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;

// Interface for hook options
interface ContentOptions {
  cacheEnabled?: boolean;
  retryOnError?: boolean;
  performanceMetrics?: boolean;
  pageSize?: number;
}

// Interface for pagination state
interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Interface for performance metrics
interface ContentMetrics {
  searchTime: number;
  cacheHits: number;
  cacheMisses: number;
  errorCount: number;
  lastUpdated: string;
}

// Interface for content errors
interface ContentError {
  code: string;
  message: string;
  retryCount: number;
}

// Interface for search options
interface SearchOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

// Cache implementation
interface CacheEntry {
  data: Content[];
  timestamp: number;
  filter: ContentFilter;
}

const contentCache = new Map<string, CacheEntry>();

/**
 * Custom hook for managing content operations with enhanced functionality
 * @param initialFilters - Initial content filter settings
 * @param options - Hook configuration options
 */
export function useContent(
  initialFilters: ContentFilter = DEFAULT_CONTENT_FILTER,
  options: ContentOptions = {}
) {
  // Redux hooks
  const dispatch = useDispatch();
  const contentState = useSelector((state: any) => state.content);

  // Local state
  const [filters, setFilters] = useState<ContentFilter>(initialFilters);
  const [content, setContent] = useState<Content[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ContentError | null>(null);
  const [metrics, setMetrics] = useState<ContentMetrics>({
    searchTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errorCount: 0,
    lastUpdated: new Date().toISOString()
  });

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: options.pageSize || 10,
    total: 0,
    hasNext: false,
    hasPrevious: false
  });

  // Debounced search function
  const [debouncedSearch] = useDebounce(
    (filters: ContentFilter) => searchContent(filters),
    DEBOUNCE_DELAY
  );

  /**
   * Generate cache key from filters
   */
  const getCacheKey = useCallback((filters: ContentFilter): string => {
    return JSON.stringify({
      types: filters.types.sort(),
      minQualityScore: filters.minQualityScore,
      dateRange: filters.dateRange,
      sources: filters.sources.sort()
    });
  }, []);

  /**
   * Check if cache entry is valid
   */
  const isCacheValid = useCallback((entry: CacheEntry): boolean => {
    return Date.now() - entry.timestamp < CACHE_DURATION;
  }, []);

  /**
   * Search content with caching and error handling
   */
  const searchContent = useCallback(async (
    searchFilters: ContentFilter,
    searchOptions: SearchOptions = {}
  ): Promise<void> => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);

    try {
      const cacheKey = getCacheKey(searchFilters);

      // Check cache if enabled and not forcing refresh
      if (options.cacheEnabled && !searchOptions.forceRefresh) {
        const cachedEntry = contentCache.get(cacheKey);
        if (cachedEntry && isCacheValid(cachedEntry)) {
          setContent(cachedEntry.data);
          setMetrics(prev => ({
            ...prev,
            cacheHits: prev.cacheHits + 1,
            searchTime: Date.now() - startTime,
            lastUpdated: new Date().toISOString()
          }));
          setLoading(false);
          return;
        }
      }

      // Fetch content from API
      const response = await dispatch({
        type: 'content/search',
        payload: {
          filters: searchFilters,
          pagination: {
            page: pagination.page,
            pageSize: pagination.pageSize
          },
          signal: searchOptions.signal
        }
      });

      // Validate response
      if (Array.isArray(response) && response.every(isContent)) {
        setContent(response);
        
        // Update cache if enabled
        if (options.cacheEnabled) {
          contentCache.set(cacheKey, {
            data: response,
            timestamp: Date.now(),
            filter: searchFilters
          });
        }

        setMetrics(prev => ({
          ...prev,
          cacheMisses: prev.cacheMisses + 1,
          searchTime: Date.now() - startTime,
          lastUpdated: new Date().toISOString()
        }));
      }
    } catch (err) {
      const errorCount = metrics.errorCount + 1;
      setError({
        code: 'SEARCH_ERROR',
        message: err instanceof Error ? err.message : 'Search failed',
        retryCount: errorCount
      });

      // Implement retry logic
      if (options.retryOnError && errorCount <= MAX_RETRIES) {
        setTimeout(() => {
          searchContent(searchFilters, searchOptions);
        }, Math.pow(2, errorCount) * 1000);
      }

      setMetrics(prev => ({
        ...prev,
        errorCount,
        lastUpdated: new Date().toISOString()
      }));
    } finally {
      setLoading(false);
    }
  }, [dispatch, options, pagination, metrics, getCacheKey, isCacheValid]);

  /**
   * Get content by ID
   */
  const getContentById = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await dispatch({
        type: 'content/getById',
        payload: { id }
      });

      if (isContent(response)) {
        setSelectedContent(response);
      }
    } catch (err) {
      setError({
        code: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Failed to fetch content',
        retryCount: 0
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Clear cache
   */
  const clearCache = useCallback((): void => {
    contentCache.clear();
    setMetrics(prev => ({
      ...prev,
      cacheHits: 0,
      cacheMisses: 0,
      lastUpdated: new Date().toISOString()
    }));
  }, []);

  /**
   * Reset filters to default
   */
  const resetFilters = useCallback((): void => {
    setFilters(DEFAULT_CONTENT_FILTER);
  }, []);

  // Effect to update search when filters change
  useEffect(() => {
    const controller = new AbortController();
    debouncedSearch(filters);
    return () => controller.abort();
  }, [filters, debouncedSearch]);

  // Memoized return value
  return useMemo(() => ({
    content,
    selectedContent,
    loading,
    error,
    filters,
    metrics,
    pagination,
    searchContent,
    getContentById,
    clearCache,
    resetFilters
  }), [
    content,
    selectedContent,
    loading,
    error,
    filters,
    metrics,
    pagination,
    searchContent,
    getContentById,
    clearCache,
    resetFilters
  ]);
}

export type UseContentReturn = ReturnType<typeof useContent>;