/**
 * Content API Client Module
 * @version 1.0.0
 * @description Enhanced API client for content-related operations with comprehensive
 * security, validation, monitoring, and error handling capabilities.
 */

import { AxiosInstance } from 'axios'; // ^1.6.0
import rateLimit from 'axios-rate-limit'; // ^1.3.0
import { Content, ContentFilter, isContent } from '../../types/content.types';
import { createApiRequest } from '../../utils/api.utils';
import { apiConfig } from '../../config/api.config';
import { replaceUrlParams } from '../../constants/api.constants';

// Constants for content operations
const QUALITY_THRESHOLD = 0.9; // 90% relevance threshold requirement
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 5000;

/**
 * Validates content quality score against threshold
 * @param score - Quality score to validate
 * @returns Boolean indicating if score meets quality threshold
 */
export const validateQualityScore = (score: number): boolean => {
  return typeof score === 'number' && !isNaN(score) && score >= QUALITY_THRESHOLD;
};

/**
 * Enhanced API client class for content operations with security, validation, and monitoring
 */
export class ContentApi {
  private readonly apiClient: AxiosInstance;
  private readonly metrics: any; // Type would be defined by metrics collector

  /**
   * Initializes the content API client with security and monitoring
   * @param metricsCollector - Optional metrics collector instance
   */
  constructor(metricsCollector?: any) {
    // Create base API client with rate limiting
    this.apiClient = rateLimit(createApiRequest(), {
      maxRequests: apiConfig.security.rateLimit.maxRequests,
      perMilliseconds: apiConfig.security.rateLimit.windowMs
    });

    this.metrics = metricsCollector;

    // Configure request interceptor for content-specific headers
    this.apiClient.interceptors.request.use((config) => {
      config.headers = {
        ...config.headers,
        'X-Content-Type': 'application/json',
        'X-Content-Version': process.env.VITE_APP_VERSION || '1.0.0'
      };
      return config;
    });

    // Configure response interceptor for content validation
    this.apiClient.interceptors.response.use((response) => {
      if (response.data?.data && !isContent(response.data.data)) {
        throw new Error('Invalid content data structure received');
      }
      return response;
    });
  }

  /**
   * Retrieves and validates content by ID with comprehensive error handling
   * @param contentId - Unique identifier of the content
   * @returns Promise resolving to validated content item
   * @throws Error if content validation fails or request fails
   */
  public async getContentById(contentId: string): Promise<Content> {
    try {
      // Start metrics collection
      const startTime = Date.now();

      // Validate content ID format
      if (!contentId.match(/^[a-zA-Z0-9-]+$/)) {
        throw new Error('Invalid content ID format');
      }

      // Build request URL with parameters
      const url = replaceUrlParams(apiConfig.endpoints.CONTENT.GET, { id: contentId });

      // Execute request with retry logic
      const response = await this.apiClient.get<{ data: Content }>(url, {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      // Validate response data
      const content = response.data.data;
      if (!isContent(content)) {
        throw new Error('Invalid content data structure');
      }

      // Validate quality score
      if (!validateQualityScore(content.qualityScore)) {
        throw new Error('Content does not meet quality threshold');
      }

      // Record metrics if collector exists
      if (this.metrics) {
        this.metrics.recordContentRetrieval({
          contentId,
          duration: Date.now() - startTime,
          success: true
        });
      }

      return content;
    } catch (error) {
      // Record error metrics if collector exists
      if (this.metrics) {
        this.metrics.recordContentError({
          contentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }

  /**
   * Retrieves filtered content for topic with comprehensive validation
   * @param topicId - Topic identifier
   * @param filters - Content filtering options
   * @returns Promise resolving to array of validated content items
   * @throws Error if validation fails or request fails
   */
  public async getContentByTopic(
    topicId: string,
    filters: ContentFilter
  ): Promise<Content[]> {
    try {
      // Start metrics collection
      const startTime = Date.now();

      // Validate topic ID
      if (!topicId.match(/^[a-zA-Z0-9-]+$/)) {
        throw new Error('Invalid topic ID format');
      }

      // Ensure minimum quality score threshold
      const enhancedFilters = {
        ...filters,
        minQualityScore: Math.max(filters.minQualityScore, QUALITY_THRESHOLD)
      };

      // Build query parameters
      const params = {
        topicId,
        types: enhancedFilters.types.join(','),
        minQualityScore: enhancedFilters.minQualityScore.toString(),
        dateRange: JSON.stringify(enhancedFilters.dateRange)
      };

      // Execute request with monitoring
      const response = await this.apiClient.get<{ data: Content[] }>(
        apiConfig.endpoints.CONTENT.SEARCH,
        {
          params,
          timeout: REQUEST_TIMEOUT
        }
      );

      // Validate response array
      const contents = response.data.data;
      if (!Array.isArray(contents) || !contents.every(isContent)) {
        throw new Error('Invalid content array structure');
      }

      // Filter by quality score
      const validContents = contents.filter(content => 
        validateQualityScore(content.qualityScore)
      );

      // Record metrics if collector exists
      if (this.metrics) {
        this.metrics.recordTopicContentRetrieval({
          topicId,
          duration: Date.now() - startTime,
          contentCount: validContents.length,
          success: true
        });
      }

      return validContents;
    } catch (error) {
      // Record error metrics if collector exists
      if (this.metrics) {
        this.metrics.recordTopicContentError({
          topicId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }
}