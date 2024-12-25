/**
 * Topic API Client Module
 * @version 1.0.0
 * @description Provides enhanced API client methods for topic-related operations with 
 * comprehensive error handling, retry logic, circuit breaker, and caching capabilities.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import CircuitBreaker from 'circuit-breaker-js'; // ^0.5.0
import { apiConfig } from '../../config/api.config';
import { 
  Topic, 
  TopicFilter, 
  TopicResponse, 
  TopicListResponse,
  TopicConnectionResponse,
  isTopic,
  hasMinimumConnections
} from '../../types/topic.types';
import { 
  ApiError, 
  isApiError, 
  ApiRequestConfig,
  PaginatedResponse 
} from '../../types/api.types';

// Circuit breaker configuration
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
  timeout: apiConfig.timeout
});

// Create axios instance with default configuration
const axiosInstance: AxiosInstance = axios.create({
  baseURL: `${apiConfig.baseUrl}/topic`,
  timeout: apiConfig.timeout,
  headers: apiConfig.headers
});

// Configure retry logic
axiosRetry(axiosInstance, {
  retries: apiConfig.retryPolicy.maxRetries,
  retryDelay: (retryCount) => {
    return retryCount * apiConfig.retryPolicy.delay * apiConfig.retryPolicy.backoffFactor;
  },
  retryCondition: (error) => {
    return apiConfig.retryPolicy.retryableStatuses.includes(error.response?.status || 0);
  }
});

/**
 * Cache implementation for topic data
 */
const topicCache = new Map<string, { data: Topic; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Validates topic relevance score against required threshold
 */
const validateRelevanceScore = (topic: Topic): boolean => {
  return topic.relevanceScore >= 90; // 90% relevance threshold requirement
};

/**
 * Decorators for enhanced functionality
 */
const withCircuitBreaker = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    return circuitBreaker.run(() => originalMethod.apply(this, args));
  };
  return descriptor;
};

const withCache = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = async function (id: string, config?: ApiRequestConfig) {
    const cached = topicCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const result = await originalMethod.apply(this, [id, config]);
    topicCache.set(id, { data: result, timestamp: Date.now() });
    return result;
  };
  return descriptor;
};

/**
 * Topic API client implementation
 */
class TopicApiClient {
  /**
   * Search for topics based on provided filters
   * @decorator withCircuitBreaker
   */
  @withCircuitBreaker
  public async searchTopics(
    filter: TopicFilter,
    config?: AxiosRequestConfig
  ): Promise<PaginatedResponse<Topic>> {
    try {
      const response = await axiosInstance.get<TopicListResponse>('/search', {
        params: {
          ...filter,
          minRelevanceScore: Math.max(filter.minRelevanceScore, 90) // Enforce 90% threshold
        },
        ...config
      });

      const validTopics = response.data.data.filter(topic => 
        validateRelevanceScore(topic) && hasMinimumConnections(topic)
      );

      return {
        items: validTopics,
        total: validTopics.length,
        page: 1,
        size: validTopics.length,
        hasNext: false,
        hasPrevious: false
      };
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error('Failed to search topics');
    }
  }

  /**
   * Get topic by ID with caching
   * @decorator withCircuitBreaker
   * @decorator withCache
   */
  @withCircuitBreaker
  @withCache
  public async getTopic(id: string, config?: AxiosRequestConfig): Promise<Topic> {
    try {
      const response = await axiosInstance.get<TopicResponse>(`/${id}`, config);
      const topic = response.data.data;

      if (!isTopic(topic) || !validateRelevanceScore(topic)) {
        throw new Error('Invalid topic data received');
      }

      return topic;
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error(`Failed to get topic with ID: ${id}`);
    }
  }

  /**
   * Get related topics for a given topic ID
   * @decorator withCircuitBreaker
   */
  @withCircuitBreaker
  public async getRelatedTopics(
    id: string,
    config?: AxiosRequestConfig
  ): Promise<Topic[]> {
    try {
      const response = await axiosInstance.get<TopicListResponse>(
        `/related/${id}`,
        config
      );
      return response.data.data.filter(validateRelevanceScore);
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error(`Failed to get related topics for ID: ${id}`);
    }
  }

  /**
   * Get suggested topics based on user context
   * @decorator withCircuitBreaker
   */
  @withCircuitBreaker
  public async getSuggestedTopics(config?: AxiosRequestConfig): Promise<Topic[]> {
    try {
      const response = await axiosInstance.get<TopicListResponse>(
        '/suggested',
        config
      );
      return response.data.data.filter(validateRelevanceScore);
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error('Failed to get suggested topics');
    }
  }
}

// Export singleton instance
export const topicApi = new TopicApiClient();