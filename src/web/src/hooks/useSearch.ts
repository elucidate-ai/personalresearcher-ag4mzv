/**
 * useSearch Custom Hook
 * @version 1.0.0
 * @description Custom React hook for managing search functionality with debounced operations,
 * loading states, error handling, and performance optimizations for topic discovery
 * and content aggregation.
 */

import { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^9.0.0
import debounce from 'lodash/debounce'; // ^4.17.21
import axios, { CancelTokenSource } from 'axios'; // ^1.6.0

import { TopicFilter } from '../../types/topic.types';
import { topicApi } from '../../lib/api/topic.api';
import { topicActions } from '../../store/topic/topic.slice';

// Constants
const DEFAULT_DEBOUNCE_MS = 300;
const MIN_RELEVANCE_SCORE = 0.9; // 90% relevance threshold requirement
const CACHE_TTL_MS = 300000; // 5 minutes
const MAX_RETRIES = 3;

interface SearchCache {
  query: string;
  results: any[];
  timestamp: number;
}

interface SearchState {
  searchQuery: string;
  isLoading: boolean;
  results: any[];
  error: Error | null;
}

/**
 * Custom hook for managing search functionality
 * @param debounceMs - Debounce delay in milliseconds
 * @param minRelevanceScore - Minimum relevance score threshold (0-1)
 * @returns Search state and handlers
 */
export const useSearch = (
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
  minRelevanceScore: number = MIN_RELEVANCE_SCORE
) => {
  // State initialization
  const [state, setState] = useState<SearchState>({
    searchQuery: '',
    isLoading: false,
    results: [],
    error: null
  });

  // Redux setup
  const dispatch = useDispatch();

  // Refs for cleanup and caching
  const cancelTokenRef = useRef<CancelTokenSource>();
  const cacheRef = useRef<SearchCache>();
  const retryCountRef = useRef<number>(0);

  /**
   * Validates search results against minimum relevance threshold
   */
  const validateResults = useCallback((results: any[]) => {
    return results.filter(result => result.relevanceScore >= minRelevanceScore);
  }, [minRelevanceScore]);

  /**
   * Checks if cached results are still valid
   */
  const isCacheValid = useCallback((cache: SearchCache): boolean => {
    return (
      cache &&
      cache.timestamp &&
      Date.now() - cache.timestamp < CACHE_TTL_MS
    );
  }, []);

  /**
   * Creates the search filter with required parameters
   */
  const createSearchFilter = useCallback((query: string): TopicFilter => {
    return {
      searchQuery: query,
      minRelevanceScore: Math.max(minRelevanceScore, MIN_RELEVANCE_SCORE),
      contentTypes: ['VIDEO', 'ARTICLE', 'PODCAST', 'BOOK']
    };
  }, [minRelevanceScore]);

  /**
   * Handles search query changes with debouncing
   */
  const handleSearch = useCallback(async (query: string) => {
    try {
      // Cancel any pending requests
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('New search request initiated');
      }

      // Update search query state
      setState(prev => ({ ...prev, searchQuery: query, isLoading: true, error: null }));

      // Check cache first
      if (cacheRef.current && cacheRef.current.query === query && isCacheValid(cacheRef.current)) {
        setState(prev => ({
          ...prev,
          results: cacheRef.current!.results,
          isLoading: false
        }));
        return;
      }

      // Create new cancel token
      cancelTokenRef.current = axios.CancelToken.source();

      // Create search filter
      const filter = createSearchFilter(query);

      // Dispatch filter update
      dispatch(topicActions.setFilters(filter));

      // Perform search
      const results = await topicApi.searchTopics(filter, {
        cancelToken: cancelTokenRef.current.token
      });

      // Validate results
      const validResults = validateResults(results.items);

      // Update cache
      cacheRef.current = {
        query,
        results: validResults,
        timestamp: Date.now()
      };

      // Update state
      setState(prev => ({
        ...prev,
        results: validResults,
        isLoading: false,
        error: null
      }));

      // Reset retry count on success
      retryCountRef.current = 0;

    } catch (error) {
      if (axios.isCancel(error)) {
        return;
      }

      // Handle retries
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        await handleSearch(query);
        return;
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }));

      dispatch(topicActions.setError('Failed to perform search'));
    }
  }, [dispatch, validateResults, isCacheValid, createSearchFilter]);

  /**
   * Debounced search handler
   */
  const debouncedSearch = useCallback(
    debounce(handleSearch, debounceMs),
    [handleSearch, debounceMs]
  );

  /**
   * Clears search state and cache
   */
  const clearSearch = useCallback(() => {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('Search cleared');
    }

    setState({
      searchQuery: '',
      isLoading: false,
      results: [],
      error: null
    });

    cacheRef.current = undefined;
    retryCountRef.current = 0;

    dispatch(topicActions.clearFilters());
  }, [dispatch]);

  /**
   * Retry handler for failed searches
   */
  const retry = useCallback(() => {
    if (state.searchQuery) {
      retryCountRef.current = 0;
      handleSearch(state.searchQuery);
    }
  }, [state.searchQuery, handleSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('Component unmounted');
      }
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  return {
    searchQuery: state.searchQuery,
    isLoading: state.isLoading,
    results: state.results,
    error: state.error,
    handleSearch: debouncedSearch,
    clearSearch,
    retry
  };
};