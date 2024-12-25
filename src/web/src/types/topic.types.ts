/**
 * Topic Types and Interfaces
 * Version: 1.0.0
 * 
 * Defines comprehensive TypeScript interfaces and types for topic-related data structures
 * supporting content discovery, knowledge organization, and topic relationship mapping.
 */

import { ApiResponse } from '../types/api.types';

/**
 * Main topic interface representing a knowledge node with metadata and relationships
 */
export interface Topic {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly relevanceScore: number; // 0-100 score for topic relevance
  readonly qualityScore: number; // 0-100 score for content quality
  readonly metadata: TopicMetadata;
  readonly connections: TopicConnection[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Topic metadata interface containing categorization and complexity information
 */
export interface TopicMetadata {
  readonly sourceType: string; // Source of the topic (e.g., "VIDEO", "ARTICLE")
  readonly complexity: TopicComplexity;
  readonly tags: string[];
  readonly category: string;
}

/**
 * Interface defining relationships between topics in the knowledge graph
 * Supports minimum 10 connections per topic requirement
 */
export interface TopicConnection {
  readonly targetTopicId: string;
  readonly relationshipType: TopicRelationType;
  readonly strength: number; // 0-1 indicating relationship strength
}

/**
 * Enhanced interface for topic filtering with support for multiple criteria
 */
export interface TopicFilter {
  readonly searchQuery?: string;
  readonly minRelevanceScore: number; // Supports 90% relevance threshold
  readonly minQualityScore: number;
  readonly dateRange?: DateRange;
  readonly categories?: string[];
  readonly complexity?: TopicComplexity[];
  readonly sortBy?: TopicSortField[];
  readonly sortOrder?: SortOrder;
}

/**
 * Date range interface for temporal filtering
 */
export interface DateRange {
  readonly startDate: Date;
  readonly endDate: Date;
}

/**
 * Enum for topic complexity levels
 */
export enum TopicComplexity {
  BASIC = 'BASIC',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED'
}

/**
 * Enum for types of relationships between topics
 */
export enum TopicRelationType {
  PREREQUISITE = 'PREREQUISITE',
  RELATED = 'RELATED',
  EXTENDS = 'EXTENDS',
  INCLUDES = 'INCLUDES'
}

/**
 * Enum for topic sorting fields
 */
export enum TopicSortField {
  RELEVANCE = 'relevanceScore',
  QUALITY = 'qualityScore',
  CREATED = 'createdAt',
  UPDATED = 'updatedAt',
  CONNECTIONS = 'connections'
}

/**
 * Enum for sort order
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Type alias for topic API responses
 */
export type TopicResponse = ApiResponse<Topic>;
export type TopicListResponse = ApiResponse<Topic[]>;
export type TopicConnectionResponse = ApiResponse<TopicConnection[]>;

/**
 * Type guard to check if an object is a valid Topic
 */
export function isTopic(obj: unknown): obj is Topic {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'relevanceScore' in obj &&
    'connections' in obj
  );
}

/**
 * Type guard to check if a topic meets minimum connection requirements
 */
export function hasMinimumConnections(topic: Topic): boolean {
  return topic.connections.length >= 10;
}