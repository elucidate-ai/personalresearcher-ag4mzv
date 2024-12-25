/**
 * Topic Management Hook
 * @version 1.0.0
 * @description Custom React hook for managing topic-related operations with comprehensive
 * error handling, loading states, and relevance validation to support content discovery
 * and knowledge organization requirements.
 */

import { useCallback, useEffect, useState } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^9.0.0
import debounce from 'lodash/debounce'; // ^4.17.21

import { Topic, TopicFilter } from '../types/topic.types';
import {
  searchTopics,
  getTopicById,
  getRelatedTopics,
  selectTopics,
  selectSelectedTopic,
  selectLoadingStates,
  selectErrors,
  selectRequestStatus,
  clearTopics,
  clearSelectedTopic,
  clearRelatedTopics,
  resetErrors
} from '../store/topic/topic.slice';

// Constants
const MINIMUM_RELEVANCE_SCORE = 90; // 90% relevance threshold requirement
const DEBOUNCE_DELAY = 300; // milliseconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // milliseconds

// Types
interface UseTopicReturn {
  // State
  topics: Topic[];
  currentTopic: Topic | null;
  loading: {
    search: boolean;
    details: boolean;
    related: boolean;
  };
  error: {
    search: string | null;
    details: string | null;
    related: string | null;
  };
  requestStatus: {
    retryCount: number;
    lastRetryTimestamp: number;
  };

  // Actions
  searchTopics: (filter: TopicFilter) => Promise<void>;
  getTopicDetails: (id: string) => Promise<void>;
  getRelatedTopics: (id: string) => Promise<void>;
  clearTopics: () => void;
  clearCurrentTopic: () => void;
  clearRelated: () => void;
  resetAllErrors: () => void;
  retryOperation: (operationType: 'search' | 'details' | 'related') => Promise<void>;
}

/**
 * Custom hook for managing topic operations with enhanced error handling and loading states
 */
export const useTopic = (): UseTopicReturn => {
  const dispatch = useDispatch();

  // Selectors
  const topics = useSelector(selectTopics);
  const currentTopic = useSelector(selectSelectedTopic);
  const loadingStates = useSelector(selectLoadingStates);
  const errors = useSelector(selectErrors);
  const requestStatus = useSelector(selectRequestStatus);

  // Local state for retry management
  const [lastOperation, setLastOperation] = useState<{
    type: 'search' | 'details' | 'related';
    params: any;
  } | null>(null);

  /**
   * Validates topic filter to ensure minimum relevance score requirement
   */
  const validateTopicFilter = useCallback((filter: TopicFilter): TopicFilter => {
    return {
      ...filter,
      minRelevanceScore: Math.max(filter.minRelevanceScore, MINIMUM_RELEVANCE_SCORE)
    };
  }, []);

  /**
   * Debounced search implementation to prevent excessive API calls
   */
  const debouncedSearch = useCallback(
    debounce(async (filter: TopicFilter) => {
      try {
        const validatedFilter = validateTopicFilter(filter);
        await dispatch(searchTopics(validatedFilter)).unwrap();
      } catch (error) {
        console.error('Search operation failed:', error);
      }
    }, DEBOUNCE_DELAY),
    [dispatch, validateTopicFilter]
  );

  /**
   * Enhanced topic search with error handling
   */
  const handleTopicSearch = useCallback(async (filter: TopicFilter) => {
    setLastOperation({ type: 'search', params: filter });
    await debouncedSearch(filter);
  }, [debouncedSearch]);

  /**
   * Enhanced topic details fetch with error handling
   */
  const handleGetTopicDetails = useCallback(async (id: string) => {
    setLastOperation({ type: 'details', params: id });
    try {
      await dispatch(getTopicById(id)).unwrap();
    } catch (error) {
      console.error('Failed to fetch topic details:', error);
    }
  }, [dispatch]);

  /**
   * Enhanced related topics fetch with error handling
   */
  const handleGetRelatedTopics = useCallback(async (id: string) => {
    setLastOperation({ type: 'related', params: id });
    try {
      await dispatch(getRelatedTopics(id)).unwrap();
    } catch (error) {
      console.error('Failed to fetch related topics:', error);
    }
  }, [dispatch]);

  /**
   * Retry mechanism for failed operations
   */
  const handleRetryOperation = useCallback(async (operationType: 'search' | 'details' | 'related') => {
    if (!lastOperation || lastOperation.type !== operationType || requestStatus.retryCount >= MAX_RETRIES) {
      return;
    }

    const delay = RETRY_DELAY * Math.pow(2, requestStatus.retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));

    switch (operationType) {
      case 'search':
        await handleTopicSearch(lastOperation.params);
        break;
      case 'details':
        await handleGetTopicDetails(lastOperation.params);
        break;
      case 'related':
        await handleGetRelatedTopics(lastOperation.params);
        break;
    }
  }, [lastOperation, requestStatus.retryCount, handleTopicSearch, handleGetTopicDetails, handleGetRelatedTopics]);

  /**
   * Cleanup effect
   */
  useEffect(() => {
    return () => {
      dispatch(clearTopics());
      dispatch(clearSelectedTopic());
      dispatch(clearRelatedTopics());
      dispatch(resetErrors());
    };
  }, [dispatch]);

  return {
    // State
    topics,
    currentTopic,
    loading: loadingStates,
    error: errors,
    requestStatus,

    // Actions
    searchTopics: handleTopicSearch,
    getTopicDetails: handleGetTopicDetails,
    getRelatedTopics: handleGetRelatedTopics,
    clearTopics: () => dispatch(clearTopics()),
    clearCurrentTopic: () => dispatch(clearSelectedTopic()),
    clearRelated: () => dispatch(clearRelatedTopics()),
    resetAllErrors: () => dispatch(resetErrors()),
    retryOperation: handleRetryOperation
  };
};