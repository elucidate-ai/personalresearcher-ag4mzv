/**
 * Content Types and Interfaces
 * Version: 1.0.0
 * 
 * Defines TypeScript interfaces and types for content-related data structures,
 * including content items, filters, quality metrics and analysis results.
 * Supports the Content Discovery Engine requirements for multi-source content
 * aggregation, quality assessment, and resource categorization.
 */

import { ApiResponse } from './api.types';

/**
 * Enum defining supported content types for the knowledge aggregation system
 */
export enum ContentType {
  VIDEO = 'VIDEO',
  ARTICLE = 'ARTICLE',
  PODCAST = 'PODCAST',
  BOOK = 'BOOK',
  ACADEMIC_PAPER = 'ACADEMIC_PAPER'
}

/**
 * Interface for content item data structure
 * Represents a single piece of content with its metadata and analysis results
 */
export interface Content {
  readonly id: string;
  readonly topicId: string;
  readonly type: ContentType;
  readonly title: string;
  readonly description: string;
  readonly sourceUrl: string;
  readonly qualityScore: number; // Normalized score between 0-1
  readonly metadata: ContentMetadata;
  readonly createdAt: string; // ISO 8601 date string
  readonly updatedAt: string; // ISO 8601 date string
  readonly analysisResults: ContentAnalysis;
}

/**
 * Interface for content-specific metadata
 * Contains additional information about the content source and properties
 */
export interface ContentMetadata {
  readonly author: string;
  readonly publisher: string;
  readonly publishDate: string; // ISO 8601 date string
  readonly language: string; // ISO 639-1 language code
  readonly keywords: string[];
  readonly contentSpecific: Record<string, unknown>; // Type-specific metadata
}

/**
 * Interface for content filtering options
 * Used to filter content based on various criteria
 */
export interface ContentFilter {
  readonly types: ContentType[];
  readonly minQualityScore: number; // Minimum threshold (0-1)
  readonly dateRange: DateRangeFilter;
  readonly keywords: string[];
  readonly languages: string[]; // ISO 639-1 language codes
}

/**
 * Interface for date range filtering
 * Supports optional start and end dates for content filtering
 */
export interface DateRangeFilter {
  readonly start: string | undefined; // ISO 8601 date string
  readonly end: string | undefined; // ISO 8601 date string
}

/**
 * Interface for content quality analysis results
 * Contains detailed metrics and analysis information
 */
export interface ContentAnalysis {
  readonly contentId: string;
  readonly qualityMetrics: QualityMetrics;
  readonly analysisDate: string; // ISO 8601 date string
  readonly version: string; // Semantic version of analysis algorithm
}

/**
 * Interface for detailed quality metrics
 * Each metric is normalized between 0-1
 */
export interface QualityMetrics {
  readonly relevance: number; // Content relevance to topic
  readonly authority: number; // Source authority score
  readonly freshness: number; // Content recency score
  readonly completeness: number; // Content completeness score
  readonly readability: number; // Content readability score
}

/**
 * Type for content API response
 * Wraps content data in standard API response format
 */
export type ContentResponse = ApiResponse<Content>;

/**
 * Type for content list API response
 * Wraps array of content items in standard API response format
 */
export type ContentListResponse = ApiResponse<Content[]>;

/**
 * Type guard to check if an object is a valid Content
 */
export function isContent(obj: unknown): obj is Content {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'type' in obj &&
    'qualityScore' in obj &&
    'metadata' in obj
  );
}

/**
 * Type guard to check if an object is a valid ContentAnalysis
 */
export function isContentAnalysis(obj: unknown): obj is ContentAnalysis {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'contentId' in obj &&
    'qualityMetrics' in obj &&
    'analysisDate' in obj
  );
}

/**
 * Constant for minimum acceptable quality score
 * Based on 90% relevance threshold requirement
 */
export const MIN_QUALITY_THRESHOLD = 0.9;

/**
 * Default content filter settings
 */
export const DEFAULT_CONTENT_FILTER: ContentFilter = {
  types: Object.values(ContentType),
  minQualityScore: MIN_QUALITY_THRESHOLD,
  dateRange: {
    start: undefined,
    end: undefined
  },
  keywords: [],
  languages: ['en'] // Default to English
};